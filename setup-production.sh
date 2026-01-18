#!/bin/bash
# PRODUCTION HARDENING - QUICK SETUP SCRIPT

echo "================================"
echo "🔒 PRODUCTION HARDENING SETUP"
echo "================================"
echo ""

# Step 1: Check node_modules excluded
echo "✓ Checking .gitignore..."
if grep -q "^node_modules/" .gitignore; then
    echo "  ✅ node_modules/ excluded from git"
else
    echo "  ❌ node_modules/ NOT in .gitignore"
    exit 1
fi

if grep -q "^.env$" .gitignore; then
    echo "  ✅ .env excluded from git"
else
    echo "  ❌ .env NOT in .gitignore"
    exit 1
fi

echo ""

# Step 2: Create .env from template
echo "✓ Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  ✅ Created .env from template"
    echo "  ⚠️  Please edit .env with your actual values"
else
    echo "  ✅ .env already exists"
fi

echo ""

# Step 3: Check middleware files
echo "✓ Checking middleware files..."
if [ -f src/middleware/errorHandler.middleware.js ]; then
    echo "  ✅ Error handler middleware found"
else
    echo "  ❌ Error handler middleware NOT found"
    exit 1
fi

if [ -f src/config/logger.js ]; then
    echo "  ✅ Logger configuration found"
else
    echo "  ❌ Logger configuration NOT found"
    exit 1
fi

echo ""

# Step 4: Create logs directory
echo "✓ Creating logs directory..."
mkdir -p logs
chmod 755 logs
echo "  ✅ Logs directory ready"

echo ""

# Step 5: Install dependencies
echo "✓ Installing dependencies..."
npm ci --production
echo "  ✅ Dependencies installed"

echo ""

# Step 6: Generate secure keys (optional)
echo "ℹ️  To generate secure keys, run:"
echo "  JWT_SECRET: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo "  WEBHOOK_TOKEN: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""

echo ""

# Step 7: Summary
echo "================================"
echo "✅ SETUP COMPLETE"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration"
echo "2. Run database migrations: npx prisma migrate deploy"
echo "3. Start server: NODE_ENV=production npm start"
echo "4. Verify: curl http://localhost:5000/health"
echo ""
echo "For details, see:"
echo "  - PRODUCTION_DEPLOYMENT.md (complete guide)"
echo "  - BACKEND_SETUP.md (quick start)"
echo "  - PRODUCTION_HARDENING_SUMMARY.md (implementation)"
echo ""
