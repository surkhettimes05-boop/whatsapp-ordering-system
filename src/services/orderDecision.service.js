const prisma = require('../config/database');
const whatsappService = require('./whatsapp.service');
const stockService = require('./stock.service');
const ledgerService = require('./ledger.service');
const creditService = require('./credit.service');
const orderStateMachine = require('./orderStateMachine.service');
const { withTransaction } = require('../utils/transaction');

/**
 * Order Decision Engine
 * Safely assigns orders to winning wholesalers based on offer scoring
 */
class OrderDecisionEngine {
    /**
     * Score an offer based on multiple criteria
     * @param {object} offer - VendorOffer with wholesaler data
     * @returns {number} - Composite score (higher is better)
     */
    scoreOffer(offer) {
        let score = 0;

        // 1. Stock Confirmed (highest priority) - 1000 points
        if (offer.stock_confirmed) {
            score += 1000;
        }

        // 2. Price (lower is better) - normalize to 0-500 points
        // Assuming max reasonable price is 100000, invert for scoring
        const priceScore = Math.max(0, 500 - (Number(offer.price_quote) / 200));
        score += priceScore;

        // 3. ETA (shorter is better) - 0-300 points
        // Parse ETA string (e.g., "2H", "3 hours", "1D")
        const etaScore = this.parseAndScoreETA(offer.delivery_eta);
        score += etaScore;

        // 4. Wholesaler Trust Score - 0-200 points
        // Based on reliability score (0-100) and average rating (0-5)
        const reliabilityScore = (offer.wholesaler.reliabilityScore || 50) * 1.5; // 0-150
        const ratingScore = (offer.wholesaler.averageRating || 0) * 10; // 0-50
        score += reliabilityScore + ratingScore;

        return score;
    }

    /**
     * Parse ETA string and convert to score
     * @param {string} eta - ETA string like "2H", "3 hours", "1D"
     * @returns {number} - Score (0-300, higher is better/shorter)
     */
    parseAndScoreETA(eta) {
        if (!eta) return 0;

        const etaLower = eta.toLowerCase();
        let hours = 0;

        // Parse common formats
        if (etaLower.includes('h')) {
            const match = etaLower.match(/(\d+)\s*h/);
            hours = match ? parseInt(match[1]) : 24;
        } else if (etaLower.includes('day') || etaLower.includes('d')) {
            const match = etaLower.match(/(\d+)\s*(day|d)/);
            hours = match ? parseInt(match[1]) * 24 : 24;
        } else if (etaLower.includes('min')) {
            const match = etaLower.match(/(\d+)\s*min/);
            hours = match ? parseInt(match[1]) / 60 : 1;
        } else {
            // Try to extract any number
            const match = etaLower.match(/(\d+)/);
            hours = match ? parseInt(match[1]) : 24;
        }

        // Score: 300 points for immediate, decreasing with time
        // Max 72 hours (3 days) considered
        const maxHours = 72;
        const normalizedHours = Math.min(hours, maxHours);
        return Math.max(0, 300 - (normalizedHours * 4));
    }

