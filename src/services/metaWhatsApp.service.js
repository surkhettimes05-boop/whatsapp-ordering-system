const crypto = require('crypto');
const { logger } = require('../config/logger');

const graphVersion = process.env.META_GRAPH_VERSION;
const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
const catalogId = process.env.META_CATALOG_ID;

function configured() {
  return Boolean(graphVersion && phoneNumberId && accessToken);
}

function endpoint() {
  if (!graphVersion) throw new Error('META_GRAPH_VERSION is not configured');
  if (!phoneNumberId) throw new Error('META_WHATSAPP_PHONE_NUMBER_ID is not configured');
  return `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
}

async function graphSend(payload) {
  if (!configured()) {
    logger.info('[MOCK META] WhatsApp payload', { payload });
    return { success: true, mock: true, payload };
  }

  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...payload
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `Meta WhatsApp request failed with HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.meta = body;
    throw error;
  }
  return {
    success: true,
    messageId: body?.messages?.[0]?.id || null,
    response: body
  };
}

async function sendText(to, text) {
  return graphSend({ to, type: 'text', text: { preview_url: false, body: text } });
}

async function sendImage(to, imageUrl, caption = '') {
  return graphSend({
    to,
    type: 'image',
    image: { link: imageUrl, ...(caption ? { caption } : {}) }
  });
}

async function sendButtons(to, body, buttons, options = {}) {
  const normalized = (buttons || []).slice(0, 3).map(button => ({
    type: 'reply',
    reply: {
      id: String(button.id).slice(0, 256),
      title: String(button.title).slice(0, 20)
    }
  }));
  return graphSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(options.header ? { header: { type: 'text', text: String(options.header).slice(0, 60) } } : {}),
      body: { text: String(body).slice(0, 1024) },
      ...(options.footer ? { footer: { text: String(options.footer).slice(0, 60) } } : {}),
      action: { buttons: normalized }
    }
  });
}

async function sendList(to, body, buttonText, sections, options = {}) {
  return graphSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(options.header ? { header: { type: 'text', text: String(options.header).slice(0, 60) } } : {}),
      body: { text: String(body).slice(0, 1024) },
      ...(options.footer ? { footer: { text: String(options.footer).slice(0, 60) } } : {}),
      action: {
        button: String(buttonText || 'Choose').slice(0, 20),
        sections: (sections || []).slice(0, 10).map(section => ({
          title: String(section.title || 'Options').slice(0, 24),
          rows: (section.rows || []).slice(0, 10).map(row => ({
            id: String(row.id).slice(0, 200),
            title: String(row.title).slice(0, 24),
            ...(row.description ? { description: String(row.description).slice(0, 72) } : {})
          }))
        }))
      }
    }
  });
}

async function sendCtaUrl(to, body, displayText, url, options = {}) {
  return graphSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      ...(options.header ? { header: { type: 'text', text: String(options.header).slice(0, 60) } } : {}),
      body: { text: String(body).slice(0, 1024) },
      ...(options.footer ? { footer: { text: String(options.footer).slice(0, 60) } } : {}),
      action: {
        name: 'cta_url',
        parameters: {
          display_text: String(displayText || 'Open').slice(0, 20),
          url
        }
      }
    }
  });
}

async function sendProduct(to, productRetailerId, body = 'View product') {
  if (!catalogId) throw new Error('META_CATALOG_ID is not configured');
  return graphSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'product',
      body: { text: body },
      action: {
        catalog_id: catalogId,
        product_retailer_id: productRetailerId
      }
    }
  });
}

async function sendProductList(to, sections, options = {}) {
  if (!catalogId) throw new Error('META_CATALOG_ID is not configured');
  const productSections = (sections || []).slice(0, 10).map(section => ({
    title: String(section.title || 'Products').slice(0, 24),
    product_items: (section.productItems || []).slice(0, 30).map(item => ({
      product_retailer_id: item.productRetailerId
    }))
  })).filter(section => section.product_items.length);

  return graphSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'product_list',
      header: { type: 'text', text: String(options.header || 'Shop').slice(0, 60) },
      body: { text: String(options.body || 'Browse products and add them to your WhatsApp cart.').slice(0, 1024) },
      ...(options.footer ? { footer: { text: String(options.footer).slice(0, 60) } } : {}),
      action: { catalog_id: catalogId, sections: productSections }
    }
  });
}

async function sendTemplate(to, templateName, languageCode = 'en', components = []) {
  return graphSend({
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length ? { components } : {})
    }
  });
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.META_WHATSAPP_APP_SECRET;
  if (!secret || !rawBody || !signature || !signature.startsWith('sha256=')) return false;
  const received = Buffer.from(signature.slice(7), 'hex');
  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex'),
    'hex'
  );
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function verifyChallenge(query) {
  const token = process.env.META_WHATSAPP_VERIFY_TOKEN;
  return query['hub.mode'] === 'subscribe' &&
    token &&
    query['hub.verify_token'] === token
    ? query['hub.challenge']
    : null;
}

function normalizeInbound(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) {
    const status = value?.statuses?.[0];
    return status ? {
      provider: 'meta',
      kind: 'status',
      providerMessageId: status.id || `status-${Date.now()}`,
      status
    } : null;
  }

  const contact = value?.contacts?.[0];
  const base = {
    provider: 'meta',
    providerMessageId: message.id,
    phone: message.from,
    profileName: contact?.profile?.name || null,
    type: message.type,
    raw: message
  };

  if (message.type === 'text') return { ...base, text: message.text?.body || '' };
  if (message.type === 'interactive') {
    const reply = message.interactive?.button_reply || message.interactive?.list_reply;
    return {
      ...base,
      text: reply?.title || '',
      actionId: reply?.id || null
    };
  }
  if (message.type === 'order') {
    return {
      ...base,
      text: '',
      nativeOrder: {
        catalogId: message.order?.catalog_id,
        products: (message.order?.product_items || []).map(item => ({
          retailerId: item.product_retailer_id,
          quantity: Number(item.quantity || 0),
          itemPrice: Number(item.item_price || 0),
          currency: item.currency || 'NPR'
        }))
      }
    };
  }
  if (message.type === 'location') {
    return {
      ...base,
      text: message.location?.name || message.location?.address || '',
      location: {
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name,
        address: message.location?.address
      }
    };
  }
  if (message.type === 'image') {
    return { ...base, text: message.image?.caption || '', mediaId: message.image?.id || null };
  }
  return { ...base, text: '' };
}

module.exports = {
  configured,
  catalogId,
  sendText,
  sendImage,
  sendButtons,
  sendList,
  sendCtaUrl,
  sendProduct,
  sendProductList,
  sendTemplate,
  verifyWebhookSignature,
  verifyChallenge,
  normalizeInbound
};
