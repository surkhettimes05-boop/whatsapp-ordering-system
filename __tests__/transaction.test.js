const { runSerializableTransaction } = require('../transaction');

describe('runSerializableTransaction', () => {
  test('retries on serialization failure and succeeds', async () => {
    let calls = 0;

    const fakePrisma = {
      $transaction: async (cb, opts) => {
        calls += 1;
        if (calls === 1) {
          const e = new Error('could not serialize access due to concurrent update');
          e.code = '40001';
          throw e;
        }
        // on retry, execute the callback
        return await cb({});
      }
    };

    const result = await runSerializableTransaction(fakePrisma, async (tx) => {
      // simple callback to represent transaction work
      return 'ok';
    }, { retries: 3, minDelayMs: 1 });

    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });
});
