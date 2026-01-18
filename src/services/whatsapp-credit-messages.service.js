/**
 * WhatsApp Credit Check Messages Service
 * 
 * Provides user-friendly WhatsApp message templates for credit checks
 * Simple, clear English for retailers to understand credit status
 */

class WhatsAppCreditMessagesService {
  /**
   * Message when retailer has sufficient credit
   * ✅ Credit Approved
   */
  getCreditApprovedMessage(retailer, order, creditInfo) {
    const { availableCredit, usedCredit, creditLimit } = creditInfo;
    
    return `✅ *Credit Approved!*

Your order of Rs. ${order.totalAmount} has been approved.

Your Credit Summary:
💰 Limit: Rs. ${creditLimit}
📊 Used: Rs. ${usedCredit}
✓ Available: Rs. ${availableCredit}

Order #${order.id.slice(-4)} is being processed...`;
  }

  /**
   * Message when credit is exceeded
   * ❌ Insufficient Credit
   */
  getCreditExceededMessage(retailer, order, creditInfo) {
    const { availableCredit, usedCredit, creditLimit, outstandingAmount } = creditInfo;
    const shortfall = order.totalAmount - availableCredit;
    
    return `❌ *Credit Limit Exceeded*

Sorry, we cannot approve your order.

Current Situation:
📈 Your Used Credit: Rs. ${usedCredit}
📊 Your Limit: Rs. ${creditLimit}
✓ Available Today: Rs. ${availableCredit}
🛒 Your Order: Rs. ${order.totalAmount}
⚠️ Shortfall: Rs. ${shortfall.toFixed(2)}

Outstanding Balance:
🏦 You owe: Rs. ${outstandingAmount}
⏰ Payment Due

Options:
1️⃣ Reduce order (smaller quantity)
2️⃣ Make a payment to free up credit
3️⃣ Contact support

Reply "Check Credit" to see more details.`;
  }

  /**
   * Message when credit is paused
   * 🚫 Credit Paused
   */
  getCreditPausedMessage(retailer, pauseReason) {
    return `🚫 *Credit Currently Paused*

Your credit account is temporarily paused.

Reason: ${pauseReason || 'Outstanding payment required'}

To reactivate your credit:
1️⃣ Contact our support team
2️⃣ Make outstanding payment
3️⃣ Wait for admin approval

We value your business and want to help!
Reply "Help" to reach support.`;
  }

  /**
   * Message for retailer checking their credit status
   * 💳 Credit Status
   */
  getCreditStatusMessage(retailer, creditInfo) {
    const { 
      creditLimit, 
      usedCredit, 
      availableCredit, 
      outstandingAmount,
      outstandingDays,
      creditStatus,
      pendingTransactions
    } = creditInfo;

    let statusEmoji = '✓';
    let statusText = 'ACTIVE';
    
    if (creditStatus === 'PAUSED') {
      statusEmoji = '🚫';
      statusText = 'PAUSED';
    } else if (availableCredit < 5000) {
      statusEmoji = '⚠️';
      statusText = 'LOW (Running out soon)';
    }

    let message = `💳 *Your Credit Status*

${statusEmoji} Status: ${statusText}
${retailer.pasalName || 'Your Account'}

📊 *Credit Breakdown*
• Limit: Rs. ${creditLimit}
• Used: Rs. ${usedCredit}
• Available: Rs. ${availableCredit}

🏦 *Outstanding Balance*
• Amount Owed: Rs. ${outstandingAmount}
${outstandingDays > 0 ? `• Days Outstanding: ${outstandingDays}` : '• No outstanding debt'}`;

    if (pendingTransactions && pendingTransactions > 0) {
      message += `\n• Pending Payments: ${pendingTransactions}`;
    }

    message += `\n\nℹ️ Available credit updates after you make payments.`;

    return message;
  }

  /**
   * Payment reminder message
   * ⏰ Payment Reminder
   */
  getPaymentReminderMessage(retailer, outstandingAmount, daysOverdue) {
    return `⏰ *Payment Reminder*

Dear ${retailer.pasalName || 'Valued Customer'}

You have an outstanding balance:

Amount Due: Rs. ${outstandingAmount}
Days Overdue: ${daysOverdue}

Making payment will:
✓ Free up your credit limit
✓ Keep your account active
✓ Avoid credit pause

How to Pay:
1️⃣ Visit our payment portal
2️⃣ Bank transfer to our account
3️⃣ Contact us for payment details

Thank you for your prompt attention!`;
  }

