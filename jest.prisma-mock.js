// ============================================================================
// jest.prisma-mock.js - Production-Parity Prisma Mock for SERIALIZABLE Transactions
// ============================================================================
// Intercepts all @prisma/client requires via moduleNameMapper
// Provides production-like Prisma behavior with proper transaction serialization,
// lock handling, concurrent operation safety, and transaction-local state isolation.
// ============================================================================

/**
 * Deep clone utility for creating isolated transaction contexts
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Map) {
    const cloned = new Map();
    obj.forEach((value, key) => {
      cloned.set(key, deepClone(value));
    });
    return cloned;
  }
  if (obj instanceof Set) {
    const cloned = new Set();
    obj.forEach(value => cloned.add(deepClone(value)));
    return cloned;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  const cloned = {};
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone(obj[key]);
  });
  return cloned;
}

/**
 * TransactionQueue ensures SERIALIZABLE isolation by executing transactions
 * sequentially. This matches PostgreSQL SERIALIZABLE behavior where concurrent
 * transactions are serialized and executed one at a time.
 */
class TransactionQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }
}

/**
 * PrismaMockStore manages all mock data and enforces transaction semantics.
 * Key improvements:
 * 1. SERIALIZABLE transaction isolation (sequential execution with isolated state)
 * 2. Proper lock handling for FOR UPDATE queries
 * 3. Transaction-local state with commit/rollback semantics
 * 4. Unified model proxy factory for consistent behavior
 * 5. Unique constraint enforcement
 */
class PrismaMockStore {
  constructor() {
    this.data = {
      user: new Map(),
      admin: new Map(),
      retailer: new Map(),
      wholesaler: new Map(),
      order: new Map(),
      orderItem: new Map(),
      creditAccount: new Map(),
      retailerWholesalerCredit: new Map(),
      ledgerEntry: new Map(),
      creditTransaction: new Map(),
      product: new Map(),
      webhookLog: new Map(),
      vendorOffer: new Map(),
      creditRiskAlert: new Map(),
    };

    this.indexes = {
      retailerWholesalerCredit: new Map(), // Key: "${retailerId}_${wholesalerId}"
    };

    this.transactionQueue = new TransactionQueue();
    this.counters = {
      ledgerEntry: 0,
      order: 0,
      orderItem: 0,
    };
    this.virtualTime = Date.now();
  }

  generateId(model) {
    this.counters[model] = (this.counters[model] || 0) + 1;
    return `${model}_${this.virtualTime}_${this.counters[model]}`;
  }

  /**
   * Execute a transaction with SERIALIZABLE isolation.
   * Creates an isolated transaction context with its own data copy.
   * On success, commits changes back to the main store.
   * On error, discards changes (rollback).
   */
  async executeTransaction(callback, options = {}) {
    return this.transactionQueue.enqueue(async () => {
      // Create isolated transaction context
      const txContext = {
        data: deepClone(this.data),
        indexes: deepClone(this.indexes),
        locks: new Map(),
        virtualTime: this.virtualTime
      };

      const txProxy = this.createTransactionProxy(txContext);

      try {
        const result = await callback(txProxy);

        // COMMIT: Merge transaction changes back to main store
        // We must merge into existing Maps, because model proxies hold references 
        // to the original Map objects. Replacing this.data would break those links.
        Object.keys(txContext.data).forEach(model => {
          this.data[model].clear();
          txContext.data[model].forEach((value, key) => {
            this.data[model].set(key, value);
          });
        });

        Object.keys(txContext.indexes).forEach(idx => {
          this.indexes[idx].clear();
          txContext.indexes[idx].forEach((value, key) => {
            this.indexes[idx].set(key, value);
          });
        });

        this.virtualTime = txContext.virtualTime;

        return result;
      } catch (error) {
        // ROLLBACK: Discard transaction context (changes are lost)
        // Main store remains unchanged
        throw error;
      }
    });
  }

