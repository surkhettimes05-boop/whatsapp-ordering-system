const prisma = require('../src/config/database');
const biddingService = require('../src/services/bidding.v2.service');

// Reset helper
async function resetStore() {
  if (prisma.__store__) {
    Object.keys(prisma.__store__).forEach(k => {
      if (k === '__counters__') return;
      prisma.__store__[k] = {};
    });
    prisma.__store__.__counters__ = {};
  }
}

describe('Bidding service integration', () => {
  let retailer, wholesalerA, wholesalerB, order;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    await resetStore();
    retailer = await prisma.retailer.create({ data: { phoneNumber: '9000000001', pasalName: 'R' } });
    wholesalerA = await prisma.wholesaler.create({ data: { businessName: 'WA', ownerName: 'A', phoneNumber: '7001', whatsappNumber: '7001', businessAddress: 'a', city: 'c', state: 's', pincode: '1', latitude: 0, longitude: 0, categories: 'g' } });
    wholesalerB = await prisma.wholesaler.create({ data: { businessName: 'WB', ownerName: 'B', phoneNumber: '7002', whatsappNumber: '7002', businessAddress: 'b', city: 'c', state: 's', pincode: '2', latitude: 0, longitude: 0, categories: 'g' } });

    order = await prisma.order.create({ data: { retailerId: retailer.id, totalAmount: 100, paymentMode: 'CREDIT', status: 'PENDING' } });
  });

  test('Only one vendor wins and others rejected atomically', async () => {
    // Submit two offers
    await biddingService.submitOffer({ orderId: order.id, wholesalerId: wholesalerA.id, price_quote: 80, delivery_eta: '2h', stock_confirmed: true });
    await biddingService.submitOffer({ orderId: order.id, wholesalerId: wholesalerB.id, price_quote: 70, delivery_eta: '4h', stock_confirmed: false });

    // Run two concurrent selection attempts to test atomicity
    const p1 = biddingService.selectWinner(order.id).then(r => ({ ok: true, r })).catch(e => ({ ok: false, e: e.message }));
    const p2 = biddingService.selectWinner(order.id).then(r => ({ ok: true, r })).catch(e => ({ ok: false, e: e.message }));

    const results = await Promise.all([p1, p2]);

    // Exactly one should succeed
    const successes = results.filter(r => r.ok).length;
    expect(successes).toBe(1);

    // Verify DB states: one ACCEPTED, other REJECTED
    const offers = await prisma.vendorOffer.findMany({ where: { order_id: order.id } });
    const accepted = offers.filter(o => o.status === 'ACCEPTED');
    const rejected = offers.filter(o => o.status === 'REJECTED');

    expect(accepted.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Audit trail
    const audits = await prisma.adminAuditLog.findMany({ where: { targetId: order.id } });
    expect(audits.length).toBeGreaterThanOrEqual(2); // winner + loser entries
  });
});
