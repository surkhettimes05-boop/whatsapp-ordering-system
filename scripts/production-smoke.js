#!/usr/bin/env node
require('dotenv').config();

const base = String(process.env.SMOKE_BASE_URL || process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
if (!/^https:\/\//i.test(base)) {
  console.error('SMOKE_BASE_URL or PUBLIC_BASE_URL must be a deployed HTTPS URL');
  process.exit(1);
}

async function json(path, options) {
  const response = await fetch(base + path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}: ${body.error || JSON.stringify(body)}`);
  return body;
}

(async () => {
  const health = await json('/health/ready');
  if (health.status !== 'ready') throw new Error('Readiness endpoint did not report ready');

  const whatsapp = await json('/api/v1/whatsapp/test');
  if (whatsapp.provider !== 'meta' || !whatsapp.configured || !whatsapp.catalogConfigured) {
    throw new Error('Meta WhatsApp transport/catalog is not fully configured');
  }

  const providers = await json('/api/v1/shopping/payments/providers');
  const data = providers.data || providers;
  const online = data.online || [];
  if (!data.cod) throw new Error('COD is not enabled');
  if (String(process.env.REQUIRE_LIVE_PAYMENTS || 'true').toLowerCase() !== 'false') {
    for (const provider of ['khalti', 'esewa']) {
      if (!online.includes(provider)) throw new Error(`${provider} is not configured`);
    }
  }

  await json('/api/v1/commerce/categories');
  await json('/api/v1/commerce/catalog?limit=1');

  console.log(JSON.stringify({
    ok: true,
    base,
    checks: ['health', 'redis', 'database', 'meta-config', 'catalog', 'cod', ...online]
  }, null, 2));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
