CREATE TABLE "company_agent_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"agent_type" varchar(50) NOT NULL,
	"email_address" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"customization" jsonb DEFAULT '{}'::jsonb,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "company_agent_emails_email_address_unique" UNIQUE("email_address"),
	CONSTRAINT "company_agent_emails_company_agent_unique" UNIQUE("company_id","agent_type")
);
--> statement-breakpoint
ALTER TABLE "company_agent_emails" ADD CONSTRAINT "company_agent_emails_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_agent_emails" ADD CONSTRAINT "company_agent_emails_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_agent_emails_company_agent" ON "company_agent_emails" USING btree ("company_id","agent_type");--> statement-breakpoint
CREATE INDEX "idx_company_agent_emails_email" ON "company_agent_emails" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "idx_company_agent_emails_agent_type" ON "company_agent_emails" USING btree ("agent_type");