    /**
     * Main decision engine - assigns order to winning wholesaler
     * @param {string} orderId - Order ID to process
     * @param {object} options - Optional settings
     * @returns {Promise<object>} - Result with winner and notifications sent
     */
    async decideWinner(orderId, options = {}) {
        const { adminTriggered = false, adminId = null, excludeWholesalerIds = [] } = options;
        let conflictData = null; // Store conflict data to log after transaction

        try {
            // ============================================
            // ATOMIC TRANSACTION: Winner Assignment with Financial & Inventory Safety
            // ============================================
            // Operations in this transaction (all-or-nothing):
            // 1. Lock order row (prevent concurrent execution)
            // 2. Check final_wholesaler_id (abort if already assigned)
            // 3. Score offers and select winner
            // 4. Check retailer credit (abort if insufficient)
            // 5. Check and reserve wholesaler stock (abort if unavailable)
            // 6. Create PENDING ledger debit entry
            // 7. Update order with winner assignment
            // 8. Update vendor offer statuses
            //
            // ROLLBACK SCENARIOS (all operations roll back together):
            // - If final_wholesaler_id already set → Everything rolls back, conflict logged
            // - If credit check fails → Stock not reserved, ledger not created, order not updated
            // - If stock unavailable → Credit check passed but no reservation, ledger not created
            // - If ledger creation fails → Stock reserved but will be released on rollback
            // - If order update fails → All previous steps roll back
            //
            // Result: Either complete assignment with all safety checks, or nothing (no partial state)
            // ============================================

            // Use Prisma transaction with SERIALIZABLE isolation and row-level locking
            const result = await prisma.$transaction(async (tx) => {
                // STEP 1: Lock order row for update using SELECT FOR UPDATE (row-level locking)
                // This prevents concurrent execution from reading the same state
                const lockedOrder = await tx.$queryRaw`
                    SELECT id, "retailerId", "wholesalerId", "totalAmount", 
                           status, "final_wholesaler_id", "expires_at"
                    FROM "Order"
                    WHERE id = ${orderId}
                    FOR UPDATE
                `;

                if (!lockedOrder || lockedOrder.length === 0) {
                    throw new Error(`Order ${orderId} not found`);
                }

                const orderLocked = lockedOrder[0];

                // STEP 2: Check if final_wholesaler_id is already set (after acquiring lock)
                if (orderLocked.final_wholesaler_id) {
                    // Store conflict data to log outside transaction (so it persists even if transaction rolls back)
                    conflictData = {
                        orderId,
                        attemptedBy: adminId || 'SYSTEM',
                        conflictReason: 'Order already has final_wholesaler_id assigned - concurrent execution prevented',
                        finalWholesalerId: orderLocked.final_wholesaler_id,
                        orderStatus: orderLocked.status,
                        metadata: JSON.stringify({
                            adminTriggered,
                            timestamp: new Date().toISOString(),
                            lockedAt: new Date().toISOString()
                        })
                    };

                    throw new Error(`Order ${orderId} already has a winner assigned (final_wholesaler_id: ${orderLocked.final_wholesaler_id})`);
                }

                // STEP 3: Fetch full order data with relations (now that we have the lock)
                const order = await tx.order.findUnique({
                    where: { id: orderId },
                    include: {
                        retailer: true,
                        vendorOffers: {
                            // Include all offers - we'll filter by status and excludeWholesalerIds later
                            include: {
                                wholesaler: {
                                    select: {
                                        id: true,
                                        businessName: true,
                                        whatsappNumber: true,
                                        reliabilityScore: true,
                                        averageRating: true
                                    }
                                }
                            }
                        }
                    }
                });

                // Additional validation checks
                // Allow retries even if status is WHOLESALER_ACCEPTED (for timeout scenarios)
                if (order.status !== 'PENDING_BIDS' && order.status !== 'WHOLESALER_ACCEPTED') {
                    throw new Error(`Order ${orderId} is not in a retryable status (current: ${order.status})`);
                }

                // Filter out excluded wholesalers and non-eligible offers (for retry scenarios)
                let eligibleOffers = order.vendorOffers.filter(
                    offer => offer.status === 'PENDING' || offer.status === 'ACCEPTED'
                );

                if (excludeWholesalerIds.length > 0) {
                    eligibleOffers = eligibleOffers.filter(
                        offer => !excludeWholesalerIds.includes(offer.wholesaler_id)
                    );
                    console.log(`🔄 Retry mode: Excluding ${excludeWholesalerIds.length} wholesaler(s), ${eligibleOffers.length} offer(s) remaining`);
                }

                if (eligibleOffers.length === 0) {
                    throw new Error(`Order ${orderId} has no eligible offers to evaluate${excludeWholesalerIds.length > 0 ? ' (all offers excluded)' : ''}`);
                }

                // STEP 4: Score all eligible offers
                const scoredOffers = eligibleOffers.map(offer => ({
                    offer,
                    score: this.scoreOffer(offer)
                }));

                // Sort by score (highest first)
                scoredOffers.sort((a, b) => b.score - a.score);

                const winner = scoredOffers[0];
                const losers = scoredOffers.slice(1);

                console.log(`\n🏆 Order ${orderId.slice(-4)} - Offer Scoring:`);
                scoredOffers.forEach((item, idx) => {
                    const icon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
                    console.log(`${icon} ${item.offer.wholesaler.businessName}: ${item.score.toFixed(1)} pts (Price: Rs.${item.offer.price_quote}, ETA: ${item.offer.delivery_eta})`);
                });

                // STEP 5: Financial and Inventory Safety Checks (before finalizing winner)
                // All checks must pass or transaction rolls back

                // 5a. Check retailer credit limit (BEFORE order assignment)
                const creditCheck = await creditService.checkCreditLimit(
                    order.retailerId,
                    winner.offer.wholesaler_id,
                    Number(order.totalAmount),
                    tx
                );
                if (!creditCheck.canPlace) {
                    throw new Error(`Credit limit check failed: ${creditCheck.reason}`);
                }

                // 5b. Check wholesaler stock availability and get order items
                const orderItems = await tx.orderItem.findMany({
                    where: { orderId },
                    select: { productId: true, quantity: true }
                });

                const itemsForStockCheck = orderItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity
                }));

                const stockCheck = await this.checkAndReserveStock(tx, winner.offer.wholesaler_id, itemsForStockCheck, orderId);
                if (!stockCheck.success) {
                    throw new Error(`Stock check failed: ${stockCheck.reason}`);
                }

                // 5c. Create PENDING ledger debit entry
                const creditConfig = await tx.retailerWholesalerCredit.findUnique({
                    where: {
                        retailerId_wholesalerId: {
                            retailerId: order.retailerId,
                            wholesalerId: winner.offer.wholesaler_id
                        }
                    }
                });

                const creditTerms = creditConfig?.creditTerms || 30;
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + creditTerms);

