-- AlterEnum: generic CLOUD discovery source for cloud connector upserts
DO $$ BEGIN
  ALTER TYPE "DiscoverySource" ADD VALUE 'CLOUD';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
