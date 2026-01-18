const { body, query, param } = require('express-validator');

const createOrderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must have at least 1 item'),
  
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  
  body('addressId')
    .notEmpty()
    .withMessage('Delivery address is required'),
  
  body('paymentMethod')
    .optional()
    .isIn(['COD', 'ONLINE'])
    .withMessage('Invalid payment method'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

const updateOrderStatusValidation = [
  param('id')
    .notEmpty()
    .withMessage('Order ID is required'),
  
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'])
    .withMessage('Invalid order status'),
  
  body('adminNotes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Admin notes cannot exceed 500 characters')
];

const listOrdersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'])
    .withMessage('Invalid order status')
];

const getOrderValidation = [
  param('id')
    .notEmpty()
    .withMessage('Order ID is required')
];

module.exports = {
  createOrderValidation,
  updateOrderStatusValidation,
  listOrdersValidation,
  getOrderValidation
};