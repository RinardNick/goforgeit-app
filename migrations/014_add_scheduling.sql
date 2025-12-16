-- Migration: Add scheduling support to posts
-- Purpose: Enable posts to be scheduled for future publication
-- Date: November 16, 2025

-- Add SCHEDULED status to post_status enum
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- Add scheduledFor column to Post table
ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP WITH TIME ZONE;

-- Create index on scheduledFor for efficient querying of scheduled posts
CREATE INDEX IF NOT EXISTS idx_posts_scheduled
  ON "Post"("scheduledFor");
