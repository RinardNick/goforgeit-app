-- Migration: Add LinkedIn email to User table
-- Purpose: Store the LinkedIn profile email separately from the Google account email
-- This allows proper association of LinkedIn accounts with users

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "linkedin_email" TEXT;

COMMENT ON COLUMN "User"."linkedin_email" IS 'Email address from LinkedIn profile (may differ from Google account email)';