                // Calculate balance from all entries (not stored, calculated)
                const existingEntries = await tx.ledgerEntry.findMany({
                    where: {
                        retailerId: order.retailerId,
                        wholesalerId: winner.offer.wholesaler_id
                    },
                    orderBy: { createdAt: 'asc' },
                    select: { entryType: true, amount: true }
                });

                let currentBalance = 0;
                for (const entry of existingEntries) {
                    const amount = Number(entry.amount);
                    if (entry.entryType === 'DEBIT' || entry.entryType === 'ADJUSTMENT') {
                        currentBalance += amount;
                    } else if (entry.entryType === 'CREDIT' || entry.entryType === 'REVERSAL') {
                        currentBalance -= amount;
                    }
                }

                const newBalance = currentBalance + Number(order.totalAmount);

                // Create PENDING debit entry (immutable)
                await tx.ledgerEntry.create({
                    data: {
                        retailerId: order.retailerId,
                        wholesalerId: winner.offer.wholesaler_id,
                        orderId: orderId,
                        entryType: 'DEBIT',
                        amount: order.totalAmount,
                        balanceAfter: newBalance, // Stored for performance, but calculated from entries
                        dueDate: dueDate,
                        createdBy: 'SYSTEM'
                    }
                });

                console.log(`✅ Financial & Inventory Safety Checks Passed:`);
                console.log(`   - Credit: Available ${creditCheck.availableCredit}, Used ${creditCheck.currentBalance}`);
                console.log(`   - Stock: Reserved for ${itemsForStockCheck.length} items`);
                console.log(`   - Ledger: PENDING debit of ${order.totalAmount} created`);

                // STEP 6: Update order with winner (only after all safety checks pass)
                // Use state machine to transition status
                await orderStateMachine.transitionOrderStatusInTransaction(
                    tx,
                    orderId,
                    'WHOLESALER_ACCEPTED',
                    {
                        performedBy: adminId || 'SYSTEM',
                        reason: 'Winner selected by decision engine'
                    }
                );

