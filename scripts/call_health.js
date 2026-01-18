(async () => {
  try {
    const mod = await import('../src/controllers/health.controller.js');
    const healthController = mod.default || mod;

    // Mock req/res
    const req = {};
    const res = {
      _status: 200,
      status(code) { this._status = code; return this; },
      json(obj) { console.log('HEALTH_RESPONSE', this._status || 200, JSON.stringify(obj, null, 2)); }
    };

    await healthController.getHealth(req, res);
    process.exit(0);
  } catch (e) {
    console.error('CALL_HEALTH_ERROR', e);
    process.exit(1);
  }
})();
