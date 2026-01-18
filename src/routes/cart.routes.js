const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const prisma = require('../config/database');

router.use(authenticate);

// Get cart
router.get('/', async (req, res) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: {
        product: true
      }
    });
    
    res.json({
      success: true,
      data: { cartItems }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add to cart
router.post('/', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const cartItem = await prisma.cartItem.upsert({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId
        }
      },
      update: {
        quantity: { increment: quantity || 1 }
      },
      create: {
        userId: req.user.id,
        productId,
        quantity: quantity || 1
      },
      include: {
        product: true
      }
    });
    
    res.json({
      success: true,
      message: 'Product added to cart',
      data: { cartItem }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update cart item
router.put('/:productId', async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (quantity <= 0) {
      await prisma.cartItem.delete({
        where: {
          userId_productId: {
            userId: req.user.id,
            productId: req.params.productId
          }
        }
      });
      
      return res.json({
        success: true,
        message: 'Item removed from cart'
      });
    }
    
    const cartItem = await prisma.cartItem.update({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId: req.params.productId
        }
      },
      data: { quantity },
      include: {
        product: true
      }
    });
    
    res.json({
      success: true,
      message: 'Cart updated',
      data: { cartItem }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Remove from cart
router.delete('/:productId', async (req, res) => {
  try {
    await prisma.cartItem.delete({
      where: {
        userId_productId: {
          userId: req.user.id,
          productId: req.params.productId
        }
      }
    });
    
    res.json({
      success: true,
      message: 'Item removed from cart'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Clear cart
router.delete('/', async (req, res) => {
  try {
    await prisma.cartItem.deleteMany({
      where: { userId: req.user.id }
    });
    
    res.json({
      success: true,
      message: 'Cart cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;