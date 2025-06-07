#!/bin/bash

# UI Components startup script
echo "Starting UI Components..."

# Change to service directory
cd "$(dirname "$0")"

# Export environment variables
export NODE_ENV=${NODE_ENV:-development}
export PORT=${PORT:-3001}
export VITE_PORT=${PORT:-3001}
export VITE_GATEWAY_URL=${VITE_GATEWAY_URL:-http://localhost:4000/graphql}
export VITE_GATEWAY_WS_URL=${VITE_GATEWAY_WS_URL:-ws://localhost:4000/graphql}

# Start the service
exec npm run dev -- --port $PORT --host