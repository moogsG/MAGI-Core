#!/bin/bash
# Start server and capture Jira-related logs

echo "🚀 Starting MAGI server to test Jira connector..."
echo "   (Will run for 10 seconds to capture startup logs)"
echo ""

# Start server in background
bun packages/server/src/cli.ts > /tmp/magi-server.log 2>&1 &
SERVER_PID=$!

# Wait for startup
sleep 10

# Show Jira-related logs
echo "📋 Jira connector logs:"
grep -i "jira" /tmp/magi-server.log || echo "  No Jira logs found"

# Kill server
kill $SERVER_PID 2>/dev/null

echo ""
echo "✅ Test complete!"
