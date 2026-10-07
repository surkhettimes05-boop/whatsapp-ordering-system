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
  if (online.length) throw new Error('Online payments must remain disabled');

  await json('/api/v1/commerce/categories');
  const catalog = await json('/api/v1/commerce/catalog?limit=50');
  if (!catalog.data?.products?.some(product => product.availableUnits > 0)) throw new Error('No stocked products are available');
  const zone = await json('/api/v1/shopping/serviceability?query=' + encodeURIComponent(process.env.SMOKE_SERVICE_AREA || 'Birendranagar'));
  if (!zone.data?.serviceable) throw new Error('Pilot delivery area is not serviceable');

  console.log(JSON.stringify({
    ok: true,
    base,
    checks: ['health', 'redis', 'database', 'meta-config', 'catalog', 'cod', ...online]
  }, null, 2));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
