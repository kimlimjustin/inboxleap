ALTER TABLE "companies" DROP CONSTRAINT "companies_parent_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "email_address" varchar;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_companies_email" ON "companies" USING btree ("email_address");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_email_address_unique" UNIQUE("email_address");