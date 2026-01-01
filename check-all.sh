#!/bin/bash
# Run all SDK quality checks

set -e

echo "🔧 Running all SDK checks..."

echo ""
echo "📦 Python SDK"
echo "─────────────────────────────"
cd sdks/python
bash check.sh
cd ../..

echo ""
echo "📦 Node.js SDK"
echo "─────────────────────────────"
cd sdks/nodejs
bash check.sh
cd ../..

echo ""
echo "📦 Go SDK"
echo "─────────────────────────────"
cd sdks/go
bash check.sh
cd ../..

echo ""
echo "📦 PHP SDK"
echo "─────────────────────────────"
cd sdks/php
bash check.sh
cd ../..

echo ""
echo "✅ All SDK checks passed!"
