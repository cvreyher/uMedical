CREATE TABLE "document_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"product_id" integer,
	"chunk_index" integer NOT NULL,
	"section_type" text,
	"section_title" text,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(1536),
	"content_tsv" "tsvector",
	"language" text DEFAULT 'en' NOT NULL,
	"char_count" integer NOT NULL,
	"token_count" integer,
	"extractor_version" text DEFAULT '1.0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_chunks_hash_unique" UNIQUE("document_id","content_hash")
);
--> statement-breakpoint
CREATE TABLE "embedding_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" text DEFAULT 'incremental' NOT NULL,
	"model" text DEFAULT 'text-embedding-3-small' NOT NULL,
	"batch_size" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_chunks" integer DEFAULT 0,
	"processed_chunks" integer DEFAULT 0,
	"failed_chunks" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"estimated_cost_usd" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_error" text,
	"error_count" integer DEFAULT 0,
	"errors" jsonb,
	"triggered_by" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0,
	"progress_message" text,
	"payload" jsonb,
	"result" jsonb,
	"error_message" text,
	"error_stack" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"triggered_by" text,
	"parent_job_id" integer
);
--> statement-breakpoint
CREATE TABLE "pvigilance_event_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"match_type" text NOT NULL,
	"match_confidence" real DEFAULT 1 NOT NULL,
	"match_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvigilance_event_products_unique" UNIQUE("event_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "pvigilance_event_substances" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"substance_id" integer,
	"inn" text NOT NULL,
	"match_type" text NOT NULL,
	"match_confidence" real DEFAULT 1 NOT NULL,
	"match_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvigilance_event_substances_unique" UNIQUE("event_id","inn")
);
--> statement-breakpoint
CREATE TABLE "pvigilance_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"source_authority" text NOT NULL,
	"region" text NOT NULL,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" date NOT NULL,
	"event_data" jsonb,
	"source_url" text NOT NULL,
	"source_document_id" text,
	"source_feed_id" integer,
	"content_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvigilance_events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pvigilance_feed_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"feed_source_id" integer NOT NULL,
	"status" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"items_fetched" integer DEFAULT 0 NOT NULL,
	"items_created" integer DEFAULT 0 NOT NULL,
	"items_updated" integer DEFAULT 0 NOT NULL,
	"items_skipped" integer DEFAULT 0 NOT NULL,
	"http_status" integer,
	"response_size" integer,
	"error_message" text,
	"error_details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pvigilance_feed_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"authority" text NOT NULL,
	"region" text NOT NULL,
	"feed_type" text NOT NULL,
	"feed_url" text NOT NULL,
	"feed_config" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_healthy" boolean DEFAULT true NOT NULL,
	"poll_interval_minutes" integer DEFAULT 60 NOT NULL,
	"last_fetched_at" timestamp,
	"last_success_at" timestamp,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"total_fetches" integer DEFAULT 0 NOT NULL,
	"total_items_processed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvigilance_feed_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "regional_authorization_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"authorization_id" integer NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"change_reason" text,
	"changed_at" date NOT NULL,
	"source_url" text,
	"source_event_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regional_authorizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"substance_id" integer,
	"inn" text NOT NULL,
	"region" text NOT NULL,
	"authority" text NOT NULL,
	"status" text NOT NULL,
	"brand_name" text,
	"local_product_code" text,
	"authorization_date" date,
	"authorization_holder" text,
	"therapeutic_indication" text,
	"source_url" text,
	"last_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "regional_authorizations_product_region" UNIQUE("product_id","region"),
	CONSTRAINT "regional_authorizations_substance_region" UNIQUE NULLS NOT DISTINCT("substance_id","region")
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "search_text" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "embedding_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "processing_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "text_extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "chunk_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "extractor_version" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "medicinal_products_extended" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "medicinal_products_extended" ADD COLUMN "search_text" text;--> statement-breakpoint
ALTER TABLE "medicinal_products_extended" ADD COLUMN "embedding_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "substances" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "substances" ADD COLUMN "search_text" text;--> statement-breakpoint
ALTER TABLE "substances" ADD COLUMN "embedding_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_product_id_medicinal_products_extended_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products_extended"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvigilance_event_products" ADD CONSTRAINT "pvigilance_event_products_event_id_pvigilance_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pvigilance_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvigilance_event_products" ADD CONSTRAINT "pvigilance_event_products_product_id_medicinal_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvigilance_event_substances" ADD CONSTRAINT "pvigilance_event_substances_event_id_pvigilance_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pvigilance_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvigilance_event_substances" ADD CONSTRAINT "pvigilance_event_substances_substance_id_substances_id_fk" FOREIGN KEY ("substance_id") REFERENCES "public"."substances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvigilance_events" ADD CONSTRAINT "pvigilance_events_source_feed_id_pvigilance_feed_sources_id_fk" FOREIGN KEY ("source_feed_id") REFERENCES "public"."pvigilance_feed_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pvigilance_feed_logs" ADD CONSTRAINT "pvigilance_feed_logs_feed_source_id_pvigilance_feed_sources_id_fk" FOREIGN KEY ("feed_source_id") REFERENCES "public"."pvigilance_feed_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_authorization_history" ADD CONSTRAINT "regional_authorization_history_authorization_id_regional_authorizations_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."regional_authorizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_authorizations" ADD CONSTRAINT "regional_authorizations_product_id_medicinal_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_authorizations" ADD CONSTRAINT "regional_authorizations_substance_id_substances_id_fk" FOREIGN KEY ("substance_id") REFERENCES "public"."substances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunks_document_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_chunks_product_idx" ON "document_chunks" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "document_chunks_section_type_idx" ON "document_chunks" USING btree ("section_type");--> statement-breakpoint
CREATE INDEX "document_chunks_language_idx" ON "document_chunks" USING btree ("language");--> statement-breakpoint
CREATE INDEX "embedding_jobs_status_idx" ON "embedding_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "embedding_jobs_job_type_idx" ON "embedding_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "embedding_jobs_created_at_idx" ON "embedding_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "processing_jobs_status_idx" ON "processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "processing_jobs_type_status_idx" ON "processing_jobs" USING btree ("job_type","status");--> statement-breakpoint
CREATE INDEX "processing_jobs_priority_idx" ON "processing_jobs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "processing_jobs_scheduled_idx" ON "processing_jobs" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "processing_jobs_entity_idx" ON "processing_jobs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "pvigilance_event_products_event_idx" ON "pvigilance_event_products" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "pvigilance_event_products_product_idx" ON "pvigilance_event_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "pvigilance_event_products_confidence_idx" ON "pvigilance_event_products" USING btree ("match_confidence");--> statement-breakpoint
CREATE INDEX "pvigilance_event_substances_event_idx" ON "pvigilance_event_substances" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "pvigilance_event_substances_substance_idx" ON "pvigilance_event_substances" USING btree ("substance_id");--> statement-breakpoint
CREATE INDEX "pvigilance_event_substances_inn_idx" ON "pvigilance_event_substances" USING btree ("inn");--> statement-breakpoint
CREATE INDEX "pvigilance_event_substances_confidence_idx" ON "pvigilance_event_substances" USING btree ("match_confidence");--> statement-breakpoint
CREATE INDEX "pvigilance_events_authority_idx" ON "pvigilance_events" USING btree ("source_authority");--> statement-breakpoint
CREATE INDEX "pvigilance_events_region_idx" ON "pvigilance_events" USING btree ("region");--> statement-breakpoint
CREATE INDEX "pvigilance_events_type_idx" ON "pvigilance_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "pvigilance_events_category_idx" ON "pvigilance_events" USING btree ("event_category");--> statement-breakpoint
CREATE INDEX "pvigilance_events_severity_idx" ON "pvigilance_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "pvigilance_events_date_idx" ON "pvigilance_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "pvigilance_events_feed_idx" ON "pvigilance_events" USING btree ("source_feed_id");--> statement-breakpoint
CREATE INDEX "pvigilance_events_hash_idx" ON "pvigilance_events" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "pvigilance_events_authority_date_idx" ON "pvigilance_events" USING btree ("source_authority","event_date");--> statement-breakpoint
CREATE INDEX "pvigilance_events_type_severity_idx" ON "pvigilance_events" USING btree ("event_type","severity");--> statement-breakpoint
CREATE INDEX "pvigilance_feed_logs_feed_idx" ON "pvigilance_feed_logs" USING btree ("feed_source_id");--> statement-breakpoint
CREATE INDEX "pvigilance_feed_logs_status_idx" ON "pvigilance_feed_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pvigilance_feed_logs_fetched_at_idx" ON "pvigilance_feed_logs" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "pvigilance_feed_logs_feed_fetched_idx" ON "pvigilance_feed_logs" USING btree ("feed_source_id","fetched_at");--> statement-breakpoint
CREATE INDEX "pvigilance_feed_sources_authority_idx" ON "pvigilance_feed_sources" USING btree ("authority");--> statement-breakpoint
CREATE INDEX "pvigilance_feed_sources_enabled_idx" ON "pvigilance_feed_sources" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "pvigilance_feed_sources_healthy_idx" ON "pvigilance_feed_sources" USING btree ("is_healthy");--> statement-breakpoint
CREATE INDEX "pvigilance_feed_sources_next_fetch_idx" ON "pvigilance_feed_sources" USING btree ("is_enabled","last_fetched_at");--> statement-breakpoint
CREATE INDEX "regional_auth_history_auth_idx" ON "regional_authorization_history" USING btree ("authorization_id");--> statement-breakpoint
CREATE INDEX "regional_auth_history_changed_at_idx" ON "regional_authorization_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "regional_authorizations_product_idx" ON "regional_authorizations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "regional_authorizations_substance_idx" ON "regional_authorizations" USING btree ("substance_id");--> statement-breakpoint
CREATE INDEX "regional_authorizations_inn_idx" ON "regional_authorizations" USING btree ("inn");--> statement-breakpoint
CREATE INDEX "regional_authorizations_region_idx" ON "regional_authorizations" USING btree ("region");--> statement-breakpoint
CREATE INDEX "regional_authorizations_status_idx" ON "regional_authorizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "regional_authorizations_inn_region_idx" ON "regional_authorizations" USING btree ("inn","region");--> statement-breakpoint
CREATE INDEX "documents_processing_status_idx" ON "documents" USING btree ("processing_status");