CREATE TABLE "online_rooms" (
	"id" text PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"host_hash" text NOT NULL,
	"guest_hash" text,
	"state" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"increment_ms" integer NOT NULL,
	"initial_ms" integer NOT NULL,
	"host_seen" bigint NOT NULL,
	"guest_seen" bigint,
	"expires_at" bigint NOT NULL
);
