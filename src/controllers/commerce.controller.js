const commerceService = require('../services/commerce.service');

class CommerceController {
  async catalog(req, res) {
    try {
      res.json({ success: true, data: await commerceService.listCatalog(req.query) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async categories(req, res) {
    try {
      res.json({ success: true, data: await commerceService.listCategories() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createCategory(req, res) {
    try {
      res.status(201).json({ success: true, data: await commerceService.createCategory(req.body) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async createProduct(req, res) {
    try {
      res.status(201).json({ success: true, data: await commerceService.createProduct(req.body) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      res.json({ success: true, data: await commerceService.updateProduct(req.params.id, req.body) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getCart(req, res) {
    try {
      res.json({ success: true, data: await commerceService.getCart(req.params.retailerId) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async addCartItem(req, res) {
    try {
      const data = await commerceService.addCartItem(
        req.params.retailerId,
        req.body.productId,
        req.body.quantity
      );
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async setCartItem(req, res) {
    try {
      const data = await commerceService.setCartItem(
        req.params.retailerId,
        req.params.productId,
        req.body.quantity
      );
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async clearCart(req, res) {
    try {
      res.json({ success: true, data: await commerceService.clearCart(req.params.retailerId) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async checkout(req, res) {
    try {
      if (!req.body.cartId) return res.status(400).json({ error: 'cartId is required for retry-safe checkout' });
      const data = await commerceService.checkoutCart({
        retailerId: req.params.retailerId,
        paymentMode: req.body.paymentMode,
        sourceChannel: req.body.sourceChannel || 'ADMIN',
        cartId: req.body.cartId, addressId: req.body.addressId,
        deliveryName: req.body.deliveryName,
        deliveryPhone: req.body.deliveryPhone,
        deliveryAddress: req.body.deliveryAddress,
        customerNotes: req.body.customerNotes
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateOrderStatus(req, res) {
    try {
      const order = await commerceService.updateCommerceOrderStatus(req.params.id, req.body.status, { cashReceived: req.body.cashReceived, actorId: req.user.id });
      res.json({ success: true, data: order });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async metaCatalogFeed(req, res) {
    try {
      const expected = process.env.CATALOG_FEED_TOKEN;
      if (expected && req.query.token !== expected) {
        return res.status(401).send('Unauthorized');
      }
      const rows = await commerceService.getMetaCatalogFeedRows();
      const headers = ['id','title','description','availability','condition','price','link','image_link','brand'];
      const esc = value => {
        const text = String(value ?? '');
        return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      };
      const csv = [headers.join(','), ...rows.map(row => headers.map(h => esc(row[h])).join(','))].join('\n');
      res.type('text/csv').send(csv);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAddresses(req, res) {
    try {
      res.json({ success: true, data: await commerceService.getAddresses(req.params.retailerId) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async saveAddress(req, res) {
    try {
      res.status(201).json({ success: true, data: await commerceService.saveAddress(req.params.retailerId, req.body) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async listServiceAreas(req, res) {
    try {
      res.json({ success: true, data: await commerceService.listServiceAreas() });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async upsertServiceArea(req, res) {
    try {
      res.json({ success: true, data: await commerceService.upsertServiceArea(req.body) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async listSupportTickets(req, res) {
    try {
      res.json({ success: true, data: await commerceService.listSupportTickets(req.query) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateSupportTicket(req, res) {
    try {
      res.json({ success: true, data: await commerceService.updateSupportTicket(req.params.id, req.body) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async sales(req, res) {
    try {
      res.json({ success: true, data: await commerceService.getSalesDashboard(req.query) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async reconciliation(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().slice(0, 10);
      res.json({ success: true, data: await commerceService.getDailyReconciliation(date) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new CommerceController();
