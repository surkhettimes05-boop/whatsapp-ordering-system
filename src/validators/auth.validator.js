const { body } = require('express-validator');

// Registration validation
const registerValidation = [
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[1-9]\d{9,14}$/)
    .withMessage('Please provide a valid phone number with country code'),
  
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('businessName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Business name must be between 2 and 200 characters'),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  
  body('role')
    .optional()
    .isIn(['RETAILER', 'WHOLESALER'])
    .withMessage('Role must be either RETAILER or WHOLESALER')
];

// Login validation
const loginValidation = [
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Change password validation
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase, lowercase, and number')
];

module.exports = {
  registerValidation,
  loginValidation,
  changePasswordValidation
};