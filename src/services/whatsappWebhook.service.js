const prisma = require('../config/database');
const meta = require('./metaWhatsApp.service');
const context = require('../config/commerce-context');
const logger = require('../utils/logger');
function provider() { return String(process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase(); }
function normalizeTwilio(body) {
  if (!body.MessageSid || !body.From) return null;
  return { provider: 'twilio', providerMessageId: body.MessageSid, phone: String(body.From).replace('whatsapp:', ''), profileName: body.ProfileName || null, type: 'text', text: String(body.Body || '').trim(), raw: body };
}
function normalizeAll(req) {
  if (provider() !== 'meta') return [normalizeTwilio(req.body)].filter(Boolean);
  const events = [];
  for (const entry of req.body?.entry || []) for (const change of entry.changes || []) {
    const value = change.value || {};
    // Only accept messages addressed to this business phone number.
    if (value.metadata?.phone_number_id !== process.env.META_WHATSAPP_PHONE_NUMBER_ID) continue;
    for (const message of value.messages || []) {
      const contact = (value.contacts || []).find(c => c.wa_id === message.from);
      const event = meta.normalizeInbound({ entry: [{ changes: [{ value: { ...value, messages: [message], contacts: contact ? [contact] : [] } }] }] });
      if (event?.providerMessageId) events.push(event);
    }
  }
  return events;
}
function normalizeInbound(req) { return normalizeAll(req)[0] || null; }
async function persistEvents(events) {
  const rows = events.filter(e => e && e.kind !== 'status').map(event => ({ providerMessageId: event.providerMessageId, provider: event.provider, sender: event.phone, messageType: event.type, payload: JSON.stringify(event) }));
  if (rows.length) await prisma.whatsAppInboundEvent.createMany({ data: rows, skipDuplicates: true });
}
// A row lock remains held until commerce state and all outbound messages commit.
// Earlier events from the same sender block later events, preserving conversation order.
async function processPending(controller) {
  for (let i = 0; i < 25; i++) {
    let row;
    try {
      const done = await prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw`SELECT e.* FROM whatsapp_inbound_events e
          WHERE e."processedAt" IS NULL AND e.attempts < 10 AND e."nextAttemptAt" <= (NOW() AT TIME ZONE 'UTC')
          AND NOT EXISTS (SELECT 1 FROM whatsapp_inbound_events p WHERE p.sender = e.sender AND p."processedAt" IS NULL AND (p."createdAt", p.id) < (e."createdAt", e.id))
          ORDER BY e."createdAt", e.id FOR UPDATE OF e SKIP LOCKED LIMIT 1`;
        row = rows[0]; if (!row) return false;
        const lock = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${row.sender || row.id})) AS locked`;
        if (!lock[0].locked) return false;
        const event = JSON.parse(row.payload);
        // Upgrade legacy inbox records containing raw provider messages.
        const normalized = event.providerMessageId ? event : meta.normalizeInbound({ entry: [{ changes: [{ value: { messages: [event] } }] }] });
        await tx.$executeRawUnsafe('SAVEPOINT message_command');
        try { await context.run({ tx }, () => controller.processEvent(normalized)); }
        catch (error) {
          const customerError = !error.code && /Quantity|quantity|Product|product|stock|Cart is empty|cart is empty|Coupon|coupon|Promotions|payment|Address|address|No previous order|catalog|NPR|Delivery is not|Minimum order|Fulfillment location is closed/.test(error.message);
          if (!customerError) throw error;
          await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT message_command');
          await context.run({ tx }, () => require('./whatsapp.service').sendMessage(row.sender, error.message + '\nType menu to continue.', { immediate: true }));
        }
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT message_command');
        await tx.whatsAppInboundEvent.update({ where: { id: row.id }, data: { processedAt: new Date(), lastError: null } });
        return true;
      }, { timeout: 30000 });
      if (!done) break;
    } catch (error) {
      if (!row) throw error;
      logger.error('Durable WhatsApp processing failed', { id: row.id, error: error.message });
      await prisma.whatsAppInboundEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** row.attempts)), lastError: error.message.slice(0, 1000) } });
    }
  }
}
async function flushOutbox() {
  for (let i = 0; i < 50; i++) {
    let row;
    try {
      const done = await prisma.$transaction(async tx => {
        const rows = await tx.$queryRaw`SELECT e.* FROM whatsapp_outbox e WHERE e."sentAt" IS NULL AND e.attempts < 10 AND e."nextAttemptAt" <= (NOW() AT TIME ZONE 'UTC')
          AND NOT EXISTS (SELECT 1 FROM whatsapp_outbox p WHERE p.sender = e.sender AND p."sentAt" IS NULL AND (p."createdAt", p.id) < (e."createdAt", e.id))
          ORDER BY e."createdAt", e.id FOR UPDATE OF e SKIP LOCKED LIMIT 1`;
        row = rows[0]; if (!row) return false;
        const { method, args } = JSON.parse(row.payload);
        const allowed = ['sendMessage','sendButtons','sendList','sendCtaUrl','sendProduct','sendProductList','sendTemplate'];
        if (!allowed.includes(method)) throw new Error('Unsupported outbox method');
        await require('./whatsapp.service')[method](...args);
        await tx.whatsAppOutbox.update({ where: { id: row.id }, data: { sentAt: new Date(), lastError: null } });
        return true;
      }, { timeout: 30000 });
      if (!done) break;
    } catch (error) {
      if (!row) throw error;
      await prisma.whatsAppOutbox.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** row.attempts)), lastError: error.message.slice(0,1000) } });
    }
  }
}
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try { await processPending(require('../controllers/commerce-whatsapp.controller')); await flushOutbox(); }
  catch (error) { logger.error('WhatsApp worker failed', { error: error.message }); }
  finally { busy = false; }
}
function startWorker() { const timer = setInterval(tick, 1000); timer.unref(); tick(); return timer; }
module.exports = { provider, normalizeInbound, normalizeAll, persistEvents, processPending, flushOutbox, startWorker, tick };
