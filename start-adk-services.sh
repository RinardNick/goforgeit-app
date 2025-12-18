#!/bin/bash
# Start ADK services (Web + Chat) in the background

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_DB="$SCRIPT_DIR/adk_sessions.db"

echo "🤖 Starting ADK services..."
echo ""

# Sync agents first
echo "📦 Syncing agents from Visual Builder..."
cd "$SCRIPT_DIR/adk-service"
./sync-agents.sh
cd "$SCRIPT_DIR"
echo ""

# Load DATABASE_URL from .env.local if available
DB_URL=""
if [ -f "$SCRIPT_DIR/.env.local" ]; then
  # Extract DATABASE_URL using grep and sed
  DB_URL=$(grep "^DATABASE_URL=" "$SCRIPT_DIR/.env.local" | cut -d'"' -f2)
fi

# Fallback to SQLite if no DB_URL
if [ -z "$DB_URL" ]; then
  SESSION_URI="sqlite:///$SESSION_DB"
  echo "ℹ️  Using SQLite session storage: $SESSION_DB"
else
  # ADK expects postgresql:// but some libs output postgres://
  # Ensure compatibility if needed, though ADK supports standard SQLAlchemy URIs
  # ADK v1.21+ uses async engine, so we need asyncpg driver
  SESSION_URI=$(echo "$DB_URL" | sed 's|^postgres://|postgresql+asyncpg://|' | sed 's|^postgresql://|postgresql+asyncpg://|')
  echo "ℹ️  Using PostgreSQL session storage"
fi

# Export MCP URL for builder_agent
export SYSTEM_TOOLS_MCP_URL="http://localhost:3025/api/mcp/system-tools/sse"

# Start ADK Web Service
echo "🌐 Starting ADK Web Service (port 8000)..."
adk web \
  --port=8000 \
  --allow_origins=http://localhost:3000 \
  --session_service_uri="$SESSION_URI" \
  --host=0.0.0.0 \
  adk-service/agents \
  > /tmp/adk-web.log 2>&1 &

ADK_WEB_PID=$!
echo "  ✓ ADK Web Service started (PID: $ADK_WEB_PID)"
echo "  📋 Logs: tail -f /tmp/adk-web.log"
sleep 2

cd "$SCRIPT_DIR"
echo ""
echo "✅ All ADK services started"
echo ""
echo "Quick Links:"
echo "  🤖 ADK Web:  http://localhost:8000"
echo "  💬 Chat:     http://localhost:8001"
echo "  💾 Sessions: $SESSION_DB"
echo ""
echo "To stop:"
echo "  make stop-adk"
echo ""
