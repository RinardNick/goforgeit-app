-- Migration: Add lastSeenAt column to VisitorSession table for real-time analytics
-- Story 2.1: User Can View Real-Time Visitor Sessions

-- Add lastSeenAt column to track when user was last active
ALTER TABLE "VisitorSession"
ADD COLUMN "lastSeenAt" TIMESTAMP;

-- Set lastSeenAt to sessionStart for existing records
UPDATE "VisitorSession"
SET "lastSeenAt" = "sessionStart"
WHERE "lastSeenAt" IS NULL;

-- Make lastSeenAt NOT NULL after backfilling
ALTER TABLE "VisitorSession"
ALTER COLUMN "lastSeenAt" SET NOT NULL;

-- Set default to CURRENT_TIMESTAMP for new records
ALTER TABLE "VisitorSession"
ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Add index on lastSeenAt for efficient active session queries
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen
  ON "VisitorSession"("lastSeenAt" DESC);

-- Add index on sessionId for PageView queries
CREATE INDEX IF NOT EXISTS idx_page_views_session_id
  ON "PageView"("sessionId");
