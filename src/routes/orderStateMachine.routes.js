/**
 * ORDER STATE MACHINE ROUTES
 * 
 * All order operations that follow the strict state machine
 */

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const orderControllerStateMachine = require('../controllers/orderStateMachine.controller');
const { authenticateJWT, authorize } = require('../middleware/auth.middleware');

// Middleware
router.use(authenticateJWT);

/**
 * POST /api/v1/orders/state-machine/create
 * Create a new order (initializes in CREATED state)
 */
router.post(
  '/state-machine/create',
  [
    body('wholesalerId').notEmpty().withMessage('Wholesaler ID is required'),
    body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
    body('items.*.productId').notEmpty().withMessage('Product ID is required for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMode').optional().isIn(['COD', 'CREDIT']).withMessage('Invalid payment mode')
  ],
  orderControllerStateMachine.createOrder.bind(orderControllerStateMachine)
);

/**
 * POST /api/v1/orders/:orderId/state-machine/approve-credit
 * Transition from CREATED to CREDIT_APPROVED
 */
router.post(
  '/:orderId/state-machine/approve-credit',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.approveCreditForOrder.bind(orderControllerStateMachine)
);

/**
 * POST /api/v1/orders/:orderId/state-machine/reserve-stock
 * Transition from CREDIT_APPROVED to STOCK_RESERVED
 */
router.post(
  '/:orderId/state-machine/reserve-stock',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.reserveStockForOrder.bind(orderControllerStateMachine)
);

/**
 * POST /api/v1/orders/:orderId/state-machine/accept
 * Transition from STOCK_RESERVED to WHOLESALER_ACCEPTED
 */
router.post(
  '/:orderId/state-machine/accept',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.acceptOrderAtWholesaler.bind(orderControllerStateMachine)
);

/**
 * POST /api/v1/orders/:orderId/state-machine/start-delivery
 * Transition from WHOLESALER_ACCEPTED to OUT_FOR_DELIVERY
 */
router.post(
  '/:orderId/state-machine/start-delivery',
  [
    param('orderId').notEmpty().withMessage('Order ID is required'),
    body('trackingId').optional().isString().withMessage('Tracking ID must be a string')
  ],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.startDelivery.bind(orderControllerStateMachine)
);

/**
 * POST /api/v1/orders/:orderId/state-machine/complete-delivery
 * Transition from OUT_FOR_DELIVERY to DELIVERED
 */
router.post(
  '/:orderId/state-machine/complete-delivery',
  [
    param('orderId').notEmpty().withMessage('Order ID is required'),
    body('signature').optional().isString().withMessage('Signature must be a string')
  ],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.completeDelivery.bind(orderControllerStateMachine)
);

/**
 * POST /api/v1/orders/:orderId/state-machine/fail
 * Mark order as FAILED from any valid state
 */
router.post(
  '/:orderId/state-machine/fail',
  [
    param('orderId').notEmpty().withMessage('Order ID is required'),
    body('reason').optional().isString().withMessage('Reason must be a string')
  ],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.failOrder.bind(orderControllerStateMachine)
);

/**
 * POST /api/v1/orders/:orderId/state-machine/cancel
 * Cancel an order from any valid state
 */
router.post(
  '/:orderId/state-machine/cancel',
  [
    param('orderId').notEmpty().withMessage('Order ID is required'),
    body('reason').optional().isString().withMessage('Reason must be a string')
  ],
  orderControllerStateMachine.cancelOrder.bind(orderControllerStateMachine)
);

/**
 * GET /api/v1/orders/:orderId/state-machine/state
 * Get current order state and valid next states
 */
router.get(
  '/:orderId/state-machine/state',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  orderControllerStateMachine.getOrderState.bind(orderControllerStateMachine)
);

/**
 * GET /api/v1/orders/:orderId/state-machine/info
 * Get complete order state machine information
 */
router.get(
  '/:orderId/state-machine/info',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.getOrderStateMachineInfo.bind(orderControllerStateMachine)
);

/**
 * GET /api/v1/orders/:orderId/state-machine/history
 * Get order transition history with timestamps and reasons
 */
router.get(
  '/:orderId/state-machine/history',
  [param('orderId').notEmpty().withMessage('Order ID is required')],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.getTransitionHistory.bind(orderControllerStateMachine)
);

/**
 * POST /api/v1/orders/:orderId/state-machine/validate-transition
 * Validate if order can proceed to next state
 */
router.post(
  '/:orderId/state-machine/validate-transition',
  [
    param('orderId').notEmpty().withMessage('Order ID is required'),
    body('nextState').notEmpty().withMessage('Next state is required')
  ],
  authorize(['ADMIN', 'STAFF']),
  orderControllerStateMachine.validateOrderTransition.bind(orderControllerStateMachine)
);

module.exports = router;
