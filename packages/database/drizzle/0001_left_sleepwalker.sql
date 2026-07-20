CREATE TABLE "import_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"total_fetched" integer DEFAULT 0,
	"products_created" integer DEFAULT 0,
	"products_updated" integer DEFAULT 0,
	"substances_created" integer DEFAULT 0,
	"companies_created" integer DEFAULT 0,
	"error_count" integer DEFAULT 0,
	"errors" jsonb,
	"metadata" jsonb
);
