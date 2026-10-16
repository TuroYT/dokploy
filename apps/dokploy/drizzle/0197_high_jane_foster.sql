ALTER TABLE "application" ADD COLUMN "vulnerabilityScan" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "vulnerabilitySummary" text;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "uptimeMonitor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "publicStatus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "uptimeStatus" text;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "uptimeChangedAt" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "uptimeAlert" boolean DEFAULT false NOT NULL;