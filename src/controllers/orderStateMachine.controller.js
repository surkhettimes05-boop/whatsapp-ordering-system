/**
 * ORDER CONTROLLER WITH STATE MACHINE INTEGRATION
 * 
 * All order operations now use the state machine for consistency
 */

const { validationResult } = require('express-validator');
const orderStateMachine = require('../services/orderStateMachine.service');
const orderTransitionService = require('../services/orderTransition.service');
const { ORDER_STATES } = require('../constants/orderStates');
const { InvalidTransitionError, TerminalStateError } = require('../utils/orderStateMachineValidator');

class OrderControllerWithStateMachine {
  /**
   * Create a new order (initializes in CREATED state)
   */
  async createOrder(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { wholesalerId, items, paymentMode = 'COD' } = req.body;
      const retailerId = req.user.id;

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Items array is required and must not be empty'
        });
      }

      // Create order in CREATED state
      const order = await orderStateMachine.createOrder(
        retailerId,
        wholesalerId,
        items,
        paymentMode
      );

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          order,
          state: {
            current: order.status,
            validNextStates: ['CREDIT_APPROVED', 'FAILED', 'CANCELLED']
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Approve credit for an order (CREATED -> CREDIT_APPROVED)
   */
  async approveCreditForOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      // Approve credit (this would normally call credit service)
      const result = await orderStateMachine.approveCreditForOrder(orderId, {
        userId,
        creditService: req.services?.creditService
      });

      res.json({
        success: true,
        message: 'Credit approved for order',
        data: {
          order: result.order,
          transition: result.transition
        }
      });
    } catch (error) {
      this._handleError(res, error);
    }
  }

  /**
   * Reserve stock for an order (CREDIT_APPROVED -> STOCK_RESERVED)
   */
  async reserveStockForOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const result = await orderStateMachine.reserveStockForOrder(orderId, {
        userId,
        inventoryService: req.services?.inventoryService
      });

      res.json({
        success: true,
        message: 'Stock reserved for order',
        data: {
          order: result.order,
          transition: result.transition
        }
      });
    } catch (error) {
      this._handleError(res, error);
    }
  }

  /**
   * Accept order at wholesaler (STOCK_RESERVED -> WHOLESALER_ACCEPTED)
   */
  async acceptOrderAtWholesaler(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const result = await orderStateMachine.acceptOrderAtWholesaler(orderId, {
        userId
      });

      res.json({
        success: true,
        message: 'Order accepted at wholesaler',
        data: {
          order: result.order,
          transition: result.transition
        }
      });
    } catch (error) {
      this._handleError(res, error);
    }
  }

  /**
   * Start delivery (WHOLESALER_ACCEPTED -> OUT_FOR_DELIVERY)
   */
  async startDelivery(req, res) {
    try {
      const { orderId } = req.params;
      const { trackingId } = req.body;
      const userId = req.user.id;

      const result = await orderStateMachine.startDelivery(orderId, {
        userId,
        trackingId
      });

      res.json({
        success: true,
        message: 'Delivery started',
        data: {
          order: result.order,
          transition: result.transition
        }
      });
    } catch (error) {
      this._handleError(res, error);
    }
  }

  /**
   * Complete delivery (OUT_FOR_DELIVERY -> DELIVERED)
   */
  async completeDelivery(req, res) {
    try {
      const { orderId } = req.params;
      const { signature } = req.body;
      const userId = req.user.id;

      const result = await orderStateMachine.completeDelivery(orderId, {
        userId,
        signature,
        creditService: req.services?.creditService,
        inventoryService: req.services?.inventoryService
      });

      res.json({
        success: true,
        message: 'Order successfully delivered',
        data: {
          order: result.order,
          transition: result.transition
        }
      });
    } catch (error) {
      this._handleError(res, error);
    }
  }

  /**
   * Mark order as failed
   */
  async failOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { reason = 'Unknown error' } = req.body;
      const userId = req.user.id;

      const result = await orderStateMachine.failOrder(orderId, reason, {
        userId,
        creditService: req.services?.creditService,
        inventoryService: req.services?.inventoryService
      });

      res.json({
        success: true,
        message: 'Order marked as failed',
        data: {
          order: result.order,
          transition: result.transition
        }
      });
    } catch (error) {
      this._handleError(res, error);
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      const { reason = 'User requested cancellation' } = req.body;
      const userId = req.user.id;

      const result = await orderStateMachine.cancelOrder(orderId, reason, {
        userId,
        creditService: req.services?.creditService,
        inventoryService: req.services?.inventoryService
      });

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: {
          order: result.order,
          transition: result.transition
        }
      });
    } catch (error) {
      this._handleError(res, error);
    }
  }

  /**
   * Get order current state
   */
  async getOrderState(req, res) {
    try {
      const { orderId } = req.params;

      const stateInfo = await orderStateMachine.getOrderState(orderId);

      res.json({
        success: true,
        data: stateInfo
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get order with full state machine info
   */
  async getOrderStateMachineInfo(req, res) {
    try {
      const { orderId } = req.params;

      const info = await orderStateMachine.getOrderStateMachineInfo(orderId);

      res.json({
        success: true,
        data: info
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get transition history for an order
   */
  async getTransitionHistory(req, res) {
    try {
      const { orderId } = req.params;

      const history = await orderTransitionService.getTransitionHistory(orderId);

      res.json({
        success: true,
        data: {
          orderId,
          transitionCount: history.length,
          transitions: history
        }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Validate order can proceed to next state
   */
  async validateOrderTransition(req, res) {
    try {
      const { orderId } = req.params;
      const { nextState } = req.body;

      if (!nextState) {
        return res.status(400).json({
          success: false,
          error: 'nextState is required in request body'
        });
      }

      const validation = await orderStateMachine.validateOrderReadiness(orderId, nextState);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle errors with proper HTTP status codes
   * 
   * @private
   */
  _handleError(res, error) {
    if (error instanceof InvalidTransitionError) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 'INVALID_TRANSITION',
        fromState: error.fromState,
        toState: error.toState
      });
    }

    if (error instanceof TerminalStateError) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 'TERMINAL_STATE_ERROR',
        state: error.state
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('Insufficient')) {
      return res.status(402).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = new OrderControllerWithStateMachine();
