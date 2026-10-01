/**
 * Provider-agnostic WhatsApp messaging service.
 * Meta Cloud API is the preferred commerce transport.
 * Twilio remains available as a fallback during migration.
 */
const { logger } = require('../config/logger');
const twilio = require('twilio');
const whatsappQueueService = require('./whatsappQueue.service');
const meta = require('./metaWhatsApp.service');

const provider = String(process.env.WHATSAPP_PROVIDER || 'twilio').toLowerCase();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_PHONE_NUMBER || '+14155238886';

let twilioClient;
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
}

function usingMeta() {
  return provider === 'meta';
}

async function logOutgoing(to, body, mediaUrl = null, providerMessageId = null) {
  try {
    const prisma = require('../config/database');
    await prisma.whatsAppMessage.create({
      data: {
        from: 'SYSTEM',
        to: String(to).replace('whatsapp:', ''),
        body: body || '',
        mediaUrl,
        direction: 'OUTGOING'
      }
    });
  } catch (error) {
    logger.warn('Failed to log WhatsApp message', { error: error.message, providerMessageId });
  }
}

async function sendTwilioImmediate(to, message, options = {}) {
  const formattedTo = String(to).startsWith('whatsapp:') ? String(to) : `whatsapp:${to}`;
  const formattedFrom = String(fromPhoneNumber).startsWith('whatsapp:')
    ? String(fromPhoneNumber)
    : `whatsapp:${fromPhoneNumber}`;

  if (!twilioClient) {
    logger.info('[MOCK TWILIO] WhatsApp message', { to, message, options });
    return { success: true, mock: true };
  }

  const payload = { body: message, from: formattedFrom, to: formattedTo };
  if (options.mediaUrl) {
    payload.mediaUrl = Array.isArray(options.mediaUrl) ? options.mediaUrl : [options.mediaUrl];
  }
  const result = await twilioClient.messages.create(payload);
  await logOutgoing(to, message, options.mediaUrl || null, result.sid);
  return { success: true, messageId: result.sid, status: result.status, queued: false };
}

async function sendMessage(to, message, options = {}) {
  if (usingMeta()) {
    const result = options.mediaUrl
      ? await meta.sendImage(to, Array.isArray(options.mediaUrl) ? options.mediaUrl[0] : options.mediaUrl, message)
      : await meta.sendText(to, message);
    await logOutgoing(to, message, options.mediaUrl || null, result.messageId);
    return result;
  }

  const { useQueue = process.env.NODE_ENV === 'production', immediate = false, mediaUrl = null } = options;
  if (useQueue && !immediate && !mediaUrl) {
    try {
      return await whatsappQueueService.sendMessage(to, message, { priority: 5 });
    } catch (error) {
      logger.warn('WhatsApp queue failed; sending immediately', { error: error.message });
    }
  }
  return sendTwilioImmediate(to, message, options);
}

async function sendButtons(to, body, buttons, options = {}) {
  if (usingMeta()) {
    const result = await meta.sendButtons(to, body, buttons, options);
    await logOutgoing(to, body, null, result.messageId);
    return result;
  }
  const text = body + '\n\n' + buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
  return sendMessage(to, text, { immediate: true });
}

async function sendList(to, body, buttonText, sections, options = {}) {
  if (usingMeta()) {
    const result = await meta.sendList(to, body, buttonText, sections, options);
    await logOutgoing(to, body, null, result.messageId);
    return result;
  }
  const rows = sections.flatMap(section => section.rows || []);
  const text = body + '\n\n' + rows.map((row, i) => `${i + 1}. ${row.title}${row.description ? ' — ' + row.description : ''}`).join('\n');
  return sendMessage(to, text, { immediate: true });
}

async function sendProduct(to, productRetailerId, body) {
  if (!usingMeta()) throw new Error('Native product messages require WHATSAPP_PROVIDER=meta');
  const result = await meta.sendProduct(to, productRetailerId, body);
  await logOutgoing(to, body || 'Product', null, result.messageId);
  return result;
}

async function sendProductList(to, sections, options = {}) {
  if (!usingMeta()) throw new Error('Native product lists require WHATSAPP_PROVIDER=meta');
  const result = await meta.sendProductList(to, sections, options);
  await logOutgoing(to, options.body || 'Product catalog', null, result.messageId);
  return result;
}

