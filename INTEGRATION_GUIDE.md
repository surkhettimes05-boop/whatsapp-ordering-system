# Integration Guide: Conversation & Order Services

This document shows how to integrate the new credit operations system with existing conversation and order flows.

---

## Integration Points

### 1. Order Validation (Before Placing Order)

**Current Code:**
```javascript
// In conversation.service.js or order.service.js
async function placeOrder(retailerId, items) {
    const order = await prisma.order.create({...});
    return order;
}
```

**Updated Code:**
```javascript
const guardrailsService = require('../services/guardrails.service');

async function placeOrder(retailerId, items, paymentMode = 'COD') {
    // 1. VALIDATE ORDER AGAINST GUARDRAILS
    const validation = await guardrailsService.validateOrderPlacement(
        retailerId,
        totalAmount,
        paymentMode
    );

    // If not allowed, reject with error
    if (!validation.allowed) {
        return {
            success: false,
            error: validation.reason,
            message: validation.message
        };
    }

    // 2. If CREDIT mode and has warning, proceed but note it
    if (validation.warning) {
        console.warn(`⚠️ ${validation.warning} - Proceeding anyway`);
    }

    // 3. CREATE PENDING ORDER (for recovery if it fails)
    const orderRecoveryService = require('../services/orderRecovery.service');
    const pendingOrder = await orderRecoveryService.createPendingOrder(
        retailerId,
        items,
        totalAmount
    );

    // 4. CREATE ACTUAL ORDER
    const order = await prisma.order.create({
        data: {
            retailerId,
            totalAmount,
            paymentMode,
            status: 'PLACED',
            items: { create: items }
        }
    });

    // 5. IF CREDIT ORDER, DEDUCT CREDIT
    if (paymentMode === 'CREDIT') {
        const retailer = await prisma.retailer.findUnique({
            where: { id: retailerId },
            include: { credit: true }
        });
        
        const newUsedCredit = parseFloat(retailer.credit.usedCredit) + totalAmount;
        await prisma.creditAccount.update({
            where: { retailerId },
            data: { usedCredit: newUsedCredit }
        });

        // Create DEBIT transaction (with due date)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7); // 7-day payment term

        await prisma.creditTransaction.create({
            data: {
                retailerId,
                orderId: order.id,
                amount: totalAmount,
                type: 'DEBIT',
                status: 'OPEN',
                dueDate
            }
        });
    }

    // 6. MARK PENDING ORDER AS RECOVERED
    await orderRecoveryService.markPendingOrderRecovered(
        pendingOrder.id,
        order.id
    );

    // 7. LOG TO AUDIT
    const creditService = require('../services/credit.service');
    await creditService.logAudit(
        retailerId,
        'ORDER_CREATED',
        order.id,
        {
            amount: totalAmount,
            paymentMode,
            itemCount: items.length
        },
        'SYSTEM'
    );

    // 8. SEND CONFIRMATION TO RETAILER
    const confirmationMessage = `✅ *Order Placed*\n\nOrder #${order.id.slice(-4)}\nTotal: Rs. ${totalAmount}\n\nWe'll update you soon!`;
    await whatsappService.sendMessage(retailer.phoneNumber, confirmationMessage);

    return { success: true, order };
}
```

---

### 2. WhatsApp Conversation Flow

**In your WhatsApp command handler (whatsapp.controller.js or conversation handler):**

```javascript
async handleWhatsAppMessage(phoneNumber, messageText) {
    const retailer = await prisma.retailer.findUnique({
        where: { phoneNumber }
    });

    if (!retailer) {
        // Unknown user
        return;
    }

    // Check if user is asking to "Check Credit"
    if (messageText.toLowerCase().includes('check credit') || messageText === '2') {
        const creditService = require('../services/credit.service');
        
        // Get profile and insights
        const profile = await creditService.getRetailerCreditProfile(retailer.id);
        const insightsService = require('../services/retailerInsights.service');
        const insightMessage = await insightsService.getInsightMessage(retailer.id);

        // Send credit info
        let creditMessage = `💳 *Your Credit Status*\n\n`;
        creditMessage += `Credit Limit: Rs. ${profile.creditLimit}\n`;
        creditMessage += `Used: Rs. ${profile.usedCredit}\n`;
        creditMessage += `Available: Rs. ${profile.availableCredit}\n\n`;

        if (retailer.creditStatus === 'ACTIVE') {
            creditMessage += `✅ Credit Active\n\n`;
        } else {
            creditMessage += `⛔ Credit ${retailer.creditStatus}\n`;
            if (retailer.creditPauseReason) {
                creditMessage += `Reason: ${retailer.creditPauseReason}\n`;
            }
            creditMessage += `\n`;
        }

        creditMessage += `Outstanding (Aging):\n`;
        creditMessage += `0-7 days: Rs. ${profile.outstandingSummary['0-7']}\n`;
        creditMessage += `8-14 days: Rs. ${profile.outstandingSummary['8-14']}\n`;
        creditMessage += `15-30 days: Rs. ${profile.outstandingSummary['15-30']}\n`;
        creditMessage += `30+ days: Rs. ${profile.outstandingSummary['30+']}\n\n`;

        // Send both messages
        await whatsappService.sendMessage(retailer.phoneNumber, creditMessage);
        await whatsappService.sendMessage(retailer.phoneNumber, insightMessage);
        return;
    }

    // When offering payment method (COD vs CREDIT)
    if (state.step === 'CHOOSE_PAYMENT_MODE') {
        if (messageText === 'CREDIT') {
            // Check if credit is available
            if (retailer.creditStatus !== 'ACTIVE') {
                const msg = `⛔ Credit not available (${retailer.creditStatus}).\n\nReason: ${retailer.creditPauseReason}\n\nPlease use Cash on Delivery or contact us.`;
                await whatsappService.sendMessage(retailer.phoneNumber, msg);
                
                // Offer COD instead
                const mainMenu = whatsappService.getMainMenu();
                await whatsappService.sendMessage(retailer.phoneNumber, mainMenu);
                return;
            }

            // Proceed with CREDIT checkout
            // ... rest of credit checkout flow
        }
    }

    // Handle order placement (place_order_cod or place_order_credit)
    if (messageText === 'PLACE_ORDER' || messageText === 'place_order_cod' || messageText === 'place_order_credit') {
        const paymentMode = messageText.includes('credit') ? 'CREDIT' : 'COD';
        const cartService = require('../services/cart.service');
        const cartItems = await cartService.getRetailerCart(retailer.id);

        const placeOrderResult = await placeOrder(retailer.id, cartItems, paymentMode);
        
        if (!placeOrderResult.success) {
            // Order validation failed
            const errorMessage = placeOrderResult.message;
            await whatsappService.sendMessage(retailer.phoneNumber, errorMessage);
            // Offer alternative
            await whatsappService.sendMessage(retailer.phoneNumber, `Try ordering via Cash on Delivery instead.`);
            return;
        }

        // Order placed successfully
        const order = placeOrderResult.order;
        const confirmMsg = `✅ *Order Confirmed*\n\nOrder #${order.id.slice(-4)}\nAmount: Rs. ${order.totalAmount}\nMode: ${paymentMode}\n\nWe'll deliver soon! 🚚`;
        await whatsappService.sendMessage(retailer.phoneNumber, confirmMsg);
    }
}
```

---

### 3. Showing Payment Options

**In your menu/option handler:**

```javascript
function getPaymentOptionsMessage(retailer, creditProfile) {
    let message = `💳 *How to Pay?*\n\n`;

    // Always offer COD
    message += `1️⃣ *Cash on Delivery* - Pay when order arrives\n\n`;

    // Only offer CREDIT if active and available
    if (retailer.creditStatus === 'ACTIVE' && creditProfile.availableCredit > 0) {
        message += `2️⃣ *Use My Credit* - Rs. ${creditProfile.availableCredit} available\n`;
        message += `    (Due in 7 days)\n\n`;
    } else {
        message += `2️⃣ *Use My Credit* - Not available\n`;
        if (retailer.creditStatus !== 'ACTIVE') {
            message += `    (${retailer.creditStatus} - ${retailer.creditPauseReason})\n\n`;
        } else {
            message += `    (No available balance)\n\n`;
        }
    }

    message += `Reply with option number or "COD" or "CREDIT"`;
    return message;
}
```

---

### 4. Order Failure Handling

**When an order fails (WhatsApp delivery error, validation error, etc.):**

```javascript
const orderRecoveryService = require('../services/orderRecovery.service');

