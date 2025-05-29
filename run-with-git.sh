#!/bin/bash

# Run both the Vite dev server and git server concurrently

echo "🚀 Starting Meta GOTHIC UI with Git integration..."
echo ""
echo "📦 Installing dependencies if needed..."
npm install

echo ""
echo "🔧 Starting services..."
echo "  - UI Dashboard: http://localhost:3001"
echo "  - Git Server: http://localhost:3003"
echo ""

# Use npm run dev:full which uses concurrently
npm run dev:full