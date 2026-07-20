ALTER TABLE "product_companies" DROP CONSTRAINT "product_companies_product_id_medicinal_products_id_fk";
--> statement-breakpoint
ALTER TABLE "product_substances" DROP CONSTRAINT "product_substances_product_id_medicinal_products_id_fk";
--> statement-breakpoint
-- Existing rows were written with legacy medicinal_products IDs and cannot be
-- reliably mapped to medicinal_products_extended IDs. Remove them; links are
-- recreated by the extended import (or pnpm db:seed:dev in development).
DELETE FROM "product_companies";--> statement-breakpoint
DELETE FROM "product_substances";--> statement-breakpoint
ALTER TABLE "product_companies" ADD CONSTRAINT "product_companies_product_id_medicinal_products_extended_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products_extended"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_substances" ADD CONSTRAINT "product_substances_product_id_medicinal_products_extended_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products_extended"("id") ON DELETE cascade ON UPDATE no action;