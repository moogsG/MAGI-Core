#!/bin/bash

# Test MCP server connection with proper handshake
echo "Testing MCP server connection..."
echo ""

# Send initialize request with proper params
echo "1. Sending initialize request..."
(printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}\n' | \
  bun /Users/morgan.greff/workspace/MAGI-Core/packages/server/src/index.ts 2>&1 & \
  PID=$!; sleep 1; kill -TERM $PID 2>/dev/null; wait $PID 2>/dev/null) | \
  grep -v "stdio server started" | grep -v "SIGTERM"

echo ""
echo "2. Sending tools/list request..."
(printf '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","method":"tools/list","id":2}\n' | \
  bun /Users/morgan.greff/workspace/MAGI-Core/packages/server/src/index.ts 2>&1 & \
  PID=$!; sleep 1; kill -TERM $PID 2>/dev/null; wait $PID 2>/dev/null) | \
  grep "tools/list" -A5 | head -10

echo ""
echo "✅ If you see tool definitions above, the server is working correctly!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop to pick up the new server config"
echo "2. Check Claude Desktop -> Settings -> Developer -> MCP Servers"
echo "3. Look for 'mcp-local-tasks' server and verify it shows as connected"
