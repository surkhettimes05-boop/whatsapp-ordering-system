#!/usr/bin/env node

/**
 * Check if setup is complete
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking setup...\n');

let issues = [];

// Check .env file
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  issues.push('❌ .env file not found. Run: cp .env.example .env');
} else {
  console.log('✅ .env file exists');
}

// Check node_modules
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  issues.push('❌ node_modules not found. Run: npm install');
} else {
  console.log('✅ node_modules exists');
  
  // Check key dependencies
  const deps = ['axios', 'express', '@prisma/client'];
  deps.forEach(dep => {
    if (fs.existsSync(path.join(__dirname, 'node_modules', dep))) {
      console.log(`✅ ${dep} installed`);
    } else {
      issues.push(`❌ ${dep} not installed. Run: npm install`);
    }
  });
}

// Check Prisma Client
if (!fs.existsSync(path.join(__dirname, 'node_modules', '@prisma', 'client'))) {
  issues.push('❌ Prisma Client not generated. Run: npx prisma generate');
} else {
  console.log('✅ Prisma Client generated');
}

// Check database migrations
const migrationsPath = path.join(__dirname, 'prisma', 'migrations');
if (fs.existsSync(migrationsPath)) {
  const migrations = fs.readdirSync(migrationsPath);
  if (migrations.length > 0) {
    console.log(`✅ Database migrations found (${migrations.length})`);
  } else {
    issues.push('⚠️  No migrations found. Run: npx prisma migrate dev');
  }
} else {
  issues.push('⚠️  Migrations directory not found');
}

console.log('\n' + '='.repeat(50));

if (issues.length > 0) {
  console.log('\n⚠️  Setup Issues Found:\n');
  issues.forEach(issue => console.log(issue));
  console.log('\n📖 See QUICK_START.md for help\n');
  process.exit(1);
} else {
  console.log('\n✅ Setup looks good! You can start the server with: npm run dev\n');
  process.exit(0);
}

