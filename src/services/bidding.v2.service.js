const prisma = require('../config/database');
const { withTransaction } = require('../utils/transaction');
const { scoreOffer } = require('../utils/scoring');
const { logger } = require('../config/logger');

class BiddingServiceV2 {
  async submitOffer({ orderId, wholesalerId, price_quote, delivery_eta, stock_confirmed }) {
    if (!orderId || !wholesalerId) throw new Error('orderId and wholesalerId required');
    const payload = {
      order_id: orderId,
      wholesaler_id: wholesalerId,
      price_quote: Number(price_quote || 0),
      delivery_eta: delivery_eta || null,
      stock_confirmed: !!stock_confirmed,
      status: 'PENDING'
    };
    return prisma.vendorOffer.create({ data: payload });
  }

  async selectWinner(orderId, opts = {}) {
    if (!orderId) throw new Error('orderId required');

    return withTransaction(async (tx) => {
      // Acquire a row lock on the order to serialize selection
      await this._acquireOrderLock(tx, orderId);

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('order not found');
      if (order.final_wholesaler_id) throw new Error('order already assigned');

      const offers = await this._fetchPendingOffers(tx, orderId);
      if (!offers || offers.length === 0) throw new Error('no pending offers');

      const scored = await this._scoreOffers(tx, offers);
      scored.sort((a, b) => b.score - a.score);

      const winner = scored[0].offer;
      const losers = scored.slice(1).map(s => s.offer);

      await this._commitSelection(tx, orderId, winner, losers, opts);

      logger.info('Bid selection committed', { orderId, winner: winner.wholesaler_id });
      return { orderId, winner: winner.wholesaler_id };
    }, { operation: 'BID_SELECTION', entityId: orderId, entityType: 'Order' });
  }

  async _acquireOrderLock(tx, orderId) {
    // Use FOR UPDATE to simulate row locking in DB
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  }

  async _fetchPendingOffers(tx, orderId) {
    return tx.vendorOffer.findMany({ where: { order_id: orderId, status: 'PENDING' } });
  }

  async _scoreOffers(tx, offers) {
    const out = [];
    for (const o of offers) {
      const wholesaler = await tx.wholesaler.findUnique({ where: { id: o.wholesaler_id } });
      const enriched = { ...o, wholesaler };
      const score = scoreOffer(enriched);
      out.push({ offer: enriched, score });
    }
    return out;
  }

  async _commitSelection(tx, orderId, winner, losers, opts = {}) {
    // Update winner
    await tx.vendorOffer.update({ where: { order_id_wholesaler_id: { order_id: orderId, wholesaler_id: winner.wholesaler_id } }, data: { status: 'ACCEPTED' } });

    // Update losers in parallel
    await Promise.all(losers.map(l => tx.vendorOffer.update({ where: { order_id_wholesaler_id: { order_id: orderId, wholesaler_id: l.wholesaler_id } }, data: { status: 'REJECTED' } })));

    // Update order with final wholesaler
    await tx.order.update({ where: { id: orderId }, data: { final_wholesaler_id: winner.wholesaler_id, wholesalerId: winner.wholesaler_id } });

    // Create audit trail entries
    const performedBy = opts.performedBy || 'SYSTEM';
    const auditActions = [];
    auditActions.push(tx.adminAuditLog.create({ data: { adminId: performedBy, action: 'BID_WINNER_SELECTED', targetId: orderId, reason: `Winner=${winner.wholesaler_id}` } }));
    for (const l of losers) {
      auditActions.push(tx.adminAuditLog.create({ data: { adminId: performedBy, action: 'BID_LOSER_REJECTED', targetId: orderId, reason: `Rejected=${l.wholesaler_id}` } }));
    }
    await Promise.all(auditActions);
  }
}

module.exports = new BiddingServiceV2();
