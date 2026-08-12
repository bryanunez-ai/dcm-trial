ALTER TABLE "invitations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "invitations" CASCADE;--> statement-breakpoint
DROP TABLE "team_members" CASCADE;--> statement-breakpoint
DROP TABLE "teams" CASCADE;--> statement-breakpoint
--> IF EXISTS added by hand. DROP TABLE "teams" CASCADE above has already removed every constraint
--> that depended on it, this one included, so drizzle's generated DROP CONSTRAINT fails with
--> "constraint ... does not exist" and takes the whole migration down with it.
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "activity_logs" DROP COLUMN "team_id";
