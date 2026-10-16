import { db } from "@dokploy/server/db";
import { notifications } from "@dokploy/server/db/schema";
import { and, eq } from "drizzle-orm";
import {
	sendCustomNotification,
	sendDiscordNotification,
	sendEmailNotification,
	sendGotifyNotification,
	sendLarkNotification,
	sendMattermostNotification,
	sendNtfyNotification,
	sendPushoverNotification,
	sendResendNotification,
	sendSlackNotification,
	sendTeamsNotification,
	sendTelegramNotification,
} from "./utils";

export const sendUptimeNotifications = async (
	organizationId: string,
	payload: { url: string; status: "up" | "down"; reason: string },
) => {
	const date = new Date();
	const isDown = payload.status === "down";
	const title = isDown
		? `🔴 ${payload.url} is down`
		: `🟢 ${payload.url} is back up`;
	const message = `${payload.reason}\nDate: ${date.toLocaleString()}`;

	const notificationList = await db.query.notifications.findMany({
		where: and(
			eq(notifications.uptimeAlert, true),
			eq(notifications.organizationId, organizationId),
		),
		with: {
			email: true,
			discord: true,
			telegram: true,
			slack: true,
			resend: true,
			gotify: true,
			ntfy: true,
			mattermost: true,
			custom: true,
			lark: true,
			pushover: true,
			teams: true,
		},
	});

	for (const n of notificationList) {
		try {
			const html = `<h2>${title}</h2><p>${message.replace(/\n/g, "<br/>")}</p>`;
			if (n.email) await sendEmailNotification(n.email, title, html);
			if (n.resend) await sendResendNotification(n.resend, title, html);
			if (n.discord) {
				await sendDiscordNotification(n.discord, {
					title,
					description: message,
					color: isDown ? 0xed4245 : 0x57f287,
					timestamp: date.toISOString(),
				});
			}
			if (n.gotify) await sendGotifyNotification(n.gotify, title, message);
			if (n.ntfy) {
				await sendNtfyNotification(
					n.ntfy,
					title,
					isDown ? "red_circle" : "green_circle",
					"",
					message,
				);
			}
			if (n.telegram) {
				await sendTelegramNotification(
					n.telegram,
					`<b>${title}</b>\n\n${message}`,
				);
			}
			if (n.slack) {
				await sendSlackNotification(n.slack, {
					channel: n.slack.channel,
					attachments: [
						{
							color: isDown ? "#FF0000" : "#00FF00",
							pretext: `*${title}*`,
							text: message,
						},
					],
				});
			}
			if (n.mattermost) {
				await sendMattermostNotification(n.mattermost, {
					text: `**${title}**\n\n${message}`,
					channel: n.mattermost.channel,
					username: n.mattermost.username || "Dokploy",
				});
			}
			if (n.custom) {
				await sendCustomNotification(n.custom, {
					title,
					message,
					url: payload.url,
					status: payload.status,
					timestamp: date.toISOString(),
					type: "uptime",
				});
			}
			if (n.lark) {
				await sendLarkNotification(n.lark, {
					msg_type: "text",
					content: { text: `${title}\n${message}` },
				});
			}
			if (n.pushover) {
				await sendPushoverNotification(n.pushover, title, message);
			}
			if (n.teams) {
				await sendTeamsNotification(n.teams, {
					title,
					facts: [
						{ name: "URL", value: payload.url },
						{ name: "Details", value: payload.reason },
					],
				});
			}
		} catch (error) {
			console.log(error);
		}
	}
};
