const pricingService = require('../services/pricing.service');
const { validationResult } = require('express-validator');

class PricingController {
  /**
   * Calculate price for product
   */
  async calculatePrice(req, res) {
    try {
      const { productId, quantity = 1 } = req.body;
      const userId = req.user?.id;

      const pricing = await pricingService.calculatePrice(productId, userId, quantity);

      res.json({
        success: true,
        data: pricing
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create pricing rule (Admin)
   */
  async createPricingRule(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const rule = await pricingService.createPricingRule(req.body);

      res.status(201).json({
        success: true,
        message: 'Pricing rule created',
        data: { rule }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all pricing rules
   */
  async getPricingRules(req, res) {
    try {
      const result = await pricingService.getPricingRules(req.query);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update pricing rule
   */
  async updatePricingRule(req, res) {
    try {
      const { id } = req.params;
      const rule = await pricingService.updatePricingRule(id, req.body);

      res.json({
        success: true,
        message: 'Pricing rule updated',
        data: { rule }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete pricing rule
   */
  async deletePricingRule(req, res) {
    try {
      const { id } = req.params;
      await pricingService.deletePricingRule(id);

      res.json({
        success: true,
        message: 'Pricing rule deleted'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PricingController();

