import { db } from "@dokploy/server/db";
import { domains, organization, server } from "@dokploy/server/db/schema";
import { eq } from "drizzle-orm";
import { scheduleJob } from "node-schedule";
import { sendServerThresholdNotifications } from "./notifications/server-threshold";
import { sendUptimeNotifications } from "./notifications/uptime";
import { execAsync, execAsyncRemote } from "./process/execAsync";

// A single failed request is often a deploy or a network blip, so two in a row are needed.
const FAILURES_BEFORE_DOWN = 2;
// shortcut: fixed thresholds, move them to web server settings if people need to tune them.
const RESOURCE_THRESHOLD = 90;
const RESOURCE_MINUTES = 5;

const failures = new Map<string, number>();
const resourceStreaks = new Map<string, number>();
let running = false;

type UptimeStatus = "up" | "down";

export const uptimeTransition = (
	previous: UptimeStatus | null,
	consecutiveFailures: number,
): { status: UptimeStatus; notify: boolean } | null => {
	if (consecutiveFailures > 0 && consecutiveFailures < FAILURES_BEFORE_DOWN) {
		return null;
	}
	const status = consecutiveFailures > 0 ? "down" : "up";
	if (status === previous) return null;
	// The first successful check only records the state, there is nothing to recover from.
	return { status, notify: !(previous === null && status === "up") };
};

export const parseResourceUsage = (stdout: string) => {
	const [cpus, load, memory, disk] = stdout.trim().split(/\s+/).map(Number);
	if (
		!cpus ||
		[load, memory, disk].some((v) => v === undefined || Number.isNaN(v))
	) {
		return null;
	}
	return {
		CPU: ((load as number) / cpus) * 100,
		Memory: memory as number,
		Disk: disk as number,
	};
};

const checkUrl = async (url: string) => {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
		return res.status >= 500 ? `HTTP ${res.status}` : null;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
};

const checkUptime = async () => {
	const monitored = await db.query.domains.findMany({
		where: eq(domains.uptimeMonitor, true),
		with: {
			application: { with: { environment: { with: { project: true } } } },
			compose: { with: { environment: { with: { project: true } } } },
		},
	});

	await Promise.all(
		monitored.map(async (domain) => {
			const url = `${domain.https ? "https" : "http"}://${domain.host}${domain.path ?? "/"}`;
			const reason = await checkUrl(url);
			const count = reason ? (failures.get(domain.domainId) ?? 0) + 1 : 0;
			failures.set(domain.domainId, count);

			const transition = uptimeTransition(domain.uptimeStatus ?? null, count);
			if (!transition) return;

			await db
				.update(domains)
				.set({
					uptimeStatus: transition.status,
					uptimeChangedAt: new Date().toISOString(),
				})
				.where(eq(domains.domainId, domain.domainId));

			const organizationId = (domain.application ?? domain.compose)?.environment
				.project.organizationId;
			if (transition.notify && organizationId) {
				await sendUptimeNotifications(organizationId, {
					url,
					status: transition.status,
					reason: reason ?? "Responding normally again",
				});
			}
		}),
	);
};

const RESOURCE_COMMAND = `echo $(nproc) $(cut -d' ' -f1 /proc/loadavg) $(awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{print (t-a)/t*100}' /proc/meminfo) $(df -P / | awk 'NR==2{print $5+0}')`;

const checkResources = async () => {
	const remoteServers = await db.query.server.findMany({
		where: eq(server.serverStatus, "active"),
	});
	// The Dokploy host is shared by every organization of this instance.
	const organizationIds = (
		await db.select({ id: organization.id }).from(organization)
	).map((o) => o.id);
	const targets = [
		{ key: "dokploy", name: "Dokploy", serverId: null, organizationIds },
		...remoteServers.map((s) => ({
			key: s.serverId,
			name: s.name,
			serverId: s.serverId,
			organizationIds: [s.organizationId],
		})),
	];

	await Promise.all(
		targets.map(async (target) => {
			try {
				const { stdout } = target.serverId
					? await execAsyncRemote(target.serverId, RESOURCE_COMMAND)
					: await execAsync(RESOURCE_COMMAND);
				const usage = parseResourceUsage(stdout);
				if (!usage) return;

				for (const [type, value] of Object.entries(usage) as [
					"CPU" | "Memory" | "Disk",
					number,
				][]) {
					const key = `${target.key}:${type}`;
					const streak =
						value >= RESOURCE_THRESHOLD
							? (resourceStreaks.get(key) ?? 0) + 1
							: 0;
					resourceStreaks.set(key, streak);
					// Alert once per episode, when the streak reaches the limit.
					if (streak !== RESOURCE_MINUTES) continue;
					for (const organizationId of target.organizationIds) {
						await sendServerThresholdNotifications(organizationId, {
							Type: type,
							Value: value,
							Threshold: RESOURCE_THRESHOLD,
							Message: `${type} usage above ${RESOURCE_THRESHOLD}% for ${RESOURCE_MINUTES} minutes`,
							Timestamp: new Date().toISOString(),
							Token: "",
							ServerName: target.name,
						});
					}
				}
			} catch (error) {
				console.error(
					`Watchdog: could not read resources of ${target.name}`,
					error,
				);
			}
		}),
	);
};

export const initWatchdogCronJobs = () => {
	scheduleJob("watchdog", "* * * * *", async () => {
		if (running) return;
		running = true;
		try {
			await Promise.all([checkUptime(), checkResources()]);
		} catch (error) {
			console.error("Watchdog failed", error);
		} finally {
			running = false;
		}
	});
};
