#!/bin/bash
set -e

echo "🔧 Formatting, linting, and building Go SDK..."

# Format code
echo "📝 Formatting with go fmt..."
go fmt ./...

# Vet code
echo "🔍 Vetting with go vet..."
go vet ./...

# Run tests
echo "🧪 Running tests..."
go test -v ./...

# Build
echo "🏗️ Building..."
go build ./...

echo "✅ All checks passed!"
