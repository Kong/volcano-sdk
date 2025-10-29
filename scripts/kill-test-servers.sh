#!/bin/bash

# Kill any MCP test servers that may be left running
# Ports used by test suites:
# - 3201, 3202: volcano.e2e.test.ts
# - 3211, 3212: volcano.flow.test.ts
# - 3401, 3402: mcp.auth.test.ts
# - 3501: mcp.auth.client.test.ts
# - 3601, 3602: mcp.oauth.comprehensive.test.ts
# - 3701, 3702: mcp.agent.auth.test.ts

PORTS="3201,3202,3211,3212,3401,3402,3501,3601,3602,3701,3702"

echo "Checking for zombie MCP server processes on ports: $PORTS"

PIDS=$(lsof -ti:$PORTS 2>/dev/null)

if [ -z "$PIDS" ]; then
  echo "✅ No zombie processes found"
  exit 0
fi

echo "Found processes: $PIDS"
echo "Killing zombie MCP servers..."

kill -9 $PIDS 2>/dev/null

echo "✅ Zombie MCP servers killed"

