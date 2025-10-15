CREATE TABLE "agent_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"agent_type" varchar(50) NOT NULL,
	"instance_name" varchar(100) NOT NULL,
	"email_address" varchar NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"customization" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agent_instances_email_address_unique" UNIQUE("email_address"),
	CONSTRAINT "agent_instances_user_agent_instance_unique" UNIQUE("user_id","agent_type","instance_name")
);
--> statement-breakpoint
ALTER TABLE "agent_instances" ADD CONSTRAINT "agent_instances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_instances_user_agent" ON "agent_instances" USING btree ("user_id","agent_type");--> statement-breakpoint
CREATE INDEX "idx_agent_instances_email" ON "agent_instances" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "idx_agent_instances_agent_type" ON "agent_instances" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "idx_agent_instances_default" ON "agent_instances" USING btree ("is_default");