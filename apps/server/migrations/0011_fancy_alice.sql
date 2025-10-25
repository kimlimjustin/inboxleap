CREATE TABLE "document_analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" varchar,
	"s3_key" varchar,
	"local_path" varchar,
	"content" text,
	"analysis_data" jsonb,
	"ai_analysis" jsonb NOT NULL,
	"processing_results" jsonb,
	"category" varchar,
	"confidence" integer,
	"extracted_text" text,
	"virus_scan_passed" boolean DEFAULT true,
	"processed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(20) NOT NULL,
	"user_id" varchar,
	"company_id" integer,
	"display_name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "identities_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "identities_company_id_unique" UNIQUE("company_id"),
	CONSTRAINT "identities_type_check" CHECK (type IN ('user', 'company')),
	CONSTRAINT "identities_identity_check" CHECK (
    (type = 'user' AND user_id IS NOT NULL AND company_id IS NULL) OR
    (type = 'company' AND company_id IS NOT NULL AND user_id IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "identity_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"identity_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"can_manage_agents" boolean DEFAULT false,
	"can_manage_projects" boolean DEFAULT true,
	"can_manage_tasks" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"granted_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_identity_user" UNIQUE("identity_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_session_context" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"current_identity_id" integer,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_session_context_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "agent_instances" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_instances" ADD COLUMN "identity_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "identity_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agent_instance_id" integer;--> statement-breakpoint
ALTER TABLE "document_analysis_results" ADD CONSTRAINT "document_analysis_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_access" ADD CONSTRAINT "identity_access_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_access" ADD CONSTRAINT "identity_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session_context" ADD CONSTRAINT "user_session_context_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session_context" ADD CONSTRAINT "user_session_context_current_identity_id_identities_id_fk" FOREIGN KEY ("current_identity_id") REFERENCES "public"."identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_document_analysis_user" ON "document_analysis_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_document_analysis_message" ON "document_analysis_results" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_document_analysis_category" ON "document_analysis_results" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_document_analysis_processed_at" ON "document_analysis_results" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "idx_identities_type" ON "identities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_identities_user" ON "identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_identities_company" ON "identities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_identity_access_identity_user" ON "identity_access" USING btree ("identity_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_identity_access_user" ON "identity_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_session_context_user" ON "user_session_context" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_session_context_identity" ON "user_session_context" USING btree ("current_identity_id");--> statement-breakpoint
ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_agent_instance_id_agent_instances_id_fk" FOREIGN KEY ("agent_instance_id") REFERENCES "public"."agent_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_instances_identity_agent" ON "agent_instances" USING btree ("identity_id","agent_type");--> statement-breakpoint
CREATE INDEX "idx_agent_instances_identity" ON "agent_instances" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "idx_projects_identity" ON "projects" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "idx_projects_agent_instance" ON "projects" USING btree ("agent_instance_id");--> statement-breakpoint
CREATE INDEX "idx_projects_created_by" ON "projects" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_projects_company" ON "projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_project" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_created_by" ON "tasks" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tasks_company" ON "tasks" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_identity_agent_instance_unique" UNIQUE("identity_id","agent_type","instance_name");