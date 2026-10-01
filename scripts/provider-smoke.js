#!/usr/bin/env node
require('dotenv').config();
const crypto = require('crypto');

const mode = String(process.env.SMOKE_MODE || 'connectivity').toLowerCase();
const required = [
  'META_GRAPH_VERSION',
  'META_WHATSAPP_PHONE_NUMBER_ID',
  'META_WHATSAPP_ACCESS_TOKEN',
  'PUBLIC_BASE_URL',
  'KHALTI_SECRET_KEY',
  'ESEWA_PRODUCT_CODE',
  'ESEWA_SECRET_KEY'
];
for (const key of required) {
  if (!String(process.env[key] || '').trim()) {
    console.error(`${key} is required`);
    process.exit(1);
  }
}

async function expectJson(response, label) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function metaSmoke() {
  const version = process.env.META_GRAPH_VERSION;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const info = await expectJson(await fetch(
    `https://graph.facebook.com/${version}/${phoneId}?fields=display_phone_number,verified_name,quality_rating`,
    { headers: { Authorization: `Bearer ${token}` } }
  ), 'Meta phone-number lookup');

  if (mode === 'live-payment') {
    const to = String(process.env.SMOKE_WHATSAPP_TO || '').replace(/^\+/, '');
    if (!to) throw new Error('SMOKE_WHATSAPP_TO is required for live Meta smoke');
    await expectJson(await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: 'Production launch smoke test ✅' }
      })
    }), 'Meta live message');
  }
  return info;
}

async function khaltiSmoke() {
  const base = String(process.env.KHALTI_BASE_URL || 'https://khalti.com/api/v2').replace(/\/$/, '');
  if (mode === 'live-payment') {
    const pidx = process.env.KHALTI_SMOKE_PIDX;
    if (!pidx) throw new Error('KHALTI_SMOKE_PIDX from a completed small live payment is required');
    const body = await expectJson(await fetch(`${base}/epayment/lookup/`, {
      method: 'POST',
      headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pidx })
    }), 'Khalti live lookup');
    if (String(body.status).toLowerCase() !== 'completed') throw new Error(`Khalti smoke payment is not completed: ${body.status}`);
    return body;
  }

  const orderId = `SMOKE-${Date.now()}`;
  return expectJson(await fetch(`${base}/epayment/initiate/`, {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      return_url: process.env.PUBLIC_BASE_URL,
      website_url: process.env.PUBLIC_BASE_URL,
      amount: 1000,
      purchase_order_id: orderId,
      purchase_order_name: 'Production smoke test'
    })
  }), 'Khalti initiation');
}

function esewaSignature(totalAmount, transactionUuid, productCode) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  return crypto.createHmac('sha256', process.env.ESEWA_SECRET_KEY).update(message).digest('base64');
}

async function esewaSmoke() {
  const productCode = process.env.ESEWA_PRODUCT_CODE;
  const total = String(process.env.ESEWA_SMOKE_TOTAL_AMOUNT || '10.00');
  const transactionUuid = mode === 'live-payment'
    ? process.env.ESEWA_SMOKE_TRANSACTION_UUID
    : `SMOKE-${Date.now()}`;

  if (!transactionUuid) throw new Error('ESEWA_SMOKE_TRANSACTION_UUID from a completed small live payment is required');

  const signature = esewaSignature(total, transactionUuid, productCode);
  if (!signature) throw new Error('Unable to generate eSewa HMAC signature');

  const statusBase = String(process.env.ESEWA_STATUS_URL || 'https://epay.esewa.com.np/api/epay/transaction/status/').replace(/\?$/, '');
  const qs = new URLSearchParams({
    product_code: productCode,
    total_amount: total,
    transaction_uuid: transactionUuid
  });
  const body = await expectJson(await fetch(`${statusBase}?${qs.toString()}`), 'eSewa status');

  if (mode === 'live-payment' && String(body.status).toUpperCase() !== 'COMPLETE') {
    throw new Error(`eSewa smoke payment is not COMPLETE: ${body.status}`);
  }
  return { ...body, localSignatureGenerated: true };
}

(async () => {
  const [meta, khalti, esewa] = await Promise.all([metaSmoke(), khaltiSmoke(), esewaSmoke()]);
  console.log(JSON.stringify({
    ok: true,
    mode,
    meta: { verifiedName: meta.verified_name, displayPhoneNumber: meta.display_phone_number },
    khalti: { status: khalti.status || 'initiated', pidx: khalti.pidx || process.env.KHALTI_SMOKE_PIDX },
    esewa: { status: esewa.status, signatureGenerated: esewa.localSignatureGenerated }
  }, null, 2));
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
