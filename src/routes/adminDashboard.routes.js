// Admin Routes - Products, Inbox, Team Management
const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboard.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// All admin routes require authentication and admin role
router.use(authenticate, isAdmin);

// ============================================
// PRODUCT MANAGEMENT
// ============================================

/**
 * GET /api/v1/admin/products
 * Get all products with filters
 * Query params: skip, take, categoryId, isActive, sortBy
 */
router.get('/products', adminDashboardController.getAllProducts);

/**
 * GET /api/v1/admin/products/:id
 * Get specific product
 */
router.get('/products/:id', adminDashboardController.getProduct);

/**
 * POST /api/v1/admin/products
 * Create new product
 * Body: name, description, categoryId, basePrice, image, unit, minOrderQuantity, wholesalerPrices
 */
router.post('/products', adminDashboardController.createProduct);

/**
 * PUT /api/v1/admin/products/:id
 * Update product
 */
router.put('/products/:id', adminDashboardController.updateProduct);

/**
 * DELETE /api/v1/admin/products/:id
 * Delete (deactivate) product
 */
router.delete('/products/:id', adminDashboardController.deleteProduct);

/**
 * PATCH /api/v1/admin/products/:id/stock
 * Update product stock for wholesaler
 * Body: wholesalerId, stock
 */
router.patch('/products/:id/stock', adminDashboardController.updateProductStock);

/**
 * GET /api/v1/admin/products/stats/bulk
 * Get product statistics (low stock, top sellers, etc.)
 */
router.get('/products/stats/bulk', adminDashboardController.getProductStats);

// ============================================
// SHARED INBOX MANAGEMENT
// ============================================

/**
 * GET /api/v1/admin/inbox
 * Get shared inbox conversations
 * Query params: userId, status, skip, take
 * status options: OPEN, CLOSED, PENDING
 */
router.get('/inbox', adminDashboardController.getSharedInbox);

/**
 * GET /api/v1/admin/inbox/:id
 * Get specific conversation with all messages
 */
router.get('/inbox/:id', adminDashboardController.getConversation);

/**
 * POST /api/v1/admin/inbox/:conversationId/assign
 * Assign conversation to team member
 * Body: userId
 */
router.post('/inbox/:conversationId/assign', adminDashboardController.assignConversation);

/**
 * POST /api/v1/admin/inbox/:id/unassign
 * Unassign conversation
 */
router.post('/inbox/:id/unassign', adminDashboardController.unassignConversation);

/**
 * POST /api/v1/admin/inbox/:id/resolve
 * Mark conversation as resolved
 * Body: notes (optional)
 */
router.post('/inbox/:id/resolve', adminDashboardController.resolveConversation);

/**
 * POST /api/v1/admin/inbox/:id/reopen
 * Reopen resolved conversation
 */
router.post('/inbox/:id/reopen', adminDashboardController.reopenConversation);

// ============================================
// TEAM MEMBER MANAGEMENT
// ============================================

/**
 * GET /api/v1/admin/team
 * Get all team members
 */
router.get('/team', adminDashboardController.getTeamMembers);

/**
 * POST /api/v1/admin/team
 * Create new team member
 * Body: phoneNumber, name, email, role
 */
router.post('/team', adminDashboardController.createTeamMember);

/**
 * GET /api/v1/admin/team/:userId/stats
 * Get team member stats (assigned conversations, response time, etc.)
 */
router.get('/team/:userId/stats', adminDashboardController.getTeamMemberStats);

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

/**
 * GET /api/v1/admin/dashboard
 * Get dashboard stats (orders, revenue, messages, users)
 */
router.get('/dashboard', adminDashboardController.getDashboard);

/**
 * GET /api/v1/admin/activity-log
 * Get admin activity log
 * Query params: userId, action, since, skip, take
 */
router.get('/activity-log', adminDashboardController.getActivityLog);

module.exports = router;
