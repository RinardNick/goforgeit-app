-- Migration: Create post_images table
-- Purpose: Store metadata for generated images associated with blog posts
-- File storage: Cloud Storage (prod) / already implemented via image generation API

CREATE TABLE IF NOT EXISTS post_images (
  id SERIAL PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES "Post"(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  generated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Index for faster queries by post_id
  CONSTRAINT idx_post_images_post_id UNIQUE (post_id, url)
);

CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_post_images_created_at ON post_images(created_at DESC);
