const ledgerService = require('../../src/services/ledger.service');
const assert = require('assert');

// Mock Data
const entry = {
    idempotencyKey: 'test-key-123',
    retailerId: 'ret-1',
    wholesalerId: 'who-1',
    amount: 1000,
    entryType: 'DEBIT'
};

const previousHash = 'abc-123-genesis';

console.log('Testing LedgerService Hashing...');

// 1. Test Hash Generation
const hash1 = ledgerService.calculateHash(entry, previousHash);
console.log(`Hash 1: ${hash1}`);
assert.ok(hash1, 'Hash should be generated');
assert.strictEqual(hash1.length, 64, 'SHA-256 hash should be 64 chars');

// 2. Test Determinism
const hash2 = ledgerService.calculateHash(entry, previousHash);
assert.strictEqual(hash1, hash2, 'Hash should be deterministic');

// 3. Test Avalanche Effect (Change amount)
const entryModified = { ...entry, amount: 1001 };
const hash3 = ledgerService.calculateHash(entryModified, previousHash);
assert.notStrictEqual(hash1, hash3, 'Changing amount should change hash');

// 4. Test Avalanche Effect (Change previous hash)
const hash4 = ledgerService.calculateHash(entry, 'different-prev-hash');
assert.notStrictEqual(hash1, hash4, 'Changing previous hash should change hash');

console.log('✅ Ledger Hashing Tests Passed');
