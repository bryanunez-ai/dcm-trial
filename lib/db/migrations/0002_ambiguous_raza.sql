CREATE TABLE "ai_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"model" varchar(64) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_micros" integer NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"path" varchar(255) NOT NULL,
	"referrer_domain" varchar(253),
	"visitor_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(100) NOT NULL,
	"domain" varchar(253) NOT NULL,
	"site_key" varchar(32) NOT NULL,
	"share_token" varchar(32),
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sites_site_key_unique" UNIQUE("site_key"),
	CONSTRAINT "sites_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "visitor_salts" (
	"day" date PRIMARY KEY NOT NULL,
	"salt" varchar(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analyses_site_created_idx" ON "ai_analyses" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_analyses_user_created_idx" ON "ai_analyses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "events_site_timestamp_idx" ON "events" USING btree ("site_id","timestamp");--> statement-breakpoint
CREATE INDEX "events_site_visitor_idx" ON "events" USING btree ("site_id","visitor_hash");--> statement-breakpoint
CREATE INDEX "sites_user_id_idx" ON "sites" USING btree ("user_id");