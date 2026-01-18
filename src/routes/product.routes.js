const express = require('express');
const router = express.Router();

const productController = require('../controllers/product.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');
const {
  createProductValidation,
  updateProductValidation,
  listProductsValidation,
  getProductValidation
} = require('../validators/product.validator');

// Public routes
router.get('/', listProductsValidation, productController.getAllProducts);
router.get('/:id', getProductValidation, productController.getProductById);

// Protected routes (Admin only)
router.post('/', authenticate, isAdmin, createProductValidation, productController.createProduct);
router.put('/:id', authenticate, isAdmin, updateProductValidation, productController.updateProduct);
router.delete('/:id', authenticate, isAdmin, productController.deleteProduct);
router.patch('/:id/stock', authenticate, isAdmin, productController.updateStock);

module.exports = router;