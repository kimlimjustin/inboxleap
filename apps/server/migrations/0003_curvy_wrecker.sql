CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"domain_restrictions" jsonb DEFAULT '{"enabled": false, "domains": []}',
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"manager_user_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_hierarchy" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_user_id" varchar NOT NULL,
	"manager_user_id" varchar,
	"confidence" numeric(3, 2) DEFAULT '1.00',
	"source" varchar(50) DEFAULT 'manual',
	"last_seen" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_company_employee" UNIQUE("company_id","employee_user_id")
);
--> statement-breakpoint
CREATE TABLE "company_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"department" varchar(100),
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_company_user" UNIQUE("company_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "polling_agents" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "polling_agents" ADD COLUMN "account_type" varchar(20) DEFAULT 'individual';--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_departments" ADD CONSTRAINT "company_departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_departments" ADD CONSTRAINT "company_departments_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_hierarchy" ADD CONSTRAINT "company_hierarchy_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_hierarchy" ADD CONSTRAINT "company_hierarchy_employee_user_id_users_id_fk" FOREIGN KEY ("employee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_hierarchy" ADD CONSTRAINT "company_hierarchy_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_companies_name" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_companies_created_by" ON "companies" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_company_departments_company" ON "company_departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_company_departments_name" ON "company_departments" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "idx_company_hierarchy_company" ON "company_hierarchy" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_company_hierarchy_employee" ON "company_hierarchy" USING btree ("employee_user_id");--> statement-breakpoint
CREATE INDEX "idx_company_hierarchy_manager" ON "company_hierarchy" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "idx_company_memberships_company_user" ON "company_memberships" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_company_memberships_user" ON "company_memberships" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "polling_agents" ADD CONSTRAINT "polling_agents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_polling_agent_company" ON "polling_agents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_polling_agent_account_type" ON "polling_agents" USING btree ("account_type");--> statement-breakpoint
ALTER TABLE "polling_agents" ADD CONSTRAINT "polling_agents_account_type_check" CHECK (account_type IN ('individual', 'company'));