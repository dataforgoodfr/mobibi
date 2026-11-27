import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "campaigners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"oidc_issuer" varchar,
  	"oidc_subject" varchar,
  	"last_login_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaigner_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"campaigner_id" integer NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"oidc_sid" varchar,
  	"id_token" varchar,
  	"refresh_token" varchar,
  	"access_token_expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaigners_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaigner_sessions_id" integer;
  ALTER TABLE "campaigner_sessions" ADD CONSTRAINT "campaigner_sessions_campaigner_id_campaigners_id_fk" FOREIGN KEY ("campaigner_id") REFERENCES "public"."campaigners"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "campaigners_email_idx" ON "campaigners" USING btree ("email");
  CREATE INDEX "campaigners_updated_at_idx" ON "campaigners" USING btree ("updated_at");
  CREATE INDEX "campaigners_created_at_idx" ON "campaigners" USING btree ("created_at");
  CREATE INDEX "oidcIssuer_oidcSubject_idx" ON "campaigners" USING btree ("oidc_issuer","oidc_subject");
  CREATE INDEX "campaigner_sessions_campaigner_idx" ON "campaigner_sessions" USING btree ("campaigner_id");
  CREATE INDEX "campaigner_sessions_oidc_sid_idx" ON "campaigner_sessions" USING btree ("oidc_sid");
  CREATE INDEX "campaigner_sessions_updated_at_idx" ON "campaigner_sessions" USING btree ("updated_at");
  CREATE INDEX "campaigner_sessions_created_at_idx" ON "campaigner_sessions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaigners_fk" FOREIGN KEY ("campaigners_id") REFERENCES "public"."campaigners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaigner_sessions_fk" FOREIGN KEY ("campaigner_sessions_id") REFERENCES "public"."campaigner_sessions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_campaigners_id_idx" ON "payload_locked_documents_rels" USING btree ("campaigners_id");
  CREATE INDEX "payload_locked_documents_rels_campaigner_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("campaigner_sessions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // The rels go first: dropping the tables with CASCADE would already remove these constraints.
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaigners_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaigner_sessions_fk";
  DROP INDEX "payload_locked_documents_rels_campaigners_id_idx";
  DROP INDEX "payload_locked_documents_rels_campaigner_sessions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaigners_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaigner_sessions_id";
  DROP TABLE "campaigner_sessions" CASCADE;
  DROP TABLE "campaigners" CASCADE;`)
}
