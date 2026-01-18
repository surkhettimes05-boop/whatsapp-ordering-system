const prisma = require('../config/database');
const orderStateMachine = require('./orderStateMachine.service');
const orderDecisionService = require('./orderDecision.service');
const stockService = require('./stock.service');
const whatsappService = require('./whatsapp.service');
const { withTransaction } = require('../utils/transaction');

class AdminService {
  /**
   * Overrides the credit limit for a retailer.
   * @param {string} adminId - The ID of the admin performing the action.
   * @param {string} retailerId - The ID of the retailer.
   * @param {number} newCreditLimit - The new credit limit.
   * @param {string} reason - The reason for the override.
   * @returns {Promise<Object>} The updated credit account.
   */
  async overrideCreditLimit(adminId, retailerId, newCreditLimit, reason) {
    const creditAccount = await prisma.creditAccount.findUnique({
      where: { retailerId },
    });

    let updatedCreditAccount;
    if (creditAccount) {
      updatedCreditAccount = await prisma.creditAccount.update({
        where: { retailerId },
        data: { creditLimit: newCreditLimit },
      });
    } else {
      updatedCreditAccount = await prisma.creditAccount.create({
        data: {
          retailerId,
          creditLimit: newCreditLimit,
        },
      });
    }

    await this.logAdminAction(
      adminId,
      'CREDIT_LIMIT_OVERRIDE',
      retailerId,
      reason
    );

    return updatedCreditAccount;
  }

  /**
   * Validates that an order can be modified (not DELIVERED or CANCELLED)
   * @param {string} orderId - The ID of the order to validate
   * @throws {Error} If order is DELIVERED or CANCELLED
   */
  async validateOrderCanBeModified(orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
      throw new Error(`Cannot modify order ${orderId} with status ${order.status}`);
    }

