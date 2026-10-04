CREATE TYPE "public"."corporate_event_kind" AS ENUM('dividend', 'split');--> statement-breakpoint
CREATE TABLE "asset_prices_daily" (
	"symbol" text NOT NULL,
	"date" date NOT NULL,
	"close_cents" bigint NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "asset_prices_daily_symbol_date_pk" PRIMARY KEY("symbol","date")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text,
	"currency" text,
	"last_price_cents" bigint,
	"last_quoted_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"backfilled_at" timestamp with time zone,
	"not_found" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"kind" "corporate_event_kind" NOT NULL,
	"ex_date" date NOT NULL,
	"amount" numeric(20, 8) NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_prices_daily" ADD CONSTRAINT "asset_prices_daily_symbol_assets_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."assets"("symbol") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_events" ADD CONSTRAINT "corporate_events_symbol_assets_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."assets"("symbol") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_synced_idx" ON "assets" USING btree ("synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "corporate_events_symbol_kind_date" ON "corporate_events" USING btree ("symbol","kind","ex_date");