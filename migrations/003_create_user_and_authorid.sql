-- Migration: Create User table and add authorId to Post table
-- Purpose: Complete database schema for proper post authorship tracking
-- Date: November 7, 2025

-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);

-- Add authorId column to Post table
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "authorId" UUID;

-- Add foreign key constraint
ALTER TABLE "Post"
  ADD CONSTRAINT fk_post_author
  FOREIGN KEY ("authorId")
  REFERENCES "User"(id)
  ON DELETE SET NULL;

-- Create index on authorId for faster queries
CREATE INDEX IF NOT EXISTS idx_post_author ON "Post"("authorId");

-- Insert default user for existing posts
INSERT INTO "User" (email, name, "createdAt", "updatedAt")
VALUES ('admin@nicholasrinard.com', 'Nicholas Rinard', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert test user for E2E tests
INSERT INTO "User" (email, name, "createdAt", "updatedAt")
VALUES ('test@example.com', 'Test User', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Update existing posts to have default author
UPDATE "Post"
SET "authorId" = (SELECT id FROM "User" WHERE email = 'admin@nicholasrinard.com')
WHERE "authorId" IS NULL;
