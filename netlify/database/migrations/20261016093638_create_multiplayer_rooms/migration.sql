CREATE TABLE "multiplayer_rooms" (
	"id" text PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"host_hash" text NOT NULL,
	"guest_hash" text,
	"time_control" text NOT NULL,
	"increment_ms" integer NOT NULL,
	"state" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"host_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"guest_seen" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
