const { validationResult } = require('express-validator');
const authService = require('../services/auth.service');

class AuthController {
  /**
   * @route   POST /api/v1/auth/register
   * @desc    Register new user
   * @access  Public
   */
  async register(req, res) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      // Register user
      const result = await authService.register(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result
      });
      
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * @route   POST /api/v1/auth/login
   * @desc    Login user
   * @access  Public
   */
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { phoneNumber, password } = req.body;
      const result = await authService.login(phoneNumber, password);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * @route   GET /api/v1/auth/me
   * @desc    Get current user
   * @access  Private
   */
  async getMe(req, res) {
    try {
      const user = await authService.getUserById(req.user.id);
      
      res.json({
        success: true,
        data: { user }
      });
      
    } catch (error) {
      console.error('Get me error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * @route   PUT /api/v1/auth/profile
   * @desc    Update user profile
   * @access  Private
   */
  async updateProfile(req, res) {
    try {
      const user = await authService.updateProfile(req.user.id, req.body);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
      
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * @route   POST /api/v1/auth/change-password
   * @desc    Change password
   * @access  Private
   */
  async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );
      
      res.json({
        success: true,
        message: result.message
      });
      
    } catch (error) {
      console.error('Change password error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * @route   POST /api/v1/auth/logout
   * @desc    Logout user
   * @access  Private
   */
  async logout(req, res) {
    res.json({
      success: true,
      message: 'Logout successful. Please delete your token from client storage.'
    });
  }
}

module.exports = new AuthController();