import { db } from "@dokploy/server/db";
import { domains, organization } from "@dokploy/server/db/schema";
import { and, eq } from "drizzle-orm";
import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
	name: string;
	services: {
		host: string;
		status: "up" | "down" | null;
		since: string | null;
	}[];
}

export default function StatusPage({ name, services }: Props) {
	const down = services.filter((s) => s.status === "down").length;
	return (
		<div className="min-h-screen bg-background px-4 py-10">
			<Head>
				<title>{`${name} status`}</title>
				<meta httpEquiv="refresh" content="60" />
			</Head>
			<Card className="mx-auto max-w-2xl">
				<CardHeader>
					<CardTitle className="text-2xl">{name}</CardTitle>
					<p
						className={down > 0 ? "text-red-500" : "text-green-600"}
						role="status"
					>
						{services.length === 0
							? "No services published yet."
							: down > 0
								? `${down} service${down > 1 ? "s" : ""} down`
								: "All systems operational"}
					</p>
				</CardHeader>
				<CardContent className="flex flex-col divide-y">
					{services.map((s, i) => (
						<div
							key={`${s.host}-${i}`}
							className="flex items-center justify-between gap-4 py-3"
						>
							<span className="truncate font-medium">{s.host}</span>
							<span className="flex items-center gap-2 text-sm text-muted-foreground">
								{s.since && (
									<span>since {new Date(s.since).toLocaleString()}</span>
								)}
								<Badge
									variant={s.status === "down" ? "destructive" : "default"}
								>
									{s.status === "down"
										? "Down"
										: s.status === "up"
											? "Operational"
											: "Pending"}
								</Badge>
							</span>
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

export async function getServerSideProps(
	context: GetServerSidePropsContext<{ organizationId: string }>,
) {
	const organizationId = context.params?.organizationId ?? "";
	const org = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
		columns: { name: true },
	});
	if (!org) return { notFound: true };

	const ownerOrg = {
		columns: {},
		with: { project: { columns: { organizationId: true } } },
	} as const;
	// shortcut: filters the organization in memory, fine for a few hundred public domains.
	const published = await db.query.domains.findMany({
		where: and(eq(domains.publicStatus, true), eq(domains.uptimeMonitor, true)),
		columns: { host: true, uptimeStatus: true, uptimeChangedAt: true },
		with: {
			application: { columns: {}, with: { environment: ownerOrg } },
			compose: { columns: {}, with: { environment: ownerOrg } },
		},
	});

	const services = published
		.filter(
			(d) =>
				(d.application ?? d.compose)?.environment.project.organizationId ===
				organizationId,
		)
		.map((d) => ({
			host: d.host,
			status: d.uptimeStatus ?? null,
			since: d.uptimeChangedAt ?? null,
		}));

	return { props: { name: org.name, services } };
}
