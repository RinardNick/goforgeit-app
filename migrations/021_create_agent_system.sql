-- Migration 021: Custom Visual Agent Builder System
-- Description: Creates tables for agent configurations, sessions, messages, traces, and evaluations
-- Date: November 28, 2025

-- Create enum for agent types
DO $$ BEGIN
  CREATE TYPE agent_type AS ENUM ('simple', 'sequential', 'parallel', 'router', 'loop');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for session status
DO $$ BEGIN
  CREATE TYPE agent_session_status AS ENUM ('active', 'completed', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for message roles
DO $$ BEGIN
  CREATE TYPE agent_message_role AS ENUM ('user', 'agent', 'tool', 'system');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for trace event types
DO $$ BEGIN
  CREATE TYPE agent_trace_event_type AS ENUM ('start', 'tool_call', 'agent_switch', 'complete', 'error', 'llm_call', 'llm_response');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for evaluation run status
DO $$ BEGIN
  CREATE TYPE agent_eval_status AS ENUM ('running', 'passed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Agent configurations table
CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type agent_type NOT NULL DEFAULT 'simple',
  config JSONB NOT NULL DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_configs
CREATE INDEX IF NOT EXISTS idx_agent_configs_user_id ON agent_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_configs_type ON agent_configs(type);
CREATE INDEX IF NOT EXISTS idx_agent_configs_is_published ON agent_configs(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_agent_configs_created_at ON agent_configs(created_at DESC);

-- Agent sessions (chat conversations)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_configs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES "User"(id) ON DELETE CASCADE,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  status agent_session_status DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_sessions
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_created_at ON agent_sessions(created_at DESC);

-- Session messages
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role agent_message_role NOT NULL,
  agent_name VARCHAR(255),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_messages
CREATE INDEX IF NOT EXISTS idx_agent_messages_session_id ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_role ON agent_messages(role);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at ON agent_messages(created_at);

-- Execution traces (debugging)
CREATE TABLE IF NOT EXISTS agent_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agent_configs(id) ON DELETE CASCADE,
  event_type agent_trace_event_type NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_traces
CREATE INDEX IF NOT EXISTS idx_agent_traces_session_id ON agent_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_message_id ON agent_traces(message_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_event_type ON agent_traces(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created_at ON agent_traces(created_at);

-- Evaluations definition
CREATE TABLE IF NOT EXISTS agent_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agent_configs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  test_cases JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_evaluations
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_agent_id ON agent_evaluations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_created_at ON agent_evaluations(created_at DESC);

-- Evaluation runs
CREATE TABLE IF NOT EXISTS agent_evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES agent_evaluations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agent_configs(id) ON DELETE CASCADE,
  status agent_eval_status DEFAULT 'running',
  results JSONB,
  score DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for agent_evaluation_runs
CREATE INDEX IF NOT EXISTS idx_agent_evaluation_runs_evaluation_id ON agent_evaluation_runs(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_agent_evaluation_runs_agent_id ON agent_evaluation_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_evaluation_runs_status ON agent_evaluation_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_evaluation_runs_created_at ON agent_evaluation_runs(created_at DESC);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE agent_configs TO admin_app;
GRANT ALL PRIVILEGES ON TABLE agent_sessions TO admin_app;
GRANT ALL PRIVILEGES ON TABLE agent_messages TO admin_app;
GRANT ALL PRIVILEGES ON TABLE agent_traces TO admin_app;
GRANT ALL PRIVILEGES ON TABLE agent_evaluations TO admin_app;
GRANT ALL PRIVILEGES ON TABLE agent_evaluation_runs TO admin_app;

-- Comments for documentation
COMMENT ON TABLE agent_configs IS 'Agent configuration definitions (simple, sequential, parallel, router, loop)';
COMMENT ON COLUMN agent_configs.config IS 'Full agent configuration as JSONB (model, tools, systemInstruction, etc.)';
COMMENT ON COLUMN agent_configs.is_published IS 'Whether agent is available via external API';
COMMENT ON TABLE agent_sessions IS 'Chat sessions/conversations with agents';
COMMENT ON TABLE agent_messages IS 'Individual messages within agent sessions';
COMMENT ON TABLE agent_traces IS 'Execution traces for debugging agent behavior';
COMMENT ON COLUMN agent_traces.duration_ms IS 'Execution duration in milliseconds';
COMMENT ON TABLE agent_evaluations IS 'Test case definitions for evaluating agent performance';
COMMENT ON TABLE agent_evaluation_runs IS 'Results from running evaluations against agents';
