# CommonJS Conversion - Quick Reference

## ✅ Files Changed

### package.json
```json
{
  "type": "commonjs",
  "scripts": {
    "test": "NODE_OPTIONS=--experimental-vm-modules jest --verbose --runInBand",
    "test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch",
    "test:coverage": "NODE_OPTIONS=--experimental-vm-modules jest --coverage"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "express": "^4.18.2",
    "dotenv": "^16.6.1",
    ...all runtime deps...
  },
  "devDependencies": {
    "jest": "^30.2.0",
    "supertest": "^7.2.2",
    "prisma": "^5.22.0"
  }
}
```
**Changes**: Moved babel deps to devDeps, removed `"fs"` builtin

---

### jest.config.js (NEW)
```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: ['node_modules/(?!(@prisma/client)/)'],
  transform: {},  // No transformation - use native CommonJS
  testTimeout: 30000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
```

---

### babel.config.cjs
```javascript
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
        modules: false  // ← CHANGED FROM 'auto'
      }
    ]
  ]
};
```

---

### jest.setup.js
```javascript
require('dotenv').config({ path: '.env.test' });

// Mock @prisma/client for all tests
jest.mock('@prisma/client', () => {
  const mockClient = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn((fn) => Promise.resolve(fn({}))),
    // All Prisma models with CRUD mocks...
    user: { create: jest.fn(), findUnique: jest.fn(), ... },
    retailer: { create: jest.fn(), findUnique: jest.fn(), ... },
    order: { create: jest.fn(), findUnique: jest.fn(), ... },
    // etc...
  };
  return { PrismaClient: jest.fn(() => mockClient) };
});

afterEach(() => jest.clearAllMocks());
```

---

## 🎯 What This Fixes

| Issue | Fix |
|-------|-----|
| ESM/CommonJS mixing | Explicit `modules: false` in Babel |
| Jest + Prisma conflicts | Proper mock in `jest.setup.js` |
| Import errors in tests | `transformIgnorePatterns` for Prisma |
| Mock reset between tests | `clearMocks: true` + `afterEach` |
| Module format confusion | Removed Babel transformation |

---

## 🚀 How to Apply

```bash
# 1. Replace package.json content
# 2. Create jest.config.js
# 3. Update babel.config.cjs (modules: false)
# 4. Update jest.setup.js with Prisma mocks
# 5. Install dependencies
npm install

# 6. Run tests
npm test
```

---

## ✨ Expected Results

```
✓ All tests run with CommonJS imports
✓ Prisma client mocks work automatically
✓ No ESM/CommonJS warnings
✓ Fast test execution (no Babel transformation)
✓ Mock cleanup between tests (no pollution)
✓ Simple jest configuration
```

---

## Usage Example

```javascript
// __tests__/credit.test.js
const prisma = require('../src/config/database');
const creditService = require('../src/services/credit.service');

describe('Credit Service', () => {
  test('creates transaction', async () => {
    prisma.creditTransaction.create.mockResolvedValueOnce({
      id: '123',
      amount: 100
    });
    
    const result = await creditService.createTransaction({ amount: 100 });
    
    expect(result.id).toBe('123');
    expect(prisma.creditTransaction.create).toHaveBeenCalled();
  });
});
```

---

## Configuration Summary

| Setting | Value | Reason |
|---------|-------|--------|
| `"type"` | `"commonjs"` | Explicit module format |
| `testEnvironment` | `"node"` | Not jsdom |
| `transform` | `{}` | No Babel, keep native CommonJS |
| `testTimeout` | `30000ms` | DB operations may be slow |
| `clearMocks` | `true` | Auto-reset between tests |
| Babel `modules` | `false` | Preserve original format |

