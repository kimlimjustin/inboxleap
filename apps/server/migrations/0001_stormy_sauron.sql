CREATE TABLE "email_opt_outs" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_opt_outs_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"email_notifications" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "polling_agent_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"polling_agent_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'participant' NOT NULL,
	"can_view_insights" boolean DEFAULT true,
	"can_view_detailed_analytics" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_agent_user" UNIQUE("polling_agent_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "polling_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"email_address" varchar NOT NULL,
	"command_prefix" varchar,
	"type" varchar DEFAULT 't5t' NOT NULL,
	"is_active" boolean DEFAULT true,
	"organization_id" varchar,
	"created_by" varchar NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "polling_agents_email_address_unique" UNIQUE("email_address")
);
--> statement-breakpoint
CREATE TABLE "polling_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"polling_agent_id" integer NOT NULL,
	"insight_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"data" jsonb NOT NULL,
	"scope" varchar NOT NULL,
	"period" varchar NOT NULL,
	"confidence" integer DEFAULT 80,
	"priority" varchar DEFAULT 'medium',
	"is_alert" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"last_viewed" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "t5t_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"polling_agent_id" integer NOT NULL,
	"submitter_user_id" varchar NOT NULL,
	"submitter_email" varchar NOT NULL,
	"message_id" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"raw_content" text NOT NULL,
	"parsed_items" jsonb DEFAULT '[]'::jsonb,
	"sentiment" varchar,
	"sentiment_score" integer,
	"topics" text[] DEFAULT '{}',
	"priority" varchar DEFAULT 'medium',
	"week_number" integer,
	"month_number" integer,
	"year_number" integer,
	"submission_date" timestamp NOT NULL,
	"processed_at" timestamp,
	"processing_status" varchar DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "t5t_submissions_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "user_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"department_name" varchar NOT NULL,
	"team_name" varchar,
	"role" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_dept" UNIQUE("user_id","department_name")
);
--> statement-breakpoint
CREATE TABLE "user_trust_relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"trusted_user_id" varchar NOT NULL,
	"trust_status" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_trust_relationship" UNIQUE("user_id","trusted_user_id"),
	CONSTRAINT "check_not_self_trust" CHECK (user_id != trusted_user_id)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" varchar DEFAULT 'google';--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polling_agent_participants" ADD CONSTRAINT "polling_agent_participants_polling_agent_id_polling_agents_id_fk" FOREIGN KEY ("polling_agent_id") REFERENCES "public"."polling_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polling_agent_participants" ADD CONSTRAINT "polling_agent_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polling_agents" ADD CONSTRAINT "polling_agents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polling_insights" ADD CONSTRAINT "polling_insights_polling_agent_id_polling_agents_id_fk" FOREIGN KEY ("polling_agent_id") REFERENCES "public"."polling_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t5t_submissions" ADD CONSTRAINT "t5t_submissions_polling_agent_id_polling_agents_id_fk" FOREIGN KEY ("polling_agent_id") REFERENCES "public"."polling_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "t5t_submissions" ADD CONSTRAINT "t5t_submissions_submitter_user_id_users_id_fk" FOREIGN KEY ("submitter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_trust_relationships" ADD CONSTRAINT "user_trust_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_trust_relationships" ADD CONSTRAINT "user_trust_relationships_trusted_user_id_users_id_fk" FOREIGN KEY ("trusted_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_user_id" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_participant" ON "polling_agent_participants" USING btree ("polling_agent_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_participant_user" ON "polling_agent_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_polling_agent_email" ON "polling_agents" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "idx_polling_agent_org" ON "polling_agents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_insight_agent" ON "polling_insights" USING btree ("polling_agent_id");--> statement-breakpoint
CREATE INDEX "idx_insight_type" ON "polling_insights" USING btree ("insight_type");--> statement-breakpoint
CREATE INDEX "idx_insight_period" ON "polling_insights" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_insight_priority" ON "polling_insights" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_insight_alert" ON "polling_insights" USING btree ("is_alert");--> statement-breakpoint
CREATE INDEX "idx_t5t_message_id" ON "t5t_submissions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_t5t_submitter" ON "t5t_submissions" USING btree ("submitter_user_id");--> statement-breakpoint
CREATE INDEX "idx_t5t_agent" ON "t5t_submissions" USING btree ("polling_agent_id");--> statement-breakpoint
CREATE INDEX "idx_t5t_date" ON "t5t_submissions" USING btree ("submission_date");--> statement-breakpoint
CREATE INDEX "idx_t5t_week" ON "t5t_submissions" USING btree ("week_number","year_number");--> statement-breakpoint
CREATE INDEX "idx_t5t_sentiment" ON "t5t_submissions" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "idx_t5t_processing_status" ON "t5t_submissions" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "idx_user_dept_user" ON "user_departments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_dept_dept" ON "user_departments" USING btree ("department_name");--> statement-breakpoint
CREATE INDEX "idx_user_dept_team" ON "user_departments" USING btree ("team_name");--> statement-breakpoint
CREATE INDEX "idx_trust_user_id" ON "user_trust_relationships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_trust_trusted_user_id" ON "user_trust_relationships" USING btree ("trusted_user_id");