async function sendTemplate(to, templateName, languageCode, components) {
  if (!usingMeta()) throw new Error('Template messages require WHATSAPP_PROVIDER=meta');
  const result = await meta.sendTemplate(to, templateName, languageCode, components);
  await logOutgoing(to, `Template: ${templateName}`, null, result.messageId);
  return result;
}

function getMainMenu() {
  return `👋 *Welcome to WhatsApp Shopping*

🛍️ Browse catalog
🔎 Search products
🔥 Offers
🛒 Cart
📦 Track orders
🔁 Repeat last order
📍 Saved address
💬 Support

Type what you need, for example:
*"Coke 2.25L"* or *"search shampoo"*`;
}

function formatProductList(products) {
  if (!products?.length) return '📦 No products available.';
  let message = '🛍️ *Products*\n\n';
  products.forEach((product, index) => {
    message += `${index + 1}. *${product.name}*\n`;
    message += `   Rs. ${product.fixedPrice ?? product.price}`;
    if (product.mrp && Number(product.mrp) > Number(product.fixedPrice ?? product.price)) {
      message += ` (MRP Rs. ${product.mrp})`;
    }
    if (product.unit) message += ` • ${product.unit}`;
    message += '\n';
  });
  message += '\nReply *[number] x [quantity]* to add an item.';
  return message;
}

function formatCartSummary(cart) {
  if (!cart?.items?.length) return '🛒 Your cart is empty.';
  let message = '🛒 *Your Cart*\n\n';
  cart.items.forEach((item, index) => {
    message += `${index + 1}. ${item.name} × ${item.quantity}\n`;
    message += `   Rs. ${item.lineTotal}\n`;
  });
  message += `\nSubtotal: Rs. ${cart.subtotal ?? cart.totalAmount}`;
  if (Number(cart.savings || 0) > 0) message += `\nYou save: Rs. ${cart.savings}`;
  message += `\n*Total: Rs. ${cart.totalAmount}*\n`;
  return message;
}

function formatRecentOrders(orders) {
  if (!orders?.length) return '📦 You have no recent orders.';
  let message = '📦 *Recent Orders*\n\n';
  orders.forEach(order => {
    message += `*${order.orderNumber || order.id.slice(-6)}*\n`;
    message += `Rs. ${order.totalAmount} • ${String(order.status).replaceAll('_', ' ')}\n`;
    if (order.createdAt) message += `${new Date(order.createdAt).toLocaleDateString()}\n`;
    message += '\n';
  });
  return message;
}

function getHelpMessage() {
  return `💬 *Shopping Help*

• *catalog* — browse products
• *search <item>* — find products
• *categories* — shop by category
• *offers* — products with savings
• *cart* — review cart
• *checkout* — place order
• *orders* — recent orders
• *track <order number>* — order status
• *repeat* — repeat last order
• *address* — saved delivery address
• *support* — create support request
• *menu* — main menu`;
}

function formatOrderSummary(order, items) {
  let message = `📋 *Order ${order.orderNumber || order.id.slice(-6)}*\n\n`;
  for (const item of items || []) {
    const product = item.product || {};
    message += `• ${product.name || 'Product'} × ${item.quantity} — Rs. ${Number(item.priceAtOrder) * item.quantity}\n`;
  }
  message += `\n*Total: Rs. ${order.totalAmount}*\nPayment: ${order.paymentMode || 'COD'}`;
  return message;
}

function formatOrderNotification(order, retailer) {
  return `📢 *NEW ORDER*

${order.orderNumber || order.id}
Customer: ${retailer.pasalName || retailer.ownerName || retailer.phoneNumber}
Amount: Rs. ${order.totalAmount}
Items: ${order.items?.length || 0}`;
}

module.exports = {
  provider,
  usingMeta,
  sendMessage,
  sendWhatsAppMessage: sendMessage,
  sendMessageImmediate: sendMessage,
  sendButtons,
  sendList,
  sendProduct,
  sendProductList,
  sendTemplate,
  getMainMenu,
  formatProductList,
  formatCartSummary,
  formatOrderSummary,
  formatRecentOrders,
  getHelpMessage,
  formatOrderNotification
};
