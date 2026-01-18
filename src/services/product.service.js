const prisma = require('../config/database');

class ProductService {
  async createProduct(data) {
    const { name, categoryId, fixedPrice, unit } = data;
    return prisma.product.create({
      data: {
        name,
        categoryId,
        fixedPrice: parseFloat(fixedPrice),
        unit,
        isActive: true
      },
      include: { category: true }
    });
  }

  async getProducts(filters = {}) {
    const where = { isActive: true };
    if (filters.search) {
      where.name = { contains: filters.search };
    }
    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      take: 50
    });
    return { products, pagination: { total: products.length } };
  }

  async getProductById(id) {
    return prisma.product.findUnique({ where: { id }, include: { category: true } });
  }

  async updateProduct(id, data) {
    return prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        fixedPrice: data.fixedPrice ? parseFloat(data.fixedPrice) : undefined,
        unit: data.unit,
        isActive: data.isActive
      }
    });
  }

  async deleteProduct(id) {
    return prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}

module.exports = new ProductService();