ALTER TABLE "webServerSettings" ALTER COLUMN "whitelabelingConfig" SET DEFAULT '{"appName":null,"appDescription":null,"logoUrl":null,"faviconUrl":null,"customCss":null,"loginLogoUrl":null,"supportUrl":null,"docsUrl":null,"errorPageTitle":null,"errorPageDescription":null,"footerText":null,"ogImageUrl":null,"logoLightUrl":null,"loginLogoLightUrl":null,"faviconLightUrl":null,"dualModeBranding":false}'::jsonb;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "vulnerabilityScan" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deployment" ADD COLUMN "vulnerabilitySummary" text;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "uptimeMonitor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "publicStatus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "uptimeStatus" text;--> statement-breakpoint
ALTER TABLE "domain" ADD COLUMN "uptimeChangedAt" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "uptimeAlert" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "webServerSettings" ADD COLUMN "domainRestrictionConfig" jsonb DEFAULT '{"enabled":false,"allowedWildcards":[]}'::jsonb;