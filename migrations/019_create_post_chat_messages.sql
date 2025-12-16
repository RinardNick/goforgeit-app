-- Create post_chat_messages table for chat persistence per post
CREATE TABLE IF NOT EXISTS post_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES "Post"(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'function')),
  content TEXT NOT NULL,
  function_call JSONB,
  function_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups by post_id
CREATE INDEX IF NOT EXISTS idx_post_chat_messages_post_id ON post_chat_messages(post_id);

-- Index for ordering messages by creation time
CREATE INDEX IF NOT EXISTS idx_post_chat_messages_created_at ON post_chat_messages(created_at);
