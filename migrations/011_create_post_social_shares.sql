-- Migration 011: Create post_social_shares table
-- Tracks social media sharing of blog posts to LinkedIn and X (Twitter)

CREATE TABLE IF NOT EXISTS post_social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES "Post"(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'linkedin' or 'x'
  share_text TEXT NOT NULL, -- The actual text that was posted
  share_url TEXT, -- URL to the social media post (populated after successful publishing)
  status VARCHAR(50) NOT NULL, -- 'pending', 'published', 'failed'
  error_message TEXT, -- Error message if publishing failed
  shared_at TIMESTAMP WITH TIME ZONE, -- When the post was successfully shared
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_post_social_shares_post_id ON post_social_shares(post_id);
CREATE INDEX IF NOT EXISTS idx_post_social_shares_platform ON post_social_shares(platform);
CREATE INDEX IF NOT EXISTS idx_post_social_shares_status ON post_social_shares(status);

-- Add a unique constraint to prevent duplicate shares
-- (one share per post per platform)
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_social_shares_unique
  ON post_social_shares(post_id, platform);

-- Comment on table
COMMENT ON TABLE post_social_shares IS 'Tracks blog post sharing to social media platforms (LinkedIn and X)';
COMMENT ON COLUMN post_social_shares.platform IS 'Social media platform: linkedin or x';
COMMENT ON COLUMN post_social_shares.status IS 'Publishing status: pending, published, or failed';
COMMENT ON COLUMN post_social_shares.share_url IS 'URL to the published social media post';
