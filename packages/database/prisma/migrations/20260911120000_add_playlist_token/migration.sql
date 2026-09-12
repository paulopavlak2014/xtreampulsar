-- AlterTable: Add playlistToken for Xtream URLs (separate from login password)
ALTER TABLE "users" ADD COLUMN "playlistToken" TEXT;

-- Generate unique playlistToken for existing users
UPDATE "users" SET "playlistToken" = encode(gen_random_bytes(16), 'hex') WHERE "playlistToken" IS NULL;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS "users_playlistToken_key" ON "users"("playlistToken");