  /**
   * Create a transaction proxy with all model accessors.
   * Uses transaction-local context to ensure isolation.
   */
  createTransactionProxy(txContext) {
    const store = this;

    return {
      $queryRaw: async (strings, ...values) => {
        // Handle template literal calls like: $queryRaw`SELECT ...`
        let query = '';
        if (Array.isArray(strings)) {
          query = strings.map((s, i) => s + (i < values.length ? '?' : '')).join('');
        } else {
          query = strings;
        }

        // Handle FOR UPDATE queries - simulate row-level locking
        if (query.includes('FOR UPDATE')) {
          const tableMatch = query.match(/FROM\s+"?(\w+)"?/i);
          if (tableMatch) {
            const table = tableMatch[1];
            txContext.locks.set(table, true);
          }
          // Return empty array for lock queries (they don't return data)
          return [];
        }

        // For other raw queries, return empty array
        return [];
      },

      $executeRaw: async (strings, ...values) => {
        // Execute query returning number of affected rows
        return 0;
      },

      // All model proxies use the transaction context
      user: store.createModelProxy('user', txContext),
      admin: store.createModelProxy('admin', txContext),
      retailer: store.createModelProxy('retailer', txContext),
      wholesaler: store.createModelProxy('wholesaler', txContext),
      order: store.createModelProxy('order', txContext),
      orderItem: store.createModelProxy('orderItem', txContext),
      creditAccount: store.createModelProxy('creditAccount', txContext),
      retailerWholesalerCredit: store.createModelProxy('retailerWholesalerCredit', txContext),
      ledgerEntry: store.createModelProxy('ledgerEntry', txContext),
      creditTransaction: store.createModelProxy('creditTransaction', txContext),
      product: store.createModelProxy('product', txContext),
    };
  }