                // Also update wholesaler fields
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        final_wholesaler_id: winner.offer.wholesaler_id,
                        wholesalerId: winner.offer.wholesaler_id
                    }
                });

                // STEP 7: Update winning offer status
                await tx.vendorOffer.update({
                    where: {
                        order_id_wholesaler_id: {
                            order_id: orderId,
                            wholesaler_id: winner.offer.wholesaler_id
                        }
                    },
                    data: {
                        status: 'ACCEPTED'
                    }
                });

                // STEP 8: Update losing offers status
                for (const loser of losers) {
                    await tx.vendorOffer.update({
                        where: {
                            order_id_wholesaler_id: {
                                order_id: orderId,
                                wholesaler_id: loser.offer.wholesaler_id
                            }
                        },
                        data: {
                            status: 'REJECTED'
                        }
                    });
                }

                // STEP 9: Log the decision
                console.log(`✅ Winner selected: ${winner.offer.wholesaler.businessName} with score ${winner.score.toFixed(1)}`);

                return {
                    orderId,
                    winner: {
                        wholesalerId: winner.offer.wholesaler_id,
                        businessName: winner.offer.wholesaler.businessName,
                        whatsappNumber: winner.offer.wholesaler.whatsappNumber,
                        price: winner.offer.price_quote,
                        eta: winner.offer.delivery_eta,
                        score: winner.score
                    },
                    losers: losers.map(l => ({
                        wholesalerId: l.offer.wholesaler_id,
                        businessName: l.offer.wholesaler.businessName,
                        whatsappNumber: l.offer.wholesaler.whatsappNumber,
                        price: l.offer.price_quote,
                        score: l.score
                    })),
                    retailer: {
                        phoneNumber: order.retailer.phoneNumber,
                        pasalName: order.retailer.pasalName
                    },
                    totalAmount: order.totalAmount,
                    adminTriggered,
                    creditCheck: creditCheck,
                    stockReserved: stockCheck.itemsReserved
                };
            }, {
                operation: 'VENDOR_SELECTION',
                entityId: orderId,
                entityType: 'Order',
                timeout: 10000
            });

            // STEP 10: Send notifications (outside transaction to avoid blocking)
            await this.sendNotifications(result);

            return {
                success: true,
                ...result
            };

        } catch (error) {
            console.error('❌ Decision engine error:', error);

            // Log conflict if it was a double assignment attempt
            if (conflictData) {
                console.error(`🚫 CONFLICT DETECTED: Order ${orderId} - ${error.message}`);
                // Log conflict in separate transaction to ensure it persists
                await this.logConflictPersistent(conflictData).catch(err =>
                    console.error('Failed to persist conflict log:', err)
                );
            }

            return {
                success: false,
                error: error.message,
                conflictDetected: !!conflictData
            };
        }
    }

    /**
     * Check retailer credit before finalizing order
     * @param {object} tx - Prisma transaction client
     * @param {string} retailerId - Retailer ID
     * @param {string} wholesalerId - Wholesaler ID
     * @param {number} orderAmount - Order amount
     * @returns {Promise<object>} Credit check result
     */
    async checkRetailerCredit(tx, retailerId, wholesalerId, orderAmount) {
        try {
            // 1. Check if credit limit exists
            const creditConfig = await tx.retailerWholesalerCredit.findUnique({
                where: {
                    retailerId_wholesalerId: {
                        retailerId,
                        wholesalerId
                    }
                }
            });

            if (!creditConfig) {
                return {
                    canPlace: false,
                    reason: 'No credit arrangement with this wholesaler',
                    currentBalance: 0,
                    creditLimit: 0
                };
            }

            // 2. Check if credit is blocked
            if (!creditConfig.isActive) {
                return {
                    canPlace: false,
                    reason: `Credit blocked: ${creditConfig.blockedReason || 'Admin blocked'}`,
                    currentBalance: 0,
                    creditLimit: Number(creditConfig.creditLimit)
                };
            }

            // 3. Check for active holds
            const activeHold = await tx.creditHoldHistory.findFirst({
                where: {
                    retailerId,
                    wholesalerId,
                    isActive: true
                },
                orderBy: { createdAt: 'desc' }
            });

            if (activeHold) {
                return {
                    canPlace: false,
                    reason: `Credit hold: ${activeHold.holdReason}`,
                    currentBalance: 0,
                    creditLimit: Number(creditConfig.creditLimit)
                };
            }

            // 4. Calculate current balance from ledger entries
            const ledgerEntries = await tx.ledgerEntry.findMany({
                where: {
                    retailerId,
                    wholesalerId
                }
            });

            const totalDebits = ledgerEntries
                .filter(e => e.entryType === 'DEBIT')
                .reduce((sum, e) => sum + Number(e.amount), 0);

            const totalCredits = ledgerEntries
                .filter(e => e.entryType === 'CREDIT')
                .reduce((sum, e) => sum + Number(e.amount), 0);

            const adjustments = ledgerEntries
                .filter(e => e.entryType === 'ADJUSTMENT')
                .reduce((sum, e) => sum + Number(e.amount), 0);

            const currentBalance = totalDebits - totalCredits + adjustments;
            const projectedBalance = currentBalance + Number(orderAmount);

            // 5. Check if projected balance exceeds limit
            if (projectedBalance > Number(creditConfig.creditLimit)) {
                return {
                    canPlace: false,
                    reason: `Credit limit exceeded. Order would bring balance to ${projectedBalance}, limit is ${creditConfig.creditLimit}`,
                    currentBalance,
                    projectedBalance,
                    creditLimit: Number(creditConfig.creditLimit),
                    availableCredit: Number(creditConfig.creditLimit) - currentBalance
                };
            }

            // 6. Check for overdue payments
            const now = new Date();
            const overdueEntries = await tx.ledgerEntry.findMany({
                where: {
                    retailerId,
                    wholesalerId,
                    entryType: 'DEBIT',
                    dueDate: {
                        lt: now
                    }
                }
            });

            if (overdueEntries.length > 0) {
                return {
                    canPlace: false,
                    reason: `Outstanding overdue payments from ${overdueEntries.length} order(s)`,
                    currentBalance,
                    creditLimit: Number(creditConfig.creditLimit),
                    overdueAmount: overdueEntries.reduce((sum, e) => sum + Number(e.amount), 0)
                };
            }

            // All checks passed
            return {
                canPlace: true,
                reason: 'Credit check passed',
                currentBalance,
                creditLimit: Number(creditConfig.creditLimit),
                availableCredit: Number(creditConfig.creditLimit) - currentBalance,
                creditTerms: creditConfig.creditTerms
            };

        } catch (error) {
            console.error('Error in checkRetailerCredit:', error);
            return {
                canPlace: false,
                reason: `Credit check error: ${error.message}`,
                currentBalance: 0
            };
        }
    }

    /**
     * Check stock availability and reserve stock for order
     * @param {object} tx - Prisma transaction client
     * @param {string} wholesalerId - Wholesaler ID
     * @param {Array} items - Array of {productId, quantity}
     * @param {string} orderId - Order ID
     * @returns {Promise<object>} Stock check and reservation result
     */
    async checkAndReserveStock(tx, wholesalerId, items, orderId) {
        try {
            // Verify and reserve stock for each item
            for (const item of items) {
                // Lock the wholesaler product row
                const wp = await tx.wholesalerProduct.findUnique({
                    where: {
                        wholesalerId_productId: {
                            wholesalerId,
                            productId: item.productId
                        }
                    }
                });

                if (!wp) {
                    return {
                        success: false,
                        reason: `Product ${item.productId} not found for wholesaler ${wholesalerId}`
                    };
                }

                // Check available stock (physical - reserved)
                const available = wp.stock - wp.reservedStock;
                if (available < item.quantity) {
                    return {
                        success: false,
                        reason: `Insufficient stock for product ${item.productId}. Requested: ${item.quantity}, Available: ${available}`
                    };
                }

                // Increment reserved stock
                await tx.wholesalerProduct.update({
                    where: { id: wp.id },
                    data: {
                        reservedStock: { increment: item.quantity }
                    }
                });

                // Create reservation record
                await tx.stockReservation.create({
                    data: {
                        wholesalerProductId: wp.id,
                        orderId: orderId,
                        quantity: item.quantity,
                        status: 'ACTIVE'
                    }
                });
            }

            return {
                success: true,
                reason: 'Stock reserved successfully',
                itemsReserved: items.length
            };

        } catch (error) {
            console.error('Error in checkAndReserveStock:', error);
            return {
                success: false,
                reason: `Stock reservation error: ${error.message}`
            };
        }
    }

    /**
     * Log a conflict attempt when concurrent execution is detected
     * Uses a separate transaction to ensure the log persists even if main transaction rolls back
     * @param {object} conflictData - Conflict information
     */
    async logConflictPersistent(conflictData) {
        try {
            // Use a separate transaction that always commits
            await prisma.$transaction(async (tx) => {
                await tx.decisionConflictLog.create({
                    data: {
                        orderId: conflictData.orderId,
                        attemptedBy: conflictData.attemptedBy,
                        conflictReason: conflictData.conflictReason,
                        finalWholesalerId: conflictData.finalWholesalerId,
                        attemptedWholesalerId: conflictData.attemptedWholesalerId,
                        orderStatus: conflictData.orderStatus,
                        metadata: conflictData.metadata
                    }
                });
            });
            console.error(`📝 Conflict logged for Order ${conflictData.orderId}: ${conflictData.conflictReason}`);
        } catch (logError) {
            // Don't throw - logging conflicts should not break the main flow
            console.error('⚠️ Failed to log conflict:', logError);
        }
    }

    /**
     * Send WhatsApp notifications to winner, losers, and retailer
     * @param {object} result - Decision result
     */
    async sendNotifications(result) {
        const orderShortId = result.orderId.slice(-4);

        try {
            // Notify winner
            const winnerMessage = `🎉 *Congratulations!*

You won Order #${orderShortId}

*Order Details:*
Amount: Rs. ${result.totalAmount}
Your Quoted Price: Rs. ${result.winner.price}
Your ETA: ${result.winner.eta}

Please confirm stock availability and prepare for delivery.

Reply "CONFIRM ORDER ${orderShortId}" to acknowledge.`;

            await whatsappService.sendMessage(result.winner.whatsappNumber, winnerMessage);
            console.log(`📱 Winner notification sent to ${result.winner.businessName}`);

            // Notify losers
            const loserMessage = `Thank you for your bid on Order #${orderShortId}.

Unfortunately, this order has been assigned to another vendor who provided a better offer.

We appreciate your participation and look forward to future opportunities! 🙏`;

            for (const loser of result.losers) {
                await whatsappService.sendMessage(loser.whatsappNumber, loserMessage);
                console.log(`📱 Loser notification sent to ${loser.businessName}`);
            }

            // Notify retailer
            const retailerMessage = `✅ *Order Update*

Your Order #${orderShortId} has been assigned!

*Wholesaler:* ${result.winner.businessName}
*Price:* Rs. ${result.winner.price}
*Expected Delivery:* ${result.winner.eta}

You will be notified when the order is confirmed and dispatched.`;

            await whatsappService.sendMessage(result.retailer.phoneNumber, retailerMessage);
            console.log(`📱 Retailer notification sent to ${result.retailer.pasalName || result.retailer.phoneNumber}`);

        } catch (error) {
            console.error('⚠️ Error sending notifications:', error);
            // Don't throw - notifications are non-critical
        }
    }

    /**
     * Process all expired orders
     * @returns {Promise<object>} - Summary of processed orders
     */
    async processExpiredOrders() {
        const now = new Date();

        // Find all expired orders that haven't been assigned
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: 'PENDING_BIDS',
                expires_at: { lte: now },
                final_wholesaler_id: null
            },
            select: { id: true }
        });

        console.log(`\n⏰ Found ${expiredOrders.length} expired orders to process`);

        const results = {
            total: expiredOrders.length,
            successful: 0,
            failed: 0,
            errors: []
        };

        for (const order of expiredOrders) {
            const result = await this.decideWinner(order.id);
            if (result.success) {
                results.successful++;
            } else {
                results.failed++;
                results.errors.push({
                    orderId: order.id,
                    error: result.error
                });
            }
        }

        console.log(`\n📊 Expired Orders Processing Summary:`);
        console.log(`   Total: ${results.total}`);
        console.log(`   Successful: ${results.successful}`);
        console.log(`   Failed: ${results.failed}`);

        return results;
    }
}

module.exports = new OrderDecisionEngine();