async function handleOrderFailure(orderId, failureReason) {
    const result = await orderRecoveryService.handleOrderFailure(orderId, failureReason);
    console.log(`Order ${orderId} marked as failed: ${failureReason}`);
    // Service automatically sends notification to retailer
}

// Called from error handlers in WhatsApp webhook
app.post('/webhook/whatsapp', async (req, res) => {
    const { message } = req.body;
    
    try {
        // ... process message
    } catch (error) {
        const retailer = await prisma.retailer.findUnique({
            where: { phoneNumber }
        });
        
        if (retailer.conversationState?.data?.orderId) {
            await handleOrderFailure(
                retailer.conversationState.data.orderId,
                error.message
            );
        }
    }
});
```

---

### 5. Admin Payment Recording

**Create a simple webhook or endpoint to record payments:**

```javascript
const creditService = require('../services/credit.service');

// Called when payment is received (from bank, manual entry, etc.)
async function recordPaymentReceived(retailerId, amountReceived, method = 'bank_transfer') {
    // Find OLDEST open DEBIT transaction for this retailer
    const transaction = await prisma.creditTransaction.findFirst({
        where: {
            retailerId,
            type: 'DEBIT',
            status: 'OPEN'
        },
        orderBy: { createdAt: 'asc' }
    });

    if (!transaction) {
        throw new Error('No open transactions for this retailer');
    }

    // Record the payment
    const result = await creditService.recordPayment(
        transaction.id,
        amountReceived,
        'admin_manual_entry'
    );

    // Send notification to retailer
    const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId }
    });

    if (result.status === 'FULLY_CLEARED') {
        const msg = `✅ *Payment Received*\n\nThank you! Your payment of Rs. ${amountReceived} has been recorded.\n\nCredit restored! 💳`;
        await whatsappService.sendMessage(retailer.phoneNumber, msg);
    } else {
        const msg = `✅ *Partial Payment Received*\n\nThank you for Rs. ${amountReceived}.\n\nRemaining: Rs. ${result.remaining}`;
        await whatsappService.sendMessage(retailer.phoneNumber, msg);
    }

    return result;
}

