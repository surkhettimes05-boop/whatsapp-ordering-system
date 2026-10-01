const path = require('path');

function isHttps(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function assertProductionConfiguration(env = process.env) {
  if (env.NODE_ENV !== 'production') return { ok: true, skipped: true };

  const errors = [];
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CORS_ORIGIN',
    'PUBLIC_BASE_URL',
    'PUBLIC_SHOP_URL',
    'REDIS_URL',
    'META_GRAPH_VERSION',
    'META_WHATSAPP_PHONE_NUMBER_ID',
    'META_WHATSAPP_ACCESS_TOKEN',
    'META_WHATSAPP_VERIFY_TOKEN',
    'META_WHATSAPP_APP_SECRET',
    'META_CATALOG_ID',
    'CATALOG_FEED_TOKEN',
    'UPLOAD_DIR'
  ];

  for (const key of required) {
    if (!String(env[key] || '').trim()) errors.push(`${key} is required`);
  }

  if (String(env.JWT_SECRET || '').length < 32) errors.push('JWT_SECRET must be at least 32 characters');
  if (!isHttps(env.PUBLIC_BASE_URL)) errors.push('PUBLIC_BASE_URL must use HTTPS');
  if (!isHttps(env.PUBLIC_SHOP_URL)) errors.push('PUBLIC_SHOP_URL must use HTTPS');

  const cors = String(env.CORS_ORIGIN || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  if (!cors.length || cors.includes('*')) errors.push('CORS_ORIGIN must be an explicit comma-separated HTTPS allowlist');
  for (const origin of cors) {
    if (!isHttps(origin)) errors.push(`CORS_ORIGIN contains a non-HTTPS origin: ${origin}`);
  }

  if (!/^rediss?:\/\//i.test(String(env.REDIS_URL || ''))) {
    errors.push('REDIS_URL must be a redis:// or rediss:// connection string');
  }

  if (String(env.WHATSAPP_PROVIDER || '').toLowerCase() !== 'meta') {
    errors.push('WHATSAPP_PROVIDER must be meta in production');
  }
  if (!/^v\d+\.\d+$/.test(String(env.META_GRAPH_VERSION || ''))) {
    errors.push('META_GRAPH_VERSION must be an explicit Graph API version such as v26.0');
  }

  const uploadDir = String(env.UPLOAD_DIR || '');
  if (!path.isAbsolute(uploadDir)) errors.push('UPLOAD_DIR must be an absolute persistent-disk path');
  if (uploadDir && !uploadDir.startsWith('/var/data/') && !uploadDir.startsWith('/opt/render/project/src/')) {
    errors.push('UPLOAD_DIR must point to the configured persistent storage mount');
  }

  const requireLivePayments = String(env.REQUIRE_LIVE_PAYMENTS || 'true').toLowerCase() !== 'false';
  if (requireLivePayments) {
    if (String(env.KHALTI_ENV || '').toLowerCase() !== 'production') {
      errors.push('KHALTI_ENV must be production');
    }
    if (!String(env.KHALTI_SECRET_KEY || '').trim()) errors.push('KHALTI_SECRET_KEY is required');
    if (String(env.ESEWA_ENV || '').toLowerCase() !== 'production') {
      errors.push('ESEWA_ENV must be production');
    }
    if (!String(env.ESEWA_PRODUCT_CODE || '').trim()) errors.push('ESEWA_PRODUCT_CODE is required');
    if (!String(env.ESEWA_SECRET_KEY || '').trim()) errors.push('ESEWA_SECRET_KEY is required');
  }

  if (errors.length) {
    const error = new Error('Production configuration is not launch-ready:\n- ' + errors.join('\n- '));
    error.code = 'PRODUCTION_CONFIG_INVALID';
    error.details = errors;
    throw error;
  }

  return { ok: true, livePaymentsRequired: requireLivePayments };
}

module.exports = { assertProductionConfiguration };
