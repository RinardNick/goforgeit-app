-- Migration: Create post_podcasts table
-- Purpose: Store metadata and scripts for generated podcasts associated with blog posts
-- Audio files will be stored in Cloud Storage (prod) / local filesystem (dev)

CREATE TABLE IF NOT EXISTS post_podcasts (
  id SERIAL PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES "Post"(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  script_data JSONB NOT NULL,
  generated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Index for faster queries by post_id
  CONSTRAINT idx_post_podcasts_post_id UNIQUE (post_id, url)
);

CREATE INDEX IF NOT EXISTS idx_post_podcasts_post_id ON post_podcasts(post_id);
CREATE INDEX IF NOT EXISTS idx_post_podcasts_created_at ON post_podcasts(created_at DESC);