// Admin endpoint example
router.post('/admin/payment-received', isAdminAuth, async (req, res) => {
    const { retailerId, amount } = req.body;
    try {
        const result = await recordPaymentReceived(retailerId, parseFloat(amount));
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});
```

---

### 6. Adjust for Returns/Disputes

**When a product is returned or dispute happens:**

```javascript
const creditService = require('../services/credit.service');

async function handleReturnOrDispute(retailerId, amount, reason) {
    // Create CREDIT adjustment (negative amount to reduce debt)
    const result = await creditService.createAdjustment(
        retailerId,
        -amount,  // Negative = credit back to retailer
        reason,
        'admin_001'
    );

    // Notify retailer
    const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId }
    });

    const msg = `✅ *Adjustment Processed*\n\nReason: ${reason}\n\nCredit adjusted: Rs. ${amount}`;
    await whatsappService.sendMessage(retailer.phoneNumber, msg);

    return result;
}

// Usage example
handleReturnOrDispute('ret_123', 5000, 'Product returned - defective item');
```

---

## Summary of Integration Points

| Flow | What Changed | Where |
|------|-------------|-------|
| Order Placement | Add guardrails validation | conversation/order service |
| Order Deduction | Add credit deduction logic | order service |
| Credit Check | Check creditStatus before offering | conversation menu |
| Payment Method | Hide CREDIT if paused/no balance | WhatsApp response handler |
| Order Failure | Call orderRecovery.handleOrderFailure | error handler |
| Payment Received | Call recordPayment | admin endpoint |
| Returns/Disputes | Call createAdjustment | returns/dispute handler |
| Check Credit | Send profile + insights | conversation handler |

---

## Code Snippets Ready to Copy

### Minimal Guardrail Check
```javascript
const guardrailsService = require('./services/guardrails.service');

const validation = await guardrailsService.validateOrderPlacement(
    retailerId,
    orderAmount,
    'CREDIT'
);

if (!validation.allowed) {
    // Send message: validation.message
    // Don't place order
    return;
}

// Place order...
```

### Minimal Payment Recording
```javascript
const creditService = require('./services/credit.service');

await creditService.recordPayment(transactionId, amountPaid, 'admin_001');
```

### Minimal Insights Message
```javascript
const retailerInsightsService = require('./services/retailerInsights.service');

const message = await retailerInsightsService.getInsightMessage(retailerId);
await whatsappService.sendMessage(phoneNumber, message);
```

---

## Testing Checklist

- [ ] Order validation blocks CREDIT orders when paused
- [ ] Order validation allows COD orders when paused
- [ ] Credit is deducted when CREDIT order placed
- [ ] DEBIT transaction created with due date
- [ ] Payment reminders sent at correct times
- [ ] Auto-pause happens when overdue
- [ ] Partial payment recorded correctly
- [ ] Adjustment logged and reduces credit
- [ ] Pending orders expire after 24 hours
- [ ] Follow-up sent to retailers with expired pending orders
- [ ] Audit logs appear for all operations
- [ ] At-risk retailers identified correctly

---

**This guide is complete. Follow these patterns to integrate with your existing services.**
