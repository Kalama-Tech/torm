#!/bin/bash
set -e

echo "🔧 Formatting, linting, and building Python SDK..."

# Format with black
echo "📝 Formatting with black..."
black toonstore examples

# Lint with ruff
echo "🔍 Linting with ruff..."
ruff check toonstore examples

# Type check with mypy
echo "🔎 Type checking with mypy..."
mypy toonstore

# Run tests
echo "🧪 Running tests..."
pytest -v

# Build package
echo "📦 Building package..."
python -m build

echo "✅ All checks passed!"
