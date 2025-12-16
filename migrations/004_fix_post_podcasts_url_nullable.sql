-- Migration 004: Fix post_podcasts.url column to be nullable
-- The url column should allow NULL since podcasts are generated as scripts first,
-- and audio URLs are added later (when we implement actual audio generation)

-- First, check if the table exists and alter it
DO $$
BEGIN
    -- Drop the NOT NULL constraint if it exists
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'post_podcasts'
        AND column_name = 'url'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE post_podcasts ALTER COLUMN url DROP NOT NULL;
    END IF;
END $$;
