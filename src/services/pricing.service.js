const prisma = require('../config/database');

class PricingService {
  /**
   * Calculate price for a product based on user and quantity
   */
  async calculatePrice(productId, userId, quantity = 1) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true
      }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    let basePrice = parseFloat(product.basePrice);
    let finalPrice = basePrice;

    // Get applicable pricing rules
    const rules = await this.getApplicableRules(productId, product.categoryId, userId, quantity);

    // Apply rules (highest priority first)
    for (const rule of rules) {
      if (rule.discountType === 'PERCENTAGE') {
        const discount = (basePrice * parseFloat(rule.discountValue)) / 100;
        finalPrice = basePrice - discount;
      } else if (rule.discountType === 'FIXED') {
        finalPrice = basePrice - parseFloat(rule.discountValue);
      } else if (rule.fixedPrice) {
        finalPrice = parseFloat(rule.fixedPrice);
      }
    }

    // Apply product-level discount
    if (product.discount) {
      const discount = (finalPrice * parseFloat(product.discount)) / 100;
      finalPrice = finalPrice - discount;
    }

    // Use wholesale price if available and user is wholesaler
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role === 'WHOLESALER' && product.wholesalePrice) {
      finalPrice = parseFloat(product.wholesalePrice);
    }

    return {
      basePrice,
      finalPrice: Math.max(0, finalPrice), // Ensure non-negative
      discount: basePrice - finalPrice,
      discountPercentage: basePrice > 0 ? ((basePrice - finalPrice) / basePrice) * 100 : 0
    };
  }

  /**
   * Get applicable pricing rules
   */
  async getApplicableRules(productId, categoryId, userId, quantity) {
    const now = new Date();

    const rules = await prisma.pricingRule.findMany({
      where: {
        isActive: true,
        OR: [
          { productId },
          { categoryId },
          { userId },
          { ruleType: 'BULK' }
        ],
        AND: [
          {
            OR: [
              { startDate: null },
              { startDate: { lte: now } }
            ]
          },
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } }
            ]
          }
        ]
      },
      orderBy: [
        { ruleType: 'asc' }, // USER_SPECIFIC > CATEGORY > PRODUCT > BULK
        { discountValue: 'desc' }
      ]
    });

    // Filter by quantity constraints
    return rules.filter(rule => {
      if (rule.minQuantity && quantity < rule.minQuantity) return false;
      if (rule.maxQuantity && quantity > rule.maxQuantity) return false;
      return true;
    });
  }

  /**
   * Create pricing rule
   */
  async createPricingRule(ruleData) {
    const rule = await prisma.pricingRule.create({
      data: ruleData
    });

    return rule;
  }

  /**
   * Get all pricing rules
   */
  async getPricingRules(filters = {}) {
    const { page = 1, limit = 50, isActive, ruleType } = filters;
    const skip = (page - 1) * limit;

    const where = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (ruleType) where.ruleType = ruleType;

    const [rules, total] = await Promise.all([
      prisma.pricingRule.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.pricingRule.count({ where })
    ]);

    return {
      rules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update pricing rule
   */
  async updatePricingRule(ruleId, updateData) {
    const rule = await prisma.pricingRule.update({
      where: { id: ruleId },
      data: updateData
    });

    return rule;
  }

  /**
   * Delete pricing rule
   */
  async deletePricingRule(ruleId) {
    await prisma.pricingRule.delete({
      where: { id: ruleId }
    });

    return { success: true };
  }
}

module.exports = new PricingService();

