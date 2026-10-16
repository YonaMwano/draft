CREATE TABLE "online_rooms" (
	"id" uuid PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"white_seat" uuid NOT NULL,
	"black_seat" uuid,
	"status" text DEFAULT 'waiting' NOT NULL,
	"pieces" jsonb NOT NULL,
	"history" jsonb NOT NULL,
	"turn" text DEFAULT 'white' NOT NULL,
	"winner" text,
	"reason" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"initial_ms" integer NOT NULL,
	"increment_ms" integer NOT NULL,
	"white_ms" integer NOT NULL,
	"black_ms" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
