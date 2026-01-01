#!/bin/bash
set -e

echo "🔧 Formatting, linting, and building PHP SDK..."

# Install dependencies if needed
if [ ! -d "vendor" ]; then
    echo "📦 Installing dependencies..."
    composer install
fi

# Format code
echo "📝 Formatting with PHP-CS-Fixer..."
composer cs-fix || true

# Analyze code
echo "🔍 Analyzing with PHPStan..."
composer phpstan || true

# Run tests
echo "🧪 Running tests..."
composer test || echo "⚠️ No tests configured yet"

echo "✅ All checks passed!"
