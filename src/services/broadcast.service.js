const prisma = require('../config/database');
const wholesalerService = require('./wholesaler.service');
const whatsappService = require('./whatsapp.service');

const BROADCAST_EXPIRATION_MINUTES = 15;

/**
 * Broadcasts a new order to eligible wholesalers.
 *
 * @param {string} orderId The ID of the order to broadcast.
 * @returns {Promise<object>} Summary of the broadcast.
 */
async function broadcastOrder(orderId) {
  // 1. Fetch Order with Retailer and Items
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      retailer: true,
    },
  });

  if (!order) {
    throw new Error(`Order with ID ${orderId} not found`);
  }

  // 2. Set order.expires_at = now + 15 minutes
  const expires_at = new Date();
  expires_at.setMinutes(expires_at.getMinutes() + BROADCAST_EXPIRATION_MINUTES);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      expires_at,
      status: 'PENDING_BIDS'
    },
  });

  // 3. Get Eligible Wholesalers (filtered by location, status, and product availability)
  const eligibleWholesalers = await wholesalerService.getEligibleWholesalers(order);

  // 4. Send WhatsApp message to each
  // Template:
  // "New Order #<ID>
  //  Reply: PRICE <amount> ETA <time>
  //  Example: PRICE 2450 ETA 2H"
  const message = `New Order #${order.id}\n` +
    `Reply: PRICE <amount> ETA <time>\n` +
    `Example: PRICE 2450 ETA 2H`;

  const results = [];
  for (const wholesaler of eligibleWholesalers) {
    try {
      // Use whatsappNumber from schema
      await whatsappService.sendMessage(wholesaler.whatsappNumber, message);
      results.push({ wholesalerId: wholesaler.id, success: true });
    } catch (error) {
      console.error(`Failed to send broadcast to wholesaler ${wholesaler.id}:`, error);
      results.push({ wholesalerId: wholesaler.id, success: false, error: error.message });
    }
  }

  console.log(`🚀 Broadcast complete for Order ${orderId}. Sent to ${results.filter(r => r.success).length} wholesalers.`);

  return {
    orderId,
    expires_at,
    eligibleCount: eligibleWholesalers.length,
    sentCount: results.filter(r => r.success).length,
    results
  };
}

/**
 * Notify other wholesalers that the order is taken.
 */
async function notifyLosers(orderId, winnerWholesalerId) {
  // 1. Get the routing history to find candidates
  const routing = await prisma.orderRouting.findFirst({
    where: { orderId },
    orderBy: { timestamp: 'desc' }
  });

  if (!routing || !routing.candidateWholesalers) return;

  let candidates = [];
  try {
    candidates = JSON.parse(routing.candidateWholesalers);
  } catch (e) {
    console.error('Failed to parse candidate wholesalers:', e);
    return;
  }

  // 2. Filter out the winner
  const losers = candidates.filter(wId => wId !== winnerWholesalerId);

  // 3. Send "Order Taken" message
  for (const loserId of losers) {
    const wholesaler = await wholesalerService.getWholesalerById(loserId);
    if (wholesaler && wholesaler.whatsappNumber) {
      await whatsappService.sendMessage(
        wholesaler.whatsappNumber,
        `❌ Order #${orderId} has been accepted by another vendor.`
      );
    }
  }

  console.log(`Logers notified for Order ${orderId}: ${losers.length}`);
}

module.exports = {
  broadcastOrder,
  notifyLosers
};

