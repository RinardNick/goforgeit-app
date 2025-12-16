-- Migration: Create PageView table
-- Purpose: Track page views for telemetry (privacy-first, no PII, no IP addresses)
-- Date: November 7, 2025

-- Create PageView table
CREATE TABLE IF NOT EXISTS "PageView" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL REFERENCES "VisitorSession"(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  referrer TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "timeOnPage" INTEGER, -- in seconds
  "scrollDepth" INTEGER, -- percentage (0-100)
  engaged BOOLEAN NOT NULL DEFAULT false
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_page_view_session ON "PageView"("sessionId");
CREATE INDEX IF NOT EXISTS idx_page_view_timestamp ON "PageView"(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_page_view_url ON "PageView"(url);
CREATE INDEX IF NOT EXISTS idx_page_view_engaged ON "PageView"(engaged) WHERE engaged = true;
