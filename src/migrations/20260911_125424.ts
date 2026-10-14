import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('fr', 'en');
  CREATE TYPE "public"."enum_interpellations_timeline_state" AS ENUM('done', 'current', 'upcoming');
  CREATE TYPE "public"."enum_interpellations_default_messages_channel_type" AS ENUM('email', 'twitter', 'instagram', 'phone');
  CREATE TYPE "public"."enum_interpellations_status" AS ENUM('draft', 'upcoming', 'active', 'archived');
  CREATE TYPE "public"."enum_petitions_status" AS ENUM('draft', 'upcoming', 'active', 'archived');
  CREATE TYPE "public"."enum_campaign_targets_channels_type" AS ENUM('email', 'twitter', 'instagram', 'phone');
  CREATE TYPE "public"."enum_magic_links_intent_type" AS ENUM('login', 'interpellation-submission', 'petition-signature');
  CREATE TABLE "admins_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "admins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "organizations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"short_name" varchar,
  	"color" varchar,
  	"logo_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "organizations_locales" (
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "interpellations_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"state" "enum_interpellations_timeline_state" DEFAULT 'upcoming' NOT NULL
  );
  
  CREATE TABLE "interpellations_timeline_locales" (
  	"label" varchar,
  	"date_label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "interpellations_default_messages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel_type" "enum_interpellations_default_messages_channel_type" NOT NULL
  );
  
  CREATE TABLE "interpellations_default_messages_locales" (
  	"subject" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "interpellations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"organization_id" integer NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_interpellations_status" DEFAULT 'draft' NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"photo_id" integer,
  	"submission_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "interpellations_locales" (
  	"title" varchar,
  	"tagline" varchar,
  	"context" jsonb,
  	"demand" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "petitions_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"threshold" numeric NOT NULL
  );
  
  CREATE TABLE "petitions_tiers_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "petitions_additional_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"required" boolean DEFAULT false
  );
  
  CREATE TABLE "petitions_additional_fields_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "petitions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"organization_id" integer NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_petitions_status" DEFAULT 'draft' NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"photo_id" integer,
  	"signature_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "petitions_locales" (
  	"title" varchar,
  	"tagline" varchar,
  	"text" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "campaign_targets_channels_feedback_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "campaign_targets_channels_feedback_fields_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "campaign_targets_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_campaign_targets_channels_type" NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "campaign_targets_channels_locales" (
  	"message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "campaign_targets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"campaign_id" integer NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"full_name" varchar,
  	"role" varchar NOT NULL,
  	"political_group" varchar,
  	"district" varchar,
  	"external_ref" varchar,
  	"submission_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaign_targets_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "interpellation_submissions_feedback" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "interpellation_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"citizen_id" integer NOT NULL,
  	"target_id" integer NOT NULL,
  	"campaign_id" integer NOT NULL,
  	"channel_id" varchar NOT NULL,
  	"channel_type" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "petition_signatures_responses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "petition_signatures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"citizen_id" integer NOT NULL,
  	"petition_id" integer NOT NULL,
  	"city" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "citizens_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "citizens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"pseudo" varchar NOT NULL,
  	"email_verified" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "magic_links" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"intent_type" "enum_magic_links_intent_type" DEFAULT 'login' NOT NULL,
  	"intent_payload" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" integer,
  	"media_id" integer,
  	"organizations_id" integer,
  	"interpellations_id" integer,
  	"petitions_id" integer,
  	"campaign_targets_id" integer,
  	"interpellation_submissions_id" integer,
  	"petition_signatures_id" integer,
  	"citizens_id" integer,
  	"magic_links_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" integer,
  	"citizens_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "admins_sessions" ADD CONSTRAINT "admins_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "organizations" ADD CONSTRAINT "organizations_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "organizations_locales" ADD CONSTRAINT "organizations_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpellations_timeline" ADD CONSTRAINT "interpellations_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."interpellations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpellations_timeline_locales" ADD CONSTRAINT "interpellations_timeline_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."interpellations_timeline"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpellations_default_messages" ADD CONSTRAINT "interpellations_default_messages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."interpellations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpellations_default_messages_locales" ADD CONSTRAINT "interpellations_default_messages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."interpellations_default_messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpellations" ADD CONSTRAINT "interpellations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "interpellations" ADD CONSTRAINT "interpellations_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "interpellations_locales" ADD CONSTRAINT "interpellations_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."interpellations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "petitions_tiers" ADD CONSTRAINT "petitions_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."petitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "petitions_tiers_locales" ADD CONSTRAINT "petitions_tiers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."petitions_tiers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "petitions_additional_fields" ADD CONSTRAINT "petitions_additional_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."petitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "petitions_additional_fields_locales" ADD CONSTRAINT "petitions_additional_fields_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."petitions_additional_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "petitions" ADD CONSTRAINT "petitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "petitions" ADD CONSTRAINT "petitions_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "petitions_locales" ADD CONSTRAINT "petitions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."petitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaign_targets_channels_feedback_fields" ADD CONSTRAINT "campaign_targets_channels_feedback_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaign_targets_channels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaign_targets_channels_feedback_fields_locales" ADD CONSTRAINT "campaign_targets_channels_feedback_fields_locales_parent__fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaign_targets_channels_feedback_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaign_targets_channels" ADD CONSTRAINT "campaign_targets_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaign_targets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaign_targets_channels_locales" ADD CONSTRAINT "campaign_targets_channels_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaign_targets_channels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_campaign_id_interpellations_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."interpellations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_targets_texts" ADD CONSTRAINT "campaign_targets_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."campaign_targets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpellation_submissions_feedback" ADD CONSTRAINT "interpellation_submissions_feedback_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."interpellation_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "interpellation_submissions" ADD CONSTRAINT "interpellation_submissions_citizen_id_citizens_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."citizens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "interpellation_submissions" ADD CONSTRAINT "interpellation_submissions_target_id_campaign_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."campaign_targets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "interpellation_submissions" ADD CONSTRAINT "interpellation_submissions_campaign_id_interpellations_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."interpellations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "petition_signatures_responses" ADD CONSTRAINT "petition_signatures_responses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."petition_signatures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "petition_signatures" ADD CONSTRAINT "petition_signatures_citizen_id_citizens_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."citizens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "petition_signatures" ADD CONSTRAINT "petition_signatures_petition_id_petitions_id_fk" FOREIGN KEY ("petition_id") REFERENCES "public"."petitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "citizens_sessions" ADD CONSTRAINT "citizens_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."citizens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_organizations_fk" FOREIGN KEY ("organizations_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_interpellations_fk" FOREIGN KEY ("interpellations_id") REFERENCES "public"."interpellations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_petitions_fk" FOREIGN KEY ("petitions_id") REFERENCES "public"."petitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_targets_fk" FOREIGN KEY ("campaign_targets_id") REFERENCES "public"."campaign_targets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_interpellation_submissions_fk" FOREIGN KEY ("interpellation_submissions_id") REFERENCES "public"."interpellation_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_petition_signatures_fk" FOREIGN KEY ("petition_signatures_id") REFERENCES "public"."petition_signatures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_citizens_fk" FOREIGN KEY ("citizens_id") REFERENCES "public"."citizens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_magic_links_fk" FOREIGN KEY ("magic_links_id") REFERENCES "public"."magic_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_citizens_fk" FOREIGN KEY ("citizens_id") REFERENCES "public"."citizens"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "admins_sessions_order_idx" ON "admins_sessions" USING btree ("_order");
  CREATE INDEX "admins_sessions_parent_id_idx" ON "admins_sessions" USING btree ("_parent_id");
  CREATE INDEX "admins_updated_at_idx" ON "admins" USING btree ("updated_at");
  CREATE INDEX "admins_created_at_idx" ON "admins" USING btree ("created_at");
  CREATE UNIQUE INDEX "admins_email_idx" ON "admins" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");
  CREATE INDEX "organizations_logo_idx" ON "organizations" USING btree ("logo_id");
  CREATE INDEX "organizations_updated_at_idx" ON "organizations" USING btree ("updated_at");
  CREATE INDEX "organizations_created_at_idx" ON "organizations" USING btree ("created_at");
  CREATE UNIQUE INDEX "organizations_locales_locale_parent_id_unique" ON "organizations_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "interpellations_timeline_order_idx" ON "interpellations_timeline" USING btree ("_order");
  CREATE INDEX "interpellations_timeline_parent_id_idx" ON "interpellations_timeline" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "interpellations_timeline_locales_locale_parent_id_unique" ON "interpellations_timeline_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "interpellations_default_messages_order_idx" ON "interpellations_default_messages" USING btree ("_order");
  CREATE INDEX "interpellations_default_messages_parent_id_idx" ON "interpellations_default_messages" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "interpellations_default_messages_locales_locale_parent_id_un" ON "interpellations_default_messages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "interpellations_organization_idx" ON "interpellations" USING btree ("organization_id");
  CREATE INDEX "interpellations_slug_idx" ON "interpellations" USING btree ("slug");
  CREATE INDEX "interpellations_status_idx" ON "interpellations" USING btree ("status");
  CREATE INDEX "interpellations_photo_idx" ON "interpellations" USING btree ("photo_id");
  CREATE INDEX "interpellations_submission_count_idx" ON "interpellations" USING btree ("submission_count");
  CREATE INDEX "interpellations_updated_at_idx" ON "interpellations" USING btree ("updated_at");
  CREATE INDEX "interpellations_created_at_idx" ON "interpellations" USING btree ("created_at");
  CREATE UNIQUE INDEX "interpellations_locales_locale_parent_id_unique" ON "interpellations_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "petitions_tiers_order_idx" ON "petitions_tiers" USING btree ("_order");
  CREATE INDEX "petitions_tiers_parent_id_idx" ON "petitions_tiers" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "petitions_tiers_locales_locale_parent_id_unique" ON "petitions_tiers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "petitions_additional_fields_order_idx" ON "petitions_additional_fields" USING btree ("_order");
  CREATE INDEX "petitions_additional_fields_parent_id_idx" ON "petitions_additional_fields" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "petitions_additional_fields_locales_locale_parent_id_unique" ON "petitions_additional_fields_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "petitions_organization_idx" ON "petitions" USING btree ("organization_id");
  CREATE INDEX "petitions_slug_idx" ON "petitions" USING btree ("slug");
  CREATE INDEX "petitions_status_idx" ON "petitions" USING btree ("status");
  CREATE INDEX "petitions_photo_idx" ON "petitions" USING btree ("photo_id");
  CREATE INDEX "petitions_signature_count_idx" ON "petitions" USING btree ("signature_count");
  CREATE INDEX "petitions_updated_at_idx" ON "petitions" USING btree ("updated_at");
  CREATE INDEX "petitions_created_at_idx" ON "petitions" USING btree ("created_at");
  CREATE UNIQUE INDEX "petitions_locales_locale_parent_id_unique" ON "petitions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "campaign_targets_channels_feedback_fields_order_idx" ON "campaign_targets_channels_feedback_fields" USING btree ("_order");
  CREATE INDEX "campaign_targets_channels_feedback_fields_parent_id_idx" ON "campaign_targets_channels_feedback_fields" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "campaign_targets_channels_feedback_fields_locales_locale_par" ON "campaign_targets_channels_feedback_fields_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "campaign_targets_channels_order_idx" ON "campaign_targets_channels" USING btree ("_order");
  CREATE INDEX "campaign_targets_channels_parent_id_idx" ON "campaign_targets_channels" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "campaign_targets_channels_locales_locale_parent_id_unique" ON "campaign_targets_channels_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "campaign_targets_campaign_idx" ON "campaign_targets" USING btree ("campaign_id");
  CREATE INDEX "campaign_targets_last_name_idx" ON "campaign_targets" USING btree ("last_name");
  CREATE INDEX "campaign_targets_full_name_idx" ON "campaign_targets" USING btree ("full_name");
  CREATE INDEX "campaign_targets_political_group_idx" ON "campaign_targets" USING btree ("political_group");
  CREATE INDEX "campaign_targets_district_idx" ON "campaign_targets" USING btree ("district");
  CREATE INDEX "campaign_targets_external_ref_idx" ON "campaign_targets" USING btree ("external_ref");
  CREATE INDEX "campaign_targets_submission_count_idx" ON "campaign_targets" USING btree ("submission_count");
  CREATE INDEX "campaign_targets_updated_at_idx" ON "campaign_targets" USING btree ("updated_at");
  CREATE INDEX "campaign_targets_created_at_idx" ON "campaign_targets" USING btree ("created_at");
  CREATE INDEX "campaign_targets_texts_order_parent" ON "campaign_targets_texts" USING btree ("order","parent_id");
  CREATE INDEX "interpellation_submissions_feedback_order_idx" ON "interpellation_submissions_feedback" USING btree ("_order");
  CREATE INDEX "interpellation_submissions_feedback_parent_id_idx" ON "interpellation_submissions_feedback" USING btree ("_parent_id");
  CREATE INDEX "interpellation_submissions_citizen_idx" ON "interpellation_submissions" USING btree ("citizen_id");
  CREATE INDEX "interpellation_submissions_target_idx" ON "interpellation_submissions" USING btree ("target_id");
  CREATE INDEX "interpellation_submissions_campaign_idx" ON "interpellation_submissions" USING btree ("campaign_id");
  CREATE INDEX "interpellation_submissions_updated_at_idx" ON "interpellation_submissions" USING btree ("updated_at");
  CREATE INDEX "interpellation_submissions_created_at_idx" ON "interpellation_submissions" USING btree ("created_at");
  CREATE INDEX "petition_signatures_responses_order_idx" ON "petition_signatures_responses" USING btree ("_order");
  CREATE INDEX "petition_signatures_responses_parent_id_idx" ON "petition_signatures_responses" USING btree ("_parent_id");
  CREATE INDEX "petition_signatures_citizen_idx" ON "petition_signatures" USING btree ("citizen_id");
  CREATE INDEX "petition_signatures_petition_idx" ON "petition_signatures" USING btree ("petition_id");
  CREATE INDEX "petition_signatures_updated_at_idx" ON "petition_signatures" USING btree ("updated_at");
  CREATE INDEX "petition_signatures_created_at_idx" ON "petition_signatures" USING btree ("created_at");
  CREATE INDEX "citizens_sessions_order_idx" ON "citizens_sessions" USING btree ("_order");
  CREATE INDEX "citizens_sessions_parent_id_idx" ON "citizens_sessions" USING btree ("_parent_id");
  CREATE INDEX "citizens_updated_at_idx" ON "citizens" USING btree ("updated_at");
  CREATE INDEX "citizens_created_at_idx" ON "citizens" USING btree ("created_at");
  CREATE UNIQUE INDEX "citizens_email_idx" ON "citizens" USING btree ("email");
  CREATE INDEX "magic_links_email_idx" ON "magic_links" USING btree ("email");
  CREATE UNIQUE INDEX "magic_links_token_hash_idx" ON "magic_links" USING btree ("token_hash");
  CREATE INDEX "magic_links_updated_at_idx" ON "magic_links" USING btree ("updated_at");
  CREATE INDEX "magic_links_created_at_idx" ON "magic_links" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_admins_id_idx" ON "payload_locked_documents_rels" USING btree ("admins_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_organizations_id_idx" ON "payload_locked_documents_rels" USING btree ("organizations_id");
  CREATE INDEX "payload_locked_documents_rels_interpellations_id_idx" ON "payload_locked_documents_rels" USING btree ("interpellations_id");
  CREATE INDEX "payload_locked_documents_rels_petitions_id_idx" ON "payload_locked_documents_rels" USING btree ("petitions_id");
  CREATE INDEX "payload_locked_documents_rels_campaign_targets_id_idx" ON "payload_locked_documents_rels" USING btree ("campaign_targets_id");
  CREATE INDEX "payload_locked_documents_rels_interpellation_submissions_idx" ON "payload_locked_documents_rels" USING btree ("interpellation_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_petition_signatures_id_idx" ON "payload_locked_documents_rels" USING btree ("petition_signatures_id");
  CREATE INDEX "payload_locked_documents_rels_citizens_id_idx" ON "payload_locked_documents_rels" USING btree ("citizens_id");
  CREATE INDEX "payload_locked_documents_rels_magic_links_id_idx" ON "payload_locked_documents_rels" USING btree ("magic_links_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_admins_id_idx" ON "payload_preferences_rels" USING btree ("admins_id");
  CREATE INDEX "payload_preferences_rels_citizens_id_idx" ON "payload_preferences_rels" USING btree ("citizens_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "admins_sessions" CASCADE;
  DROP TABLE "admins" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "organizations" CASCADE;
  DROP TABLE "organizations_locales" CASCADE;
  DROP TABLE "interpellations_timeline" CASCADE;
  DROP TABLE "interpellations_timeline_locales" CASCADE;
  DROP TABLE "interpellations_default_messages" CASCADE;
  DROP TABLE "interpellations_default_messages_locales" CASCADE;
  DROP TABLE "interpellations" CASCADE;
  DROP TABLE "interpellations_locales" CASCADE;
  DROP TABLE "petitions_tiers" CASCADE;
  DROP TABLE "petitions_tiers_locales" CASCADE;
  DROP TABLE "petitions_additional_fields" CASCADE;
  DROP TABLE "petitions_additional_fields_locales" CASCADE;
  DROP TABLE "petitions" CASCADE;
  DROP TABLE "petitions_locales" CASCADE;
  DROP TABLE "campaign_targets_channels_feedback_fields" CASCADE;
  DROP TABLE "campaign_targets_channels_feedback_fields_locales" CASCADE;
  DROP TABLE "campaign_targets_channels" CASCADE;
  DROP TABLE "campaign_targets_channels_locales" CASCADE;
  DROP TABLE "campaign_targets" CASCADE;
  DROP TABLE "campaign_targets_texts" CASCADE;
  DROP TABLE "interpellation_submissions_feedback" CASCADE;
  DROP TABLE "interpellation_submissions" CASCADE;
  DROP TABLE "petition_signatures_responses" CASCADE;
  DROP TABLE "petition_signatures" CASCADE;
  DROP TABLE "citizens_sessions" CASCADE;
  DROP TABLE "citizens" CASCADE;
  DROP TABLE "magic_links" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_interpellations_timeline_state";
  DROP TYPE "public"."enum_interpellations_default_messages_channel_type";
  DROP TYPE "public"."enum_interpellations_status";
  DROP TYPE "public"."enum_petitions_status";
  DROP TYPE "public"."enum_campaign_targets_channels_type";
  DROP TYPE "public"."enum_magic_links_intent_type";`)
}
