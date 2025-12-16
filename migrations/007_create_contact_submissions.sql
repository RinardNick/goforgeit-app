-- Migration: Create ContactSubmission table
-- Purpose: Store contact form submissions from main website
-- Date: January 7, 2025

-- Create enum for submission status
CREATE TYPE contact_submission_status AS ENUM ('new', 'read', 'archived');

-- Create ContactSubmission table
CREATE TABLE IF NOT EXISTS "ContactSubmission" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status contact_submission_status NOT NULL DEFAULT 'new',
  "sessionId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contact_submission_status ON "ContactSubmission"(status);
CREATE INDEX IF NOT EXISTS idx_contact_submission_email ON "ContactSubmission"(email);
CREATE INDEX IF NOT EXISTS idx_contact_submission_created_at ON "ContactSubmission"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submission_session ON "ContactSubmission"("sessionId");
