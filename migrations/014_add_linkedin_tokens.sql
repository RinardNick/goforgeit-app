-- Migration: Add LinkedIn OAuth tokens to User table
-- Purpose: Store LinkedIn access tokens for social media publishing
-- Date: November 15, 2025
-- Epic 1, Story 1.2: Database Schema for LinkedIn Tokens

-- Add LinkedIn OAuth columns
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "linkedin_access_token" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedin_refresh_token" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedin_token_expires_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "linkedin_person_id" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN "User"."linkedin_access_token" IS 'LinkedIn OAuth 2.0 access token for publishing';
COMMENT ON COLUMN "User"."linkedin_refresh_token" IS 'LinkedIn OAuth 2.0 refresh token';
COMMENT ON COLUMN "User"."linkedin_token_expires_at" IS 'Expiry timestamp for LinkedIn access token (2 months from issue)';
COMMENT ON COLUMN "User"."linkedin_person_id" IS 'LinkedIn person URN (e.g., urn:li:person:12345)';
