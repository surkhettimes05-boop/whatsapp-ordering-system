const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authRateLimiter } = require('../middleware/rateLimit.middleware');
const {
  registerValidation,
  loginValidation,
  changePasswordValidation
} = require('../validators/auth.validator');

// Public routes (with strict rate limiting)
router.post('/register', authRateLimiter, registerValidation, authController.register);
router.post('/login', authRateLimiter, loginValidation, authController.login);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/change-password', authenticate, changePasswordValidation, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

module.exports = router;