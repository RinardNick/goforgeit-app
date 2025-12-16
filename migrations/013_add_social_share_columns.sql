-- Migration: Add social media share tracking to Post table
-- Purpose: Track which platforms a post has been shared to
-- Date: November 14, 2025

ALTER TABLE "Post"
ADD COLUMN IF NOT EXISTS "sharedOnLinkedIn" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "sharedOnX" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "linkedInShareDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "xShareDate" TIMESTAMP;