  /**
   * Successful payment confirmation
   * ✅ Payment Received
   */
  getPaymentReceivedMessage(amountPaid, newUsedCredit, newAvailableCredit) {
    return `✅ *Payment Received!*

Thank you for your payment!

Amount Credited: Rs. ${amountPaid}

Your Updated Credit:
📊 New Used Credit: Rs. ${newUsedCredit}
✓ Available Now: Rs. ${newAvailableCredit}

You're all set to place orders! 🎉`;
  }

  /**
   * Warning message when getting close to limit
   * ⚠️ Credit Running Low
   */
  getLowCreditWarningMessage(availableCredit, minimumThreshold = 5000) {
    return `⚠️ *Credit Running Low*

Your available credit is getting low!

Available Today: Rs. ${availableCredit}

This amount is enough for small orders.

To increase your available credit:
1️⃣ Make a payment to your account
2️⃣ Request a credit limit increase
3️⃣ Contact support for options

Don't worry - we're here to help!
Reply "Check Credit" for full details.`;
  }

  /**
   * Partial credit approval message
   * When order exceeds available but within limit after payment
   * 🤔 Order Too Large
   */
  getPartialOrderSuggestionMessage(order, availableCredit, suggestedQty) {
    const reduction = order.totalAmount - availableCredit;
    
    return `🤔 *Order Adjustment Needed*

Your order (Rs. ${order.totalAmount}) is larger than available credit (Rs. ${availableCredit}).

Good News! You can reduce your order:

Suggested Adjustment:
• Original: Rs. ${order.totalAmount}
• Reduced: Rs. ${suggestedQty}
• You can afford this today!

Or:
1️⃣ Make a payment to increase credit
2️⃣ Place a smaller order
3️⃣ Contact support

Which would you like to do?`;
  }

  /**
   * Generic error message
   * ❌ Something Went Wrong
   */
  getCreditCheckErrorMessage() {
    return `❌ *Technical Issue*

We couldn't check your credit at the moment.

Please:
1️⃣ Try again in a few seconds
2️⃣ Check your internet connection
3️⃣ Contact support if problem persists

Your order is safe - we'll help you shortly!`;
  }

  /**
   * Success message after credit check passes
   * Ready for checkout
   */
  getReadyForCheckoutMessage(order, availableCredit) {
    return `🎯 *Ready for Checkout!*

Order Amount: Rs. ${order.totalAmount}
Available Credit: Rs. ${availableCredit}

✅ All set! Please confirm:
"Yes" - Place order
"No" - Cancel order`;
  }

  /**
   * Summary message showing what happens next
   * 📋 Order Confirmation Process
   */
  getOrderFlowMessage() {
    return `📋 *How Ordering Works*

When you place an order:

1️⃣ Credit Check
   Your available credit is checked

2️⃣ Stock Verification
   We verify items are in stock

3️⃣ Wholesaler Assignment
   Order goes to nearest wholesaler

4️⃣ Confirmation
   You get order number & ETA

Questions? Reply "Help"`;
  }

  /**
   * Message explaining credit system
   * 💡 About Your Credit
   */
  getCreditEducationMessage(creditInfo) {
    const { creditLimit, usedCredit, availableCredit } = creditInfo;

    return `💡 *About Your Credit Limit*

Think of it like a bank account:

📊 Credit Limit: Rs. ${creditLimit}
   This is your maximum buying power

📈 Used Credit: Rs. ${usedCredit}
   Money you've spent but not yet paid

✓ Available Credit: Rs. ${availableCredit}
   You can spend this much today

How it works:
• When you buy on credit, "Used" increases
• When you pay, "Used" decreases
• Your limit stays the same

Example:
If you buy Rs. 10,000 of items:
• Used Credit goes up by 10,000
• Available Credit goes down by 10,000
• You pay later, then it resets

💳 Always check available before ordering!`;
  }
}

module.exports = new WhatsAppCreditMessagesService();
