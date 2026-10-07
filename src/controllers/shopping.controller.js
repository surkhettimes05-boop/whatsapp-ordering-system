const shoppingService = require('../services/shopping.service');
const paymentService = require('../services/payment.service');

function resultPage(title, message) {
  const esc = value => String(value || '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui;max-width:560px;margin:15vh auto;padding:24px;background:#07120d;color:#eefaf2}.card{border:1px solid #1e3a2a;background:#0d1d15;border-radius:18px;padding:24px}h1{color:#25d366}</style></head><body><div class="card"><h1>${esc(title)}</h1><p>${esc(message)}</p><p>You can return to WhatsApp now.</p></div></body></html>`;
}

class ShoppingController {
  async serviceability(req, res) {
    try {
      const data = await shoppingService.resolveServiceArea(req.query.query || req.query.code || '');
      res.json({ success: true, data });
    } catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async offers(req, res) {
    try {
      res.json({ success: true, data: await shoppingService.listOffers(req.query.all !== 'true') });
    } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }

  async addresses(req, res) {
    try { res.json({ success: true, data: await shoppingService.listAddresses(req.params.retailerId) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async createAddress(req, res) {
    try { res.status(201).json({ success: true, data: await shoppingService.createAddress(req.params.retailerId, req.body) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async updateAddress(req, res) {
    try { res.json({ success: true, data: await shoppingService.updateAddress(req.params.retailerId, req.params.id, req.body) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async defaultAddress(req, res) {
    try { res.json({ success: true, data: await shoppingService.setDefaultAddress(req.params.retailerId, req.params.id) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async deleteAddress(req, res) {
    try { res.json({ success: true, data: await shoppingService.deleteAddress(req.params.retailerId, req.params.id) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async applyCoupon(req, res) {
    try { res.json({ success: true, data: await shoppingService.setCartCoupon(req.params.retailerId, req.body.code) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async removeCoupon(req, res) {
    try { res.json({ success: true, data: await shoppingService.setCartCoupon(req.params.retailerId, null) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async quote(req, res) {
    try {
      res.json({ success: true, data: await shoppingService.quote(req.params.retailerId, {
        addressId: req.query.addressId,
        serviceAreaCode: req.query.serviceAreaCode,
        couponCode: req.query.couponCode
      }) });
    } catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async checkout(req, res) {
    try {
      if (!req.body.cartId) return res.status(400).json({ error: 'cartId is required for retry-safe checkout' });
      const data = await shoppingService.checkout(req.params.retailerId, {
        cartId: req.body.cartId,
        addressId: req.body.addressId,
        serviceAreaCode: req.body.serviceAreaCode,
        couponCode: req.body.couponCode,
        paymentProvider: req.body.paymentProvider,
        customerNotes: req.body.customerNotes,
        sourceChannel: req.body.sourceChannel || 'API'
      });
      res.status(201).json({ success: true, data });
    } catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async providers(req, res) {
    res.json({
      success: true,
      data: {
        cod: true,
        online: []
      }
    });
  }

  async initiatePayment(req, res) {
    try {
      res.json({ success: true, data: await paymentService.initiate(req.params.orderId, req.params.provider) });
    } catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async khaltiCallback(req, res) {
    try {
      const result = await paymentService.verifyKhalti(req.query.pidx);
      const paid = result.status === 'PAID';
      res.status(paid ? 200 : 202).send(resultPage(
        paid ? 'Payment successful' : 'Payment status updated',
        paid ? 'Your Khalti payment has been verified.' : `Khalti status: ${result.status}`
      ));
    } catch (error) {
      res.status(400).send(resultPage('Payment verification failed', error.message));
    }
  }

  async esewaPay(req, res) {
    try { res.type('html').send(await paymentService.renderEsewaForm(req.params.paymentId)); }
    catch (error) { res.status(400).send(resultPage('Unable to open eSewa', error.message)); }
  }

  async esewaSuccess(req, res) {
    try {
      const payload = paymentService.decodeEsewaPayload(req.query.data || req.body?.data);
      const result = await paymentService.verifyEsewaPayload(payload);
      const paid = result.status === 'PAID';
      res.status(paid ? 200 : 202).send(resultPage(
        paid ? 'Payment successful' : 'Payment status updated',
        paid ? 'Your eSewa payment has been verified.' : `eSewa status: ${result.status}`
      ));
    } catch (error) {
      res.status(400).send(resultPage('Payment verification failed', error.message));
    }
  }

  async esewaFailure(req, res) {
    res.status(400).send(resultPage('Payment not completed', 'The eSewa payment was cancelled or failed.'));
  }

  async createOffer(req, res) {
    try { res.status(201).json({ success: true, data: await shoppingService.createOffer(req.body) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async updateOffer(req, res) {
    try { res.json({ success: true, data: await shoppingService.updateOffer(req.params.id, req.body) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async upsertServiceArea(req, res) {
    try { res.json({ success: true, data: await shoppingService.createServiceArea(req.body) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
  }

  async listServiceAreas(req, res) {
    try { res.json({ success: true, data: await shoppingService.listServiceAreas() }); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
  }
}

module.exports = new ShoppingController();
