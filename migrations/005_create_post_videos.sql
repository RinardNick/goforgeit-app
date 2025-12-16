-- Migration: Create post_videos table
-- Purpose: Store metadata and scripts for generated videos associated with blog posts
-- Video files will be stored in Cloud Storage (when Veo 3 integration is added)

CREATE TABLE IF NOT EXISTS post_videos (
  id SERIAL PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES "Post"(id) ON DELETE CASCADE,
  url TEXT,
  script_data JSONB NOT NULL,
  generated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Index for faster queries by post_id
  CONSTRAINT idx_post_videos_post_id UNIQUE (post_id, generated_at)
);

CREATE INDEX IF NOT EXISTS idx_post_videos_post_id ON post_videos(post_id);
CREATE INDEX IF NOT EXISTS idx_post_videos_created_at ON post_videos(created_at DESC);