    return order;
  }

  /**
   * Forces the cancellation of an order.
   * @param {string} adminId - The ID of the admin performing the action.
   * @param {string} orderId - The ID of the order to cancel.
   * @param {string} reason - The reason for the forced cancellation.
   * @returns {Promise<Object>} The updated order.
   */
  async forceCancelOrder(adminId, orderId, reason) {
    // Validate order can be modified
    await this.validateOrderCanBeModified(orderId);

    return withTransaction(async (tx) => {
      // Release stock if any reservations exist
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: 'ACTIVE' }
      });

      for (const res of reservations) {
        await tx.wholesalerProduct.update({
          where: { id: res.wholesalerProductId },
          data: { reservedStock: { decrement: res.quantity } }
        });
        await tx.stockReservation.update({
          where: { id: res.id },
          data: { status: 'RELEASED' }
        });
      }

      // Reverse ledger entry if exists
      const ledgerEntry = await tx.ledgerEntry.findFirst({
        where: {
          orderId: orderId,
          entryType: 'DEBIT'
        },
        orderBy: { createdAt: 'desc' }
      });

      if (ledgerEntry) {
        const lastEntry = await tx.ledgerEntry.findFirst({
          where: {
            retailerId: ledgerEntry.retailerId,
            wholesalerId: ledgerEntry.wholesalerId
          },
          orderBy: { createdAt: 'desc' }
        });

        const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
        const newBalance = currentBalance - Number(ledgerEntry.amount);

        await tx.ledgerEntry.create({
          data: {
            retailerId: ledgerEntry.retailerId,
            wholesalerId: ledgerEntry.wholesalerId,
            orderId: orderId,
            entryType: 'CREDIT',
            amount: ledgerEntry.amount,
            balanceAfter: newBalance,
            createdBy: 'SYSTEM'
          }
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          failureReason: `Admin cancelled: ${reason}`,
          failedAt: new Date()
        }
      });

      // Log admin action (outside transaction to ensure it persists)
      await this.logAdminAction(
        adminId,
        'ORDER_CANCELLATION_OVERRIDE',
        orderId,
        reason
      );

      return updatedOrder;
    }, {
      operation: 'ADMIN_CANCEL_ORDER',
      entityId: orderId,
      entityType: 'Order',
      timeout: 15000
    });
  }

  /**
   * Force select a vendor for an order (admin override)
   * @param {string} adminId - The ID of the admin performing the action.
   * @param {string} orderId - The ID of the order.
   * @param {string} wholesalerId - The ID of the wholesaler to force select.
   * @param {string} reason - The reason for the override.
   * @returns {Promise<Object>} The updated order.
   */
  async forceSelectVendor(adminId, orderId, wholesalerId, reason) {
    // Validate order can be modified
    await this.validateOrderCanBeModified(orderId);

    // Check if vendor offer exists for this order
    const vendorOffer = await prisma.vendorOffer.findUnique({
      where: {
        order_id_wholesaler_id: {
          order_id: orderId,
          wholesaler_id: wholesalerId
        }
      },
      include: {
        wholesaler: {
          select: {
            id: true,
            businessName: true,
            whatsappNumber: true
          }
        }
      }
    });

    if (!vendorOffer) {
      throw new Error(`No vendor offer found for order ${orderId} and wholesaler ${wholesalerId}`);
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        retailer: {
          select: {
            id: true,
            phoneNumber: true,
            pasalName: true
          }
        },
        items: {
          select: {
            productId: true,
            quantity: true
          }
        }
      }
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Use transaction framework to ensure atomicity
    const result = await withTransaction(async (tx) => {
      // Release any existing stock reservations
      const existingReservations = await tx.stockReservation.findMany({
        where: { orderId, status: 'ACTIVE' }
      });

      for (const res of existingReservations) {
        await tx.wholesalerProduct.update({
          where: { id: res.wholesalerProductId },
          data: { reservedStock: { decrement: res.quantity } }
        });
        await tx.stockReservation.update({
          where: { id: res.id },
          data: { status: 'RELEASED' }
        });
      }

      // Reverse any existing ledger entries
      const existingLedger = await tx.ledgerEntry.findFirst({
        where: {
          orderId: orderId,
          entryType: 'DEBIT'
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingLedger) {
        const lastEntry = await tx.ledgerEntry.findFirst({
          where: {
            retailerId: order.retailerId,
            wholesalerId: existingLedger.wholesalerId
          },
          orderBy: { createdAt: 'desc' }
        });

        const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
        const newBalance = currentBalance - Number(existingLedger.amount);

        await tx.ledgerEntry.create({
          data: {
            retailerId: order.retailerId,
            wholesalerId: existingLedger.wholesalerId,
            orderId: orderId,
            entryType: 'CREDIT',
            amount: existingLedger.amount,
            balanceAfter: newBalance,
            createdBy: 'SYSTEM'
          }
        });
      }

      // Perform financial and inventory checks for new vendor
      const itemsForStockCheck = order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));

      // Check credit
      const creditCheck = await orderDecisionService.checkRetailerCredit(
        tx,
        order.retailerId,
        wholesalerId,
        order.totalAmount
      );

      if (!creditCheck.canPlace) {
        throw new Error(`Credit check failed: ${creditCheck.reason}`);
      }

      // Check and reserve stock
      const stockCheck = await orderDecisionService.checkAndReserveStock(
        tx,
        wholesalerId,
        itemsForStockCheck,
        orderId
      );

      if (!stockCheck.success) {
        throw new Error(`Stock check failed: ${stockCheck.reason}`);
      }

      // Create ledger entry
      const creditConfig = await tx.retailerWholesalerCredit.findUnique({
        where: {
          retailerId_wholesalerId: {
            retailerId: order.retailerId,
            wholesalerId: wholesalerId
          }
        }
      });

      const creditTerms = creditConfig?.creditTerms || 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + creditTerms);

      const lastEntry = await tx.ledgerEntry.findFirst({
        where: {
          retailerId: order.retailerId,
          wholesalerId: wholesalerId
        },
        orderBy: { createdAt: 'desc' }
      });

      const currentBalance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
      const newBalance = currentBalance + Number(order.totalAmount);

      await tx.ledgerEntry.create({
        data: {
          retailerId: order.retailerId,
          wholesalerId: wholesalerId,
          orderId: orderId,
          entryType: 'DEBIT',
          amount: order.totalAmount,
          balanceAfter: newBalance,
          dueDate: dueDate,
          createdBy: 'SYSTEM'
        }
      });

      // Update order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          final_wholesaler_id: wholesalerId,
          wholesalerId: wholesalerId,
          status: 'WHOLESALER_ACCEPTED',
          updatedAt: new Date()
        }
      });

      // Update vendor offer status
      await tx.vendorOffer.update({
        where: {
          order_id_wholesaler_id: {
            order_id: orderId,
            wholesaler_id: wholesalerId
          }
        },
        data: {
          status: 'ACCEPTED'
        }
      });

      // Mark other offers as REJECTED
      await tx.vendorOffer.updateMany({
        where: {
          order_id: orderId,
          wholesaler_id: { not: wholesalerId }
        },
        data: {
          status: 'REJECTED'
        }
      });

      return {
        order: updatedOrder,
        wholesaler: vendorOffer.wholesaler
      };
    }, {
      operation: 'ADMIN_FORCE_SELECT_VENDOR',
      entityId: orderId,
      entityType: 'Order',
      timeout: 15000
    });

    // Log admin action
    await this.logAdminAction(
      adminId,
      'FORCE_SELECT_VENDOR',
      orderId,
      `Forced selection of vendor ${wholesalerId}: ${reason}`
    );

    // Send notifications (outside transaction)
    try {
      const orderShortId = orderId.slice(-4);
      
      // Notify selected vendor
      const vendorMessage = `🎉 *Admin Assignment*

You have been assigned Order #${orderShortId} by admin override.

*Order Details:*
Amount: Rs. ${order.totalAmount}
Your Quoted Price: Rs. ${vendorOffer.price_quote}
Your ETA: ${vendorOffer.delivery_eta}

Please confirm stock availability and prepare for delivery.

Reply "CONFIRM ORDER ${orderShortId}" to acknowledge.`;

      await whatsappService.sendMessage(result.wholesaler.whatsappNumber, vendorMessage);

      // Notify retailer
      const retailerMessage = `✅ *Order Update (Admin Override)*

Your Order #${orderShortId} has been assigned by admin.

*Wholesaler:* ${result.wholesaler.businessName}
*Price:* Rs. ${vendorOffer.price_quote}
*Expected Delivery:* ${vendorOffer.delivery_eta}`;

      await whatsappService.sendMessage(order.retailer.phoneNumber, retailerMessage);
    } catch (notifError) {
      console.warn(`Warning: Failed to send notifications:`, notifError.message);
      // Don't fail the operation if notifications fail
    }

    return result.order;
  }

  /**
   * Extend order expiry time
   * @param {string} adminId - The ID of the admin performing the action.
   * @param {string} orderId - The ID of the order.
   * @param {number} additionalMinutes - Additional minutes to add to expiry.
   * @param {string} reason - The reason for extending expiry.
   * @returns {Promise<Object>} The updated order.
   */
  async extendOrderExpiry(adminId, orderId, additionalMinutes, reason) {
    // Validate order can be modified
    await this.validateOrderCanBeModified(orderId);

    return withTransaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, expires_at: true }
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      const currentExpiry = order.expires_at ? new Date(order.expires_at) : new Date();
      const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          expires_at: newExpiry
        }
      });

      // Log admin action (outside transaction to ensure it persists)
      await this.logAdminAction(
        adminId,
        'EXTEND_ORDER_EXPIRY',
        orderId,
        `Extended expiry by ${additionalMinutes} minutes: ${reason}`
      );

      return updatedOrder;
    }, {
      operation: 'ADMIN_EXTEND_ORDER_EXPIRY',
      entityId: orderId,
      entityType: 'Order',
      timeout: 10000
    });
  }

  /**
   * Logs an admin action.
   * @param {string} adminId - The ID of the admin performing the action.
   * @param {string} action - The action performed.
   * @param {string} targetId - The ID of the entity that was affected.
   * @param {string} reason - The reason for the action.
   * @returns {Promise<void>}
   */
  async logAdminAction(adminId, action, targetId, reason) {
    await prisma.adminAuditLog.create({
      data: {
        adminId,
        action,
        targetId,
        reason,
      },
    });
  }
}

module.exports = new AdminService();
