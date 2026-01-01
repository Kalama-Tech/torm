#!/bin/bash
set -e

echo "🔧 Formatting, linting, and building Node.js SDK..."

# Format with prettier
echo "📝 Formatting with prettier..."
npm run format

# Lint with ESLint
echo "🔍 Linting with ESLint..."
npm run lint

# Build with TypeScript
echo "🏗️ Building with TypeScript..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

echo "✅ All checks passed!"
