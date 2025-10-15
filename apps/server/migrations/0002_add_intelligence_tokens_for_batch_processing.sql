CREATE TABLE "intelligence_tokens" (
	"id" varchar PRIMARY KEY NOT NULL,
	"organization_id" varchar NOT NULL,
	"text" text NOT NULL,
	"topics" jsonb DEFAULT '[]' NOT NULL,
	"sentiment" varchar DEFAULT 'neutral' NOT NULL,
	"category" varchar DEFAULT 'observation' NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"confidence" integer DEFAULT 70 NOT NULL,
	"submitters" jsonb DEFAULT '[]' NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"related_email_ids" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "trust_confirmation_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar NOT NULL,
	"action" varchar NOT NULL,
	"inviter_user_id" varchar NOT NULL,
	"target_user_id" varchar NOT NULL,
	"project_name" varchar,
	"email_subject" varchar,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "trust_confirmation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_linked_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"provider_account_id" varchar,
	"email" varchar,
	"is_active" boolean DEFAULT true,
	"linked_at" timestamp DEFAULT now(),
	"last_used" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_provider" UNIQUE("user_id","provider","provider_account_id")
);
--> statement-breakpoint
ALTER TABLE "email_attachments" ADD COLUMN "content" text;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "new_task_alerts" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "project_updates" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "task_status_changes" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "task_assignments" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "task_due_reminders" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "weekly_digest" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_confirmation_tokens" ADD CONSTRAINT "trust_confirmation_tokens_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_confirmation_tokens" ADD CONSTRAINT "trust_confirmation_tokens_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_linked_accounts" ADD CONSTRAINT "user_linked_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_token_org" ON "intelligence_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_token_topics" ON "intelligence_tokens" USING btree ("topics");--> statement-breakpoint
CREATE INDEX "idx_token_sentiment" ON "intelligence_tokens" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "idx_token_category" ON "intelligence_tokens" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_token_priority" ON "intelligence_tokens" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_token_active" ON "intelligence_tokens" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_token_created" ON "intelligence_tokens" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_password_reset_token" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_password_reset_user_id" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_expires_at" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_trust_token" ON "trust_confirmation_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_trust_inviter" ON "trust_confirmation_tokens" USING btree ("inviter_user_id");--> statement-breakpoint
CREATE INDEX "idx_trust_target" ON "trust_confirmation_tokens" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_trust_expires_at" ON "trust_confirmation_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_trust_action" ON "trust_confirmation_tokens" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_linked_accounts_user_id" ON "user_linked_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_linked_accounts_provider" ON "user_linked_accounts" USING btree ("provider","provider_account_id");