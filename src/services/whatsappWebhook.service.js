const prisma = require('../config/database');
const meta = require('./metaWhatsApp.service');

function provider() {
  return String(process.env.WHATSAPP_PROVIDER || 'twilio').toLowerCase();
}

function normalizeTwilio(body) {
  return {
    provider: 'twilio',
    providerMessageId: body.MessageSid || `twilio-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    phone: String(body.From || '').replace('whatsapp:', '').trim(),
    profileName: body.ProfileName || null,
    type: Number(body.NumMedia || 0) > 0 ? 'media' : 'text',
    text: String(body.Body || '').trim(),
    mediaUrl: body.MediaUrl0 || null,
    raw: body
  };
}

function normalizeInbound(req) {
  return provider() === 'meta'
    ? meta.normalizeInbound(req.body)
    : normalizeTwilio(req.body);
}

async function reserveInboundEvent(event) {
  if (!event || event.kind === 'status') return { duplicate: false, event: null };
  try {
    const row = await prisma.whatsAppInboundEvent.create({
      data: {
        providerMessageId: event.providerMessageId,
        provider: event.provider,
        sender: event.phone || null,
        messageType: event.type || null,
        payload: JSON.stringify(event.raw || {})
      }
    });
    return { duplicate: false, event: row };
  } catch (error) {
    if (error.code === 'P2002') return { duplicate: true, event: null };
    throw error;
  }
}

async function markProcessed(id) {
  if (!id) return;
  await prisma.whatsAppInboundEvent.update({
    where: { id },
    data: { processedAt: new Date() }
  });
}

module.exports = { provider, normalizeInbound, reserveInboundEvent, markProcessed };
