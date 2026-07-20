CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "medicinal_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ema_number" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"authorization_date" date,
	"ema_url" text,
	"therapeutic_area" text,
	"condition_indication" text,
	"atc_code" text,
	"orphan_medicine" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "medicinal_products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "medicinal_products_ema_number_unique" UNIQUE("ema_number")
);
--> statement-breakpoint
CREATE TABLE "product_companies" (
	"product_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"role" text DEFAULT 'mah' NOT NULL,
	CONSTRAINT "product_companies_product_id_company_id_role_pk" PRIMARY KEY("product_id","company_id","role")
);
--> statement-breakpoint
CREATE TABLE "product_substances" (
	"product_id" integer NOT NULL,
	"substance_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_substances_product_id_substance_id_pk" PRIMARY KEY("product_id","substance_id")
);
--> statement-breakpoint
CREATE TABLE "substances" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"inn_name" text NOT NULL,
	"synonyms" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "substances_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "product_companies" ADD CONSTRAINT "product_companies_product_id_medicinal_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_companies" ADD CONSTRAINT "product_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_substances" ADD CONSTRAINT "product_substances_product_id_medicinal_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."medicinal_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_substances" ADD CONSTRAINT "product_substances_substance_id_substances_id_fk" FOREIGN KEY ("substance_id") REFERENCES "public"."substances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "medicinal_products_status_idx" ON "medicinal_products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "medicinal_products_name_idx" ON "medicinal_products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "substances_inn_name_idx" ON "substances" USING btree ("inn_name");