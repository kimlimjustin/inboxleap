CREATE TABLE "company_agent_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"agent_type" varchar(50) NOT NULL,
	"default_settings" jsonb DEFAULT '{}'::jsonb,
	"is_enabled" boolean DEFAULT true,
	"max_instances" integer DEFAULT 5,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "company_agent_settings_company_agent_unique" UNIQUE("company_id","agent_type")
);
--> statement-breakpoint
CREATE TABLE "company_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"inviter_user_id" varchar NOT NULL,
	"invitee_email" varchar NOT NULL,
	"invitee_user_id" varchar,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"department" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"invitation_token" varchar NOT NULL,
	"message" text,
	"expires_at" timestamp NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "company_invitations_invitation_token_unique" UNIQUE("invitation_token"),
	CONSTRAINT "unique_company_invitation" UNIQUE("company_id","invitee_email")
);
--> statement-breakpoint
ALTER TABLE "company_agent_emails" DROP CONSTRAINT "company_agent_emails_company_agent_unique";--> statement-breakpoint
ALTER TABLE "company_agent_emails" ADD COLUMN "instance_name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "company_agent_emails" ADD COLUMN "inherit_company_settings" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "company_agent_emails" ADD COLUMN "allow_global_emails" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "company_agent_settings" ADD CONSTRAINT "company_agent_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_agent_settings" ADD CONSTRAINT "company_agent_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_agent_settings_company_agent" ON "company_agent_settings" USING btree ("company_id","agent_type");--> statement-breakpoint
CREATE INDEX "idx_company_invitations_company" ON "company_invitations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_company_invitations_email" ON "company_invitations" USING btree ("invitee_email");--> statement-breakpoint
CREATE INDEX "idx_company_invitations_token" ON "company_invitations" USING btree ("invitation_token");--> statement-breakpoint
CREATE INDEX "idx_company_invitations_status" ON "company_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_company_agent_emails_instance" ON "company_agent_emails" USING btree ("company_id","agent_type","instance_name");--> statement-breakpoint
ALTER TABLE "company_agent_emails" ADD CONSTRAINT "company_agent_emails_company_agent_instance_unique" UNIQUE("company_id","agent_type","instance_name");