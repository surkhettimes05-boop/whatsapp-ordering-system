/**
 * WhatsApp Service
 * 
 * Production-ready Twilio WhatsApp integration
 * Handles message sending with proper error handling and queue support
 */

const { logger } = require('../config/logger');
const twilio = require('twilio');
const whatsappQueueService = require('./whatsappQueue.service');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_PHONE_NUMBER || '+14155238886';

let client;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
  logger.info('Twilio client initialized');
} else {
  logger.warn('Twilio credentials not found - running in mock mode');
}

/**
 * Sends a WhatsApp message via Twilio
 * Uses queue service for reliability in production
 * 
 * @param {string} to - Recipient phone number (with or without whatsapp: prefix)
 * @param {string} message - Message text
 * @param {object} options - Options
 * @param {boolean} options.useQueue - Use queue service (default: true in production)
 * @param {boolean} options.immediate - Send immediately (bypass queue)
 * @returns {Promise<object>} - Result with messageId or jobId
 */
async function sendWhatsAppMessage(to, message, options = {}) {
  const { useQueue = process.env.NODE_ENV === 'production', immediate = false } = options;
  
  // Format phone numbers for Twilio
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const formattedFrom = fromPhoneNumber.startsWith('whatsapp:') 
    ? fromPhoneNumber 
    : `whatsapp:${fromPhoneNumber}`;

  // Use queue service in production for reliability
  if (useQueue && !immediate) {
    try {
      const result = await whatsappQueueService.sendMessage(to, message, { priority: 5 });
      logger.info(`WhatsApp message queued to ${to}`, { jobId: result.jobId });
      return { success: true, jobId: result.jobId, queued: true };
    } catch (error) {
      logger.error(`Failed to queue WhatsApp message to ${to}`, { error: error.message });
      // Fallback to immediate send
      return await sendMessageImmediate(to, message);
    }
  }

  // Send immediately (for critical messages or when queue is disabled)
  return await sendMessageImmediate(to, message);
}

/**
 * Send message immediately (bypass queue)
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {Promise<object>} - Result
 */
async function sendMessageImmediate(to, message) {
  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const formattedFrom = fromPhoneNumber.startsWith('whatsapp:') 
    ? fromPhoneNumber 
    : `whatsapp:${fromPhoneNumber}`;

  if (client) {
    try {
      const result = await client.messages.create({
        body: message,
        from: formattedFrom,
        to: formattedTo,
      });
      
      logger.info(`WhatsApp message sent to ${to}`, { 
        messageId: result.sid,
        status: result.status 
      });
      
      // Log to database
      try {
        const prisma = require('../config/database');
        await prisma.whatsAppMessage.create({
          data: {
            from: 'SYSTEM',
            to: to.replace('whatsapp:', ''),
            body: message,
            direction: 'OUTGOING'
          }
        });
      } catch (dbError) {
        logger.warn('Failed to log message to database', { error: dbError.message });
      }
      
      return { 
        success: true, 
        messageId: result.sid, 
        status: result.status,
        queued: false
      };
    } catch (error) {
      logger.error(`Failed to send WhatsApp message to ${to}`, { 
        error: error.message,
        code: error.code,
        status: error.status
      });
      
      // Re-throw for critical errors so caller can handle
      throw error;
    }
  } else {
    logger.info(`[MOCK] Sending WhatsApp message to ${to}: "${message}"`);
    return { success: true, mock: true, message: 'Message sent (mock mode)' };
  }
}

/**
 * Alias for sendWhatsAppMessage
 */
async function sendMessage(to, message, options = {}) {
  return sendWhatsAppMessage(to, message, options);
}

/**
 * Get main menu message
 */
function getMainMenu() {
  return `👋 *Welcome to WhatsApp Ordering System!*

📋 *Main Menu:*
1️⃣ View Catalog
2️⃣ Check Credit
3️⃣ Recent Orders
4️⃣ Help

*To order:* Send product number and quantity
Example: *1 x 10* (Product 1, Quantity 10)

Type *menu* anytime to see this menu again.`;
}

/**
 * Format product list for WhatsApp
 */
function formatProductList(products) {
  if (!products || products.length === 0) {
    return '📦 No products available at the moment.';
  }

  let message = '📦 *Available Products:*\n\n';
  products.forEach((product, index) => {
    message += `${index + 1}. *${product.name}*\n`;
    message += `   Price: Rs. ${product.fixedPrice}\n`;
    if (product.unit) {
      message += `   Unit: ${product.unit}\n`;
    }
    message += '\n';
  });

  message += '\n*To order:* Send *[number] x [quantity]*\n';
  message += 'Example: *1 x 10* (Product 1, Quantity 10)';

  return message;
}

/**
 * Format order summary
 */
function formatOrderSummary(order, items) {
  let message = '📋 *Order Summary*\n\n';
  message += `Order #${order.id.slice(-4)}\n\n`;
  message += '*Items:*\n';
  
  items.forEach((item, index) => {
    const product = item.product || {};
    message += `${index + 1}. ${product.name || 'Product'} x ${item.quantity}\n`;
    message += `   Rs. ${item.priceAtOrder} each\n`;
  });
  
  message += `\n*Total: Rs. ${order.totalAmount}*\n`;
  message += `Payment: ${order.paymentMode || 'COD'}\n\n`;
  message += 'Reply *Yes* to confirm or *No* to cancel.';
  
  return message;
}

/**
 * Format recent orders
 */
function formatRecentOrders(orders) {
  if (!orders || orders.length === 0) {
    return '📦 You have no recent orders.';
  }

  let message = '📦 *Your Recent Orders:*\n\n';
  orders.forEach((order) => {
    message += `#${order.id.slice(-4)}\n`;
    message += `Amount: Rs. ${order.totalAmount}\n`;
    message += `Status: ${order.status}\n`;
    if (order.createdAt) {
      const date = new Date(order.createdAt).toLocaleDateString();
      message += `Date: ${date}\n`;
    }
    message += '\n';
  });

  return message;
}

/**
 * Get help message
 */
function getHelpMessage() {
  return `ℹ️ *Help & Support*

*Main Commands:*
• *menu* - Show main menu
• *1* or *view catalog* - Browse products
• *2* or *check credit* - Check your credit status
• *3* or *recent orders* - View recent orders
• *place order* - Confirm your cart

*How to Order:*
Send: *[Product Number] x [Quantity]*
Example: *1 x 10* (Product 1, Quantity 10)

*Need Help?*
Contact support or type *menu* to start over.`;
}

/**
 * Format order notification for wholesaler
 */
function formatOrderNotification(order, retailer) {
  return `📢 *NEW ORDER ALERT*

Order #${order.id.slice(-4)}
Retailer: ${retailer.pasalName || retailer.phoneNumber}
Amount: Rs. ${order.totalAmount}
Items: ${order.items?.length || 0} item(s)

Reply *"Accept Order ${order.id.slice(-4)}"* to accept
or *"Reject Order ${order.id.slice(-4)}"* to reject`;
}

module.exports = {
  sendWhatsAppMessage,
  sendMessage,
  sendMessageImmediate,
  getMainMenu,
  formatProductList,
  formatOrderSummary,
  formatRecentOrders,
  getHelpMessage,
  formatOrderNotification
};
