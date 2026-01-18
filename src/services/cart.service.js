const prisma = require('../config/database');

class CartService {
  /**
   * Get user's cart
   */
  async getCart(userId) {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: true
          }
        }
      }
    });

    return {
      items: cartItems,
      itemCount: cartItems.length,
      totalItems: cartItems.reduce((sum, item) => sum + item.quantity, 0)
    };
  }

  /**
   * Add item to cart
   */
  async addToCart(userId, productId, quantity = 1) {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.isActive) {
      throw new Error('Product is not available');
    }

    if (product.stock < quantity) {
      throw new Error(`Insufficient stock. Available: ${product.stock}`);
    }

    const cartItem = await prisma.cartItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId
        }
      },
      update: {
        quantity: { increment: quantity }
      },
      create: {
        userId,
        productId,
        quantity
      },
      include: {
        product: true
      }
    });

    return cartItem;
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(userId, productId, quantity) {
    if (quantity <= 0) {
      return await this.removeFromCart(userId, productId);
    }

    const cartItem = await prisma.cartItem.update({
      where: {
        userId_productId: {
          userId,
          productId
        }
      },
      data: { quantity },
      include: {
        product: true
      }
    });

    return cartItem;
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(userId, productId) {
    await prisma.cartItem.delete({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    return { success: true };
  }

  /**
   * Clear cart
   */
  async clearCart(userId) {
    await prisma.cartItem.deleteMany({
      where: { userId }
    });

    return { success: true };
  }
}

module.exports = new CartService();

