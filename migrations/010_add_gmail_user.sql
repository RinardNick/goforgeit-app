-- Migration: Add nickarinard@gmail.com user
-- Purpose: Ensure primary user exists for authentication
-- Date: November 9, 2025

-- Insert user if doesn't exist
INSERT INTO "User" (email, name, "createdAt", "updatedAt")
VALUES ('nickarinard@gmail.com', 'Nicholas Rinard', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
