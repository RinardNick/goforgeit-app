-- Migration: Create base Post table
-- Purpose: Initial database schema for blog posts
-- Date: November 7, 2025

-- Create enum for post status
CREATE TYPE post_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Create Post table
CREATE TABLE IF NOT EXISTS "Post" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  "featuredImage" TEXT,
  status post_status NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_post_status ON "Post"(status);
CREATE INDEX IF NOT EXISTS idx_post_category ON "Post"(category);
CREATE INDEX IF NOT EXISTS idx_post_slug ON "Post"(slug);
CREATE INDEX IF NOT EXISTS idx_post_published_at ON "Post"("publishedAt");
