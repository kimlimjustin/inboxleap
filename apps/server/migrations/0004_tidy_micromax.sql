ALTER TABLE "companies" ADD COLUMN "parent_company_id" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "company_type" varchar(20) DEFAULT 'main';--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_company_id_companies_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_companies_parent" ON "companies" USING btree ("parent_company_id");--> statement-breakpoint
CREATE INDEX "idx_companies_type" ON "companies" USING btree ("company_type");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_type_check" CHECK (company_type IN ('main', 'subsidiary', 'division', 'project'));