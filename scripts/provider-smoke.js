#!/usr/bin/env node
// Read-only Meta credential connectivity check. No customer message or payment is sent.
require('dotenv').config();
(async () => {
  const version = process.env.META_GRAPH_VERSION;
  const id = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!/^v\d+\.\d+$/.test(version || '') || !id || !token) throw new Error('Meta version, business phone ID and access token are required');
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(id)}?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  const body = await response.json();
  if (!response.ok || body.id !== id) throw new Error('Meta phone-number lookup failed. Check token permissions and phone ID.');
  console.log(JSON.stringify({ ok: true, checks: ['Meta authenticated phone lookup'], phoneId: body.id, verifiedName: body.verified_name || null }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
