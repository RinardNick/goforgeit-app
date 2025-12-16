-- Migration: Create VisitorSession table
-- Purpose: Track anonymous visitor sessions for telemetry (privacy-first, no PII)
-- Date: November 7, 2025

-- Create VisitorSession table
CREATE TABLE IF NOT EXISTS "VisitorSession" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionStart" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sessionEnd" TIMESTAMP,
  referrer TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "userAgent" TEXT,
  "identifiedEmail" TEXT,
  "identifiedName" TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_visitor_session_start ON "VisitorSession"("sessionStart" DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_session_identified_email ON "VisitorSession"("identifiedEmail");
CREATE INDEX IF NOT EXISTS idx_visitor_session_utm_source ON "VisitorSession"("utmSource");