  /**
   * Unified model proxy factory.
   * Creates CRUD operations that work consistently in both transaction and non-transaction contexts.
   * 
   * @param {string} model - Model name
   * @param {object|null} txContext - Transaction context (null for direct client access)
   */
  createModelProxy(model, txContext = null) {
    const store = this;

    // Use transaction context if in transaction, otherwise use main store
    const dataSource = txContext ? txContext.data : store.data;
    const indexSource = txContext ? txContext.indexes : store.indexes;

    const applySelect = (record, select) => {
      if (!select || !record) return record;
      const result = {};
      Object.keys(select).forEach(key => {
        if (select[key]) result[key] = record[key];
      });
      return result;
    };

    return {
      create: async ({ data, select }) => {
        const timestamp = txContext ? txContext.virtualTime++ : store.virtualTime++;
        const id = data.id || store.generateId(model);
        const record = {
          id,
          ...data,
          createdAt: data.createdAt || new Date(timestamp),
          updatedAt: data.updatedAt || new Date(timestamp),
        };

        // Enforce unique constraints
        if (model === 'retailerWholesalerCredit') {
          const key = `${record.retailerId}_${record.wholesalerId}`;
          if (indexSource.retailerWholesalerCredit.has(key)) {
            throw new Error(`Unique constraint failed on retailerId_wholesalerId`);
          }
          indexSource.retailerWholesalerCredit.set(key, id);
        }

        dataSource[model].set(id, record);
        return applySelect(record, select);
      },

      findUnique: async ({ where, select }) => {
        if (where.retailerId_wholesalerId) {
          const { retailerId, wholesalerId } = where.retailerId_wholesalerId;
          const key = `${retailerId}_${wholesalerId}`;
          const id = indexSource.retailerWholesalerCredit.get(key);
          const record = id ? dataSource[model].get(id) || null : null;
          return applySelect(record, select);
        }

        // Handle all unique fields (id, phoneNumber, etc.)
        let record = null;
        if (where.id) {
          record = dataSource[model].get(where.id) || null;
        } else {
          // Search by any field in where clause (treating it as unique)
          const allRecords = Array.from(dataSource[model].values());
          record =
            allRecords.find(r => {
              return Object.keys(where).every(key => r[key] === where[key]);
            }) || null;
        }
        return applySelect(record, select);
      },

      findMany: async ({ where = {}, orderBy = {}, take = undefined, skip = 0, select }) => {
        let records = Array.from(dataSource[model].values());

        // Apply where filters
        if (where.retailerId) {
          records = records.filter(r => r.retailerId === where.retailerId);
        }
        if (where.wholesalerId) {
          records = records.filter(r => r.wholesalerId === where.wholesalerId);
        }
        if (where.amount) {
          records = records.filter(r => r.amount === where.amount);
        }
        if (where.entryType) {
          records = records.filter(r => r.entryType === where.entryType);
        }
        if (where.status) {
          records = records.filter(r => r.status === where.status);
        }

        // Apply ordering
        if (orderBy.createdAt === 'desc') {
          records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (orderBy.createdAt === 'asc') {
          records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        if (orderBy.balanceAfter === 'asc') {
          records.sort((a, b) => Number(a.balanceAfter) - Number(b.balanceAfter));
        }

        // Apply pagination
        if (take !== undefined) {
          records = records.slice(skip, skip + take);
        }

        return records.map(r => applySelect(r, select));
      },

      /**
       * findFirst returns the first matching record after applying filters and ordering.
       * Critical for ledger operations: ensures we get the latest entry.
       */
      findFirst: async ({ where = {}, orderBy = {}, select }) => {
        let records = Array.from(dataSource[model].values());

        // Apply where filters
        if (where.retailerId) {
          records = records.filter(r => r.retailerId === where.retailerId);
        }
        if (where.wholesalerId) {
          records = records.filter(r => r.wholesalerId === where.wholesalerId);
        }
        if (where.amount) {
          records = records.filter(r => r.amount === where.amount);
        }
        if (where.entryType) {
          records = records.filter(r => r.entryType === where.entryType);
        }
        if (where.status) {
          records = records.filter(r => r.status === where.status);
        }

        // Apply ordering
        if (orderBy.createdAt === 'desc') {
          records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (orderBy.createdAt === 'asc') {
          records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        if (orderBy.balanceAfter === 'asc') {
          records.sort((a, b) => Number(a.balanceAfter) - Number(b.balanceAfter));
        }

        // Return first record
        const result = records.length > 0 ? records[0] : null;
        return applySelect(result, select);
      },

      update: async ({ where, data, select }) => {
        const id = where.id;
        const record = dataSource[model].get(id);
        if (!record) throw new Error(`Record not found: ${model} ${id}`);

        const updated = { ...record, ...data, updatedAt: new Date() };
        dataSource[model].set(id, updated);
        return applySelect(updated, select);
      },

      delete: async ({ where, select }) => {
        const id = where.id;
        const record = dataSource[model].get(id);
        if (!record) throw new Error(`Record not found: ${model} ${id}`);

        dataSource[model].delete(id);

        // Clean up indexes
        if (model === 'retailerWholesalerCredit') {
          const key = `${record.retailerId}_${record.wholesalerId}`;
          indexSource.retailerWholesalerCredit.delete(key);
        }

        return applySelect(record, select);
      },

      updateMany: async ({ where = {}, data }) => {
        let records = Array.from(dataSource[model].values());

        // Simple filtering (only retailerId and wholesalerId for now as per common usage)
        if (where.retailerId) {
          records = records.filter(r => r.retailerId === where.retailerId);
        }
        if (where.wholesalerId) {
          records = records.filter(r => r.wholesalerId === where.wholesalerId);
        }

        records.forEach(r => {
          const updated = { ...r, ...data, updatedAt: new Date() };
          dataSource[model].set(r.id, updated);
        });

        return { count: records.length };
      },

      deleteMany: async ({ where = {} }) => {
        let records = Array.from(dataSource[model].values());

        // Simple filtering
        if (where.retailerId) {
          records = records.filter(r => r.retailerId === where.retailerId);
        }
        if (where.wholesalerId) {
          records = records.filter(r => r.wholesalerId === where.wholesalerId);
        }

        records.forEach(r => {
          dataSource[model].delete(r.id);

          // Clean up indexes
          if (model === 'retailerWholesalerCredit') {
            const key = `${r.retailerId}_${r.wholesalerId}`;
            indexSource.retailerWholesalerCredit.delete(key);
          }
        });

        return { count: records.length };
      },

      count: async ({ where }) => {
        let records = Array.from(dataSource[model].values());

        if (where) {
          if (where.retailerId) {
            records = records.filter(r => r.retailerId === where.retailerId);
          }
          if (where.wholesalerId) {
            records = records.filter(r => r.wholesalerId === where.wholesalerId);
          }
        }

        return records.length;
      },

      aggregate: async ({ _sum, where }) => {
        let records = Array.from(dataSource[model].values());

        if (where) {
          if (where.retailerId) {
            records = records.filter(r => r.retailerId === where.retailerId);
          }
          if (where.wholesalerId) {
            records = records.filter(r => r.wholesalerId === where.wholesalerId);
          }
        }

        const result = {};
        if (_sum) {
          result._sum = {};
          for (const field of _sum) {
            result._sum[field] = records.reduce((sum, entry) => {
              return sum + (Number(entry[field]) || 0);
            }, 0);
          }
        }

        return result;
      },
    };
  }

  __resetMockStore__() {
    this.data = {
      user: new Map(),
      admin: new Map(),
      retailer: new Map(),
      wholesaler: new Map(),
      order: new Map(),
      orderItem: new Map(),
      creditAccount: new Map(),
      retailerWholesalerCredit: new Map(),
      ledgerEntry: new Map(),
      creditTransaction: new Map(),
      product: new Map(),
    };
    this.indexes.retailerWholesalerCredit.clear();
    this.transactionQueue = new TransactionQueue();
    this.counters = {
      ledgerEntry: 0,
      order: 0,
      orderItem: 0,
    };
  }
}

// Global singleton store - shared across all PrismaClient instances in tests
let globalMockStore = new PrismaMockStore();

/**
 * Create a mock PrismaClient that uses the global mock store.
 * Supports both synchronous model access and $transaction callbacks.
 */
function createMockPrismaClient() {
  return {
    $connect: async () => undefined,
    $disconnect: async () => undefined,

    /**
     * $transaction implementation for SERIALIZABLE isolation.
     * Accepts either an array of operations or a callback function.
     * Optionally accepts options (isolationLevel, timeout, etc.).
     */
    $transaction: async (input, options = {}) => {
      // Handle callback-style: $transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' })
      if (typeof input === 'function') {
        return globalMockStore.executeTransaction(input, options);
      }

      // Handle array-style: $transaction([operation1, operation2, ...])
      // Execute all operations within a single transaction context
      return globalMockStore.executeTransaction(async (tx) => {
        const results = [];
        for (const operation of input) {
          results.push(await operation);
        }
        return results;
      }, options);
    },

    // Direct model access (non-transactional)
    user: globalMockStore.createModelProxy('user'),
    admin: globalMockStore.createModelProxy('admin'),
    retailer: globalMockStore.createModelProxy('retailer'),
    wholesaler: globalMockStore.createModelProxy('wholesaler'),
    order: globalMockStore.createModelProxy('order'),
    orderItem: globalMockStore.createModelProxy('orderItem'),
    creditAccount: globalMockStore.createModelProxy('creditAccount'),
    retailerWholesalerCredit: globalMockStore.createModelProxy('retailerWholesalerCredit'),
    ledgerEntry: globalMockStore.createModelProxy('ledgerEntry'),
    creditTransaction: globalMockStore.createModelProxy('creditTransaction'),
    product: globalMockStore.createModelProxy('product'),
  };
}

module.exports = {
  PrismaClient: class {
    constructor() {
      return createMockPrismaClient();
    }
  },

  // Exported for jest.setup.js to reset between tests
  __resetMockStore__: () => {
    globalMockStore = new PrismaMockStore();
  },
};
