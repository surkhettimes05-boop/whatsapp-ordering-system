const { body, query, param } = require('express-validator');

const createProductValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Product name must be between 2 and 200 characters'),
  
  body('sku')
    .trim()
    .notEmpty()
    .withMessage('SKU is required'),
  
  body('categoryId')
    .notEmpty()
    .withMessage('Category is required'),
  
  body('basePrice')
    .notEmpty()
    .withMessage('Base price is required')
    .isFloat({ min: 0 })
    .withMessage('Base price must be a positive number'),
  
  body('stock')
    .notEmpty()
    .withMessage('Stock quantity is required')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
];

const updateProductValidation = [
  param('id').notEmpty().withMessage('Product ID is required')
];

const listProductsValidation = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const getProductValidation = [
  param('id').notEmpty().withMessage('Product ID is required')
];

module.exports = {
  createProductValidation,
  updateProductValidation,
  listProductsValidation,
  getProductValidation
};