ALTER TABLE "shortages" DROP CONSTRAINT "shortages_shortage_number_unique";--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "source_authority" text DEFAULT 'EMA' NOT NULL;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "region" text DEFAULT 'EU' NOT NULL;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "substance_id" integer;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "inn" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "medicine_affected" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "therapeutic_area_mesh" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "pharmaceutical_forms_affected" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "strengths_affected" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "availability_of_alternatives" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "start_of_shortage_date" date;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "first_published_date" date;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "last_updated_date" date;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "shortage_data" jsonb;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "source_document_id" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "shortages" ADD CONSTRAINT "shortages_substance_id_substances_id_fk" FOREIGN KEY ("substance_id") REFERENCES "public"."substances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shortages_substance_idx" ON "shortages" USING btree ("substance_id");--> statement-breakpoint
CREATE INDEX "shortages_inn_idx" ON "shortages" USING btree ("inn");--> statement-breakpoint
CREATE INDEX "shortages_authority_idx" ON "shortages" USING btree ("source_authority");--> statement-breakpoint
CREATE INDEX "shortages_region_idx" ON "shortages" USING btree ("region");--> statement-breakpoint
CREATE INDEX "shortages_authority_status_idx" ON "shortages" USING btree ("source_authority","status");--> statement-breakpoint
CREATE INDEX "shortages_start_date_idx" ON "shortages" USING btree ("start_of_shortage_date");--> statement-breakpoint
CREATE INDEX "shortages_slug_idx" ON "shortages" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "shortages" DROP COLUMN "shortage_number";--> statement-breakpoint
ALTER TABLE "shortages" ADD CONSTRAINT "shortages_slug_unique" UNIQUE("slug");