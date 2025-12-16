-- Migration: Add columns for extended multi-scene video workflow
-- Purpose: Support generating images per scene, videos per scene, and stitching them together
-- This enables longer videos beyond the 8-second Veo 3 limit

ALTER TABLE post_videos
  ADD COLUMN IF NOT EXISTS scene_images JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scene_videos JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'script_only',
  ADD COLUMN IF NOT EXISTS reference_image_url TEXT;

-- Add comment explaining generation_status values
COMMENT ON COLUMN post_videos.generation_status IS
  'Tracks multi-step video generation progress: script_only, images_generated, videos_generated, stitched';

-- Add comment explaining scene_images structure
COMMENT ON COLUMN post_videos.scene_images IS
  'JSONB structure: {"1": { "url": "gs://...", "generatedAt": "..." }, "2": {...}}';

-- Add comment explaining scene_videos structure
COMMENT ON COLUMN post_videos.scene_videos IS
  'JSONB structure: {"1": { "url": "gs://...", "duration": 8, "generatedAt": "..." }, "2": {...}}';

-- Add comment explaining reference_image_url
COMMENT ON COLUMN post_videos.reference_image_url IS
  'URL of Scene 1 image (stored for metadata). NOTE: Actual generation uses ALL previous scenes as references, not just Scene 1. Scene 2 uses image 1, Scene 3 uses images 2+1, Scene 4 uses images 3+2+1, etc.';
