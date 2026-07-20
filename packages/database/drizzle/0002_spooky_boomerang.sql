CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"document_type" text NOT NULL,
	"document_category" text,
	"title" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"document_url" text NOT NULL,
	"pdf_url" text,
	"file_size" integer,
	"published_date" timestamp,
	"last_modified_date" timestamp,
	"version_number" text,
	"source_ema_source_id" integer,
	"source_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "documents_url_unique" UNIQUE("document_url")
);
--> statement-breakpoint
CREATE TABLE "ema_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text NOT NULL,
	"etag" text,
	"last_modified" text,
	"content_hash" text,
	"last_crawled_at" timestamp,
	"last_success_at" timestamp,
	"http_status" integer,
	"crawl_error" text,
	"item_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ema_sources_source_url_unique" UNIQUE("source_url")
);
--> statement-breakpoint
CREATE TABLE "medicinal_products_extended" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ema_number" text,
	"category_id" integer,
	"category" text NOT NULL,
	"medicine_status" text NOT NULL,
	"opinion_status" text,
	"international_non_proprietary_name" text,
	"active_substance" text,
	"therapeutic_area_mesh" text,
	"therapeutic_indication" text,
	"atc_code" text,
	"pharmacotherapeutic_group" text,
	"patient_safety" boolean DEFAULT false,
	"accelerated_assessment" boolean DEFAULT false,
	"additional_monitoring" boolean DEFAULT false,
	"advanced_therapy" boolean DEFAULT false,
	"biosimilar" boolean DEFAULT false,
	"conditional_approval" boolean DEFAULT false,
	"exceptional_circumstances" boolean DEFAULT false,
	"generic_or_hybrid" boolean DEFAULT false,
	"orphan_medicine" boolean DEFAULT false,
	"prime_priority_medicine" boolean DEFAULT false,
	"marketing_authorisation_holder_developer_applicant" text,
	"opinion_adopted_date" date,
	"european_commission_decision_date" date,
	"marketing_authorisation_date" date,
	"withdrawal_expiry_revocation_lapse_date" date,
	"first_published_date" date,
	"last_updated_date" date,
	"latest_procedure_affecting_product_information" text,
	"revision_number" integer,
	"medicine_url" text,
	"source_ema_source_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "medicinal_products_extended_slug_unique" UNIQUE("slug"),
	CONSTRAINT "medicinal_products_extended_ema_number_unique" UNIQUE("ema_number")
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body_text" text,
	"news_type" text,
	"category" text,
	"published_date" date NOT NULL,
	"news_url" text NOT NULL,
	"language" text DEFAULT 'en',
	"source_ema_source_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_items_slug_unique" UNIQUE("slug"),
	CONSTRAINT "news_items_url_unique" UNIQUE("news_url")
);
--> statement-breakpoint
CREATE TABLE "product_news" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"news_id" integer NOT NULL,
	"mention_confidence" text DEFAULT 'high',
	"mention_context" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" serial PRIMARY KEY NOT NULL,
	"procedure_number" text NOT NULL,
	"procedure_type" text,
	"product_id" integer,
	"title" text,
	"description" text,
	"scope" text,
	"start_date" date,
	"opinion_date" date,
	"commission_decision_date" date,
	"outcome" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "procedures_procedure_number_unique" UNIQUE("procedure_number")
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_designations" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"designation_type" text NOT NULL,
	"designation_number" text,
	"condition" text,
	"status" text NOT NULL,
	"granted_date" date,
	"removed_date" date,
	"prevalence" text,
	"significant_benefit" text,
	"prime_eligibility_date" date,
	"specific_obligations" text,
	"annual_reassessment_due" date,
	"supporting_document_url" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"referral_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_number" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"legal_basis" text,
	"concern_type" text,
	"affected_substances" text,
	"affected_products_description" text,
	"start_date" date,
	"phtp_opinion_date" date,
	"prac_opinion_date" date,
	"chmp_opinion_date" date,
	"commission_decision_date" date,
	"outcome" text,
	"summary" text,
	"referral_url" text,
	"source_ema_source_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referral_number_unique" UNIQUE("referral_number"),
	CONSTRAINT "referrals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "shortages" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"shortage_number" text,
	"title" text NOT NULL,
	"description" text,
	"affected_products" text,
	"reason" text,
	"status" text NOT NULL,
	"severity" text,
	"reported_date" date NOT NULL,
	"expected_resolution_date" date,
	"actual_resolution_date" date,
	"affected_countries" text,
	"alternative_treatments" text,
	"actions_taken" text,
	"source_url" text,
	"source_ema_source_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shortages_shortage_number_unique" UNIQUE("shortage_number")
);
--> statement-breakpoint
CREATE TABLE "event_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"product_id" integer,
	"title" text NOT NULL,
	"description" text,
	"event_date" date NOT NULL,
	"event_data" jsonb,
	"source_url" text NOT NULL,
	"source_type" text NOT NULL,
	"confidence" text DEFAULT 'high',
	"extractor_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_product_id_medicinal_products_extended_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products_extended"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicinal_products_extended" ADD CONSTRAINT "medicinal_products_extended_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_news" ADD CONSTRAINT "product_news_news_id_news_items_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_product_id_medicinal_products_extended_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products_extended"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_designations" ADD CONSTRAINT "product_designations_product_id_medicinal_products_extended_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products_extended"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_referrals" ADD CONSTRAINT "product_referrals_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shortages" ADD CONSTRAINT "shortages_product_id_medicinal_products_extended_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products_extended"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_event_id_timeline_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."timeline_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_product_id_medicinal_products_extended_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products_extended"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_product_idx" ON "documents" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "documents_type_idx" ON "documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "documents_language_idx" ON "documents" USING btree ("language");--> statement-breakpoint
