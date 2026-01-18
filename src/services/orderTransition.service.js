/**
 * ORDER STATE TRANSITION HELPER SERVICE
 * 
 * Manages state transitions with logging and business logic execution
 */

const prisma = require('../config/database');
const { ORDER_STATES, STATE_TRIGGERS } = require('../constants/orderStates');
const { OrderStateMachineValidator, InvalidTransitionError } = require('../utils/orderStateMachineValidator');

class OrderTransitionService {
  /**
   * Transition order to a new state
   * 
   * @param {string} orderId - Order ID
   * @param {string} targetState - Target state to transition to
   * @param {Object} options - Transition options
   * @param {string} options.reason - Reason for transition
   * @param {string} options.userId - User performing transition (for logging)
   * @param {Object} options.metadata - Additional transition metadata
   * @returns {Object} Updated order with transition history
   */
  async transitionTo(orderId, targetState, options = {}) {
    const { reason = '', userId = 'system', metadata = {} } = options;

    // Get current order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { transitionHistory: true }
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const currentState = order.status;

    // Validate transition
    try {
      OrderStateMachineValidator.validateTransition(currentState, targetState);
    } catch (error) {
      throw new InvalidTransitionError(
        `Cannot transition order ${orderId} from ${currentState} to ${targetState}: ${error.message}`,
        currentState,
        targetState
      );
    }

    // Begin transaction for atomic update
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: targetState,
          updatedAt: new Date()
        }
      });

      // Log transition
      await tx.orderTransitionLog.create({
        data: {
          orderId,
          fromState: currentState,
          toState: targetState,
          reason,
          userId,
          metadata: JSON.stringify(metadata),
          timestamp: new Date()
        }
      });

      return updated;
    });

    // Log transition in audit log
    await this._logTransition(orderId, currentState, targetState, reason, userId);

    return {
      order: updatedOrder,
      transition: {
        from: currentState,
        to: targetState,
        timestamp: new Date(),
        reason,
        userId
      }
    };
  }

  /**
   * Attempt a direct state transition with business logic
   * 
   * @param {string} orderId - Order ID
   * @param {string} targetState - Target state
   * @param {Object} businessLogicContext - Context for business logic execution
   * @returns {Object} Updated order with execution results
   */
  async transitionWithBusinessLogic(orderId, targetState, businessLogicContext = {}) {
    // Get current order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        retailer: true,
        wholesaler: true,
        items: { include: { product: true } }
      }
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Validate transition
    OrderStateMachineValidator.validateTransition(order.status, targetState);

    // Execute pre-transition business logic
    const executionResults = await this._executeStateTransitionLogic(
      order,
      order.status,
      targetState,
      businessLogicContext
    );

    // Perform the transition
    const result = await this.transitionTo(orderId, targetState, {
      reason: businessLogicContext.reason || `Transitioned to ${targetState}`,
      userId: businessLogicContext.userId || 'system',
      metadata: executionResults
    });

    return {
      ...result,
      businessLogicResults: executionResults
    };
  }

  /**
   * Execute business logic for state transitions
   * 
   * @private
   * @param {Object} order - Order object
   * @param {string} fromState - From state
   * @param {string} toState - To state
   * @param {Object} context - Business logic context
   * @returns {Object} Execution results
   */
  async _executeStateTransitionLogic(order, fromState, toState, context) {
    const results = {
      validations: [],
      operations: [],
      errors: []
    };

    try {
      // Execute logic based on target state
      switch (toState) {
        case ORDER_STATES.CREDIT_APPROVED:
          results.operations.push('credit_validated');
          // Validate credit availability
          if (context.creditService) {
            const creditCheck = await context.creditService.checkCreditAvailability(
              order.retailerId,
              order.wholesalerId,
              order.totalAmount
            );
            if (!creditCheck.available) {
              throw new Error(`Insufficient credit: ${creditCheck.reason}`);
            }
            results.validations.push({ type: 'credit', status: 'approved' });
          }
          break;

        case ORDER_STATES.STOCK_RESERVED:
          results.operations.push('stock_reserved');
          // Reserve stock
          if (context.inventoryService) {
            const itemsToReserve = order.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity
            }));
            const reservation = await context.inventoryService.reserveStock(
              order.id,
              order.wholesalerId,
              itemsToReserve
            );
            results.validations.push({ type: 'stock', status: 'reserved', reservationId: reservation.id });
          }
          break;

        case ORDER_STATES.WHOLESALER_ACCEPTED:
          results.operations.push('wholesaler_notified');
          // Notify wholesaler (send WhatsApp message, etc.)
          if (context.notificationService) {
            await context.notificationService.notifyWholesalerOrderAccepted(order);
            results.operations.push('wholesaler_notification_sent');
          }
          break;

        case ORDER_STATES.OUT_FOR_DELIVERY:
          results.operations.push('delivery_started');
          // Start delivery tracking
          break;

        case ORDER_STATES.DELIVERED:
          results.operations.push('order_delivered');
          // Deduct credit from retailer
          if (context.creditService) {
            await context.creditService.deductCredit(
              order.retailerId,
              order.wholesalerId,
              order.totalAmount
            );
            results.operations.push('credit_deducted');
          }
          // Deduct stock
          if (context.inventoryService) {
            await context.inventoryService.deductStock(order.id);
            results.operations.push('stock_deducted');
          }
          break;

        case ORDER_STATES.FAILED:
          results.operations.push('order_failed');
          // Release reserved stock and credit hold
          if (context.inventoryService && fromState === ORDER_STATES.STOCK_RESERVED) {
            await context.inventoryService.releaseStock(order.id);
            results.operations.push('stock_released');
          }
          if (context.creditService && fromState === ORDER_STATES.CREDIT_APPROVED) {
            await context.creditService.releaseCreditHold(order.id);
            results.operations.push('credit_hold_released');
          }
          break;

        case ORDER_STATES.CANCELLED:
          results.operations.push('order_cancelled');
          // Release all holds
          if (context.inventoryService) {
            await context.inventoryService.releaseStock(order.id);
            results.operations.push('stock_released');
          }
          if (context.creditService) {
            await context.creditService.releaseCreditHold(order.id);
            results.operations.push('credit_hold_released');
          }
          break;
      }
    } catch (error) {
      results.errors.push({
        operation: toState,
        error: error.message
      });
      throw error; // Re-throw to prevent state transition
    }

    return results;
  }

  /**
   * Get transition history for an order
   * 
   * @param {string} orderId - Order ID
   * @returns {Object[]} Array of transitions
   */
  async getTransitionHistory(orderId) {
    const history = await prisma.orderTransitionLog.findMany({
      where: { orderId },
      orderBy: { timestamp: 'asc' }
    });

    return history.map(entry => ({
      from: entry.fromState,
      to: entry.toState,
      reason: entry.reason,
      userId: entry.userId,
      timestamp: entry.timestamp,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : {}
    }));
  }

  /**
   * Log transition in audit log
   * 
   * @private
   */
  async _logTransition(orderId, fromState, toState, reason, userId) {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'ORDER_STATE_TRANSITION',
          entity: 'Order',
          entityId: orderId,
          details: JSON.stringify({
            from: fromState,
            to: toState,
            reason
          }),
          userId,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to log transition:', error);
      // Don't throw - logging failure should not break the transition
    }
  }
}

module.exports = new OrderTransitionService();
