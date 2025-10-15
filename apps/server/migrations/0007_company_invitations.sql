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
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_invitations_company" ON "company_invitations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_company_invitations_email" ON "company_invitations" USING btree ("invitee_email");--> statement-breakpoint
CREATE INDEX "idx_company_invitations_token" ON "company_invitations" USING btree ("invitation_token");--> statement-breakpoint
CREATE INDEX "idx_company_invitations_status" ON "company_invitations" USING btree ("status");