CREATE INDEX "documents_category_idx" ON "documents" USING btree ("document_category");--> statement-breakpoint
CREATE INDEX "ema_sources_source_type_idx" ON "ema_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "ema_sources_last_crawled_idx" ON "ema_sources" USING btree ("last_crawled_at");--> statement-breakpoint
CREATE INDEX "medicinal_products_ext_status_idx" ON "medicinal_products_extended" USING btree ("medicine_status");--> statement-breakpoint
CREATE INDEX "medicinal_products_ext_category_idx" ON "medicinal_products_extended" USING btree ("category");--> statement-breakpoint
CREATE INDEX "medicinal_products_ext_name_idx" ON "medicinal_products_extended" USING btree ("name");--> statement-breakpoint
CREATE INDEX "medicinal_products_ext_atc_idx" ON "medicinal_products_extended" USING btree ("atc_code");--> statement-breakpoint
CREATE INDEX "medicinal_products_ext_orphan_idx" ON "medicinal_products_extended" USING btree ("orphan_medicine");--> statement-breakpoint
CREATE INDEX "medicinal_products_ext_updated_idx" ON "medicinal_products_extended" USING btree ("last_updated_date");--> statement-breakpoint
CREATE INDEX "news_items_published_idx" ON "news_items" USING btree ("published_date");--> statement-breakpoint
CREATE INDEX "news_items_type_idx" ON "news_items" USING btree ("news_type");--> statement-breakpoint
CREATE INDEX "product_news_product_idx" ON "product_news" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_news_news_idx" ON "product_news" USING btree ("news_id");--> statement-breakpoint
CREATE INDEX "procedures_product_idx" ON "procedures" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "procedures_type_idx" ON "procedures" USING btree ("procedure_type");--> statement-breakpoint
CREATE INDEX "procedures_opinion_date_idx" ON "procedures" USING btree ("opinion_date");--> statement-breakpoint
CREATE INDEX "product_designations_product_idx" ON "product_designations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_designations_type_idx" ON "product_designations" USING btree ("designation_type");--> statement-breakpoint
CREATE INDEX "product_designations_status_idx" ON "product_designations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_referrals_product_idx" ON "product_referrals" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_referrals_referral_idx" ON "product_referrals" USING btree ("referral_id");--> statement-breakpoint
CREATE INDEX "referrals_legal_basis_idx" ON "referrals" USING btree ("legal_basis");--> statement-breakpoint
CREATE INDEX "referrals_start_date_idx" ON "referrals" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "referrals_chmp_opinion_idx" ON "referrals" USING btree ("chmp_opinion_date");--> statement-breakpoint
CREATE INDEX "shortages_product_idx" ON "shortages" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "shortages_status_idx" ON "shortages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shortages_reported_date_idx" ON "shortages" USING btree ("reported_date");--> statement-breakpoint
CREATE INDEX "shortages_severity_idx" ON "shortages" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "event_sources_event_idx" ON "event_sources" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_sources_source_idx" ON "event_sources" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "timeline_events_product_idx" ON "timeline_events" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "timeline_events_type_idx" ON "timeline_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "timeline_events_category_idx" ON "timeline_events" USING btree ("event_category");--> statement-breakpoint
CREATE INDEX "timeline_events_date_idx" ON "timeline_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "timeline_events_product_date_idx" ON "timeline_events" USING btree ("product_id","event_date");