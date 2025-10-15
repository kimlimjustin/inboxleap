CREATE TABLE "user_agent_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"agent_type" varchar(50) NOT NULL,
	"instance_name" varchar(100) NOT NULL,
	"email_address" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"customization" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_agent_emails_email_address_unique" UNIQUE("email_address"),
	CONSTRAINT "user_agent_emails_user_agent_instance_unique" UNIQUE("user_id","agent_type","instance_name")
);
--> statement-breakpoint
ALTER TABLE "user_agent_emails" ADD CONSTRAINT "user_agent_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_agent_emails_user_agent" ON "user_agent_emails" USING btree ("user_id","agent_type");--> statement-breakpoint
CREATE INDEX "idx_user_agent_emails_email" ON "user_agent_emails" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "idx_user_agent_emails_agent_type" ON "user_agent_emails" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "idx_user_agent_emails_instance" ON "user_agent_emails" USING btree ("user_id","agent_type","instance_name");