const schedule = require('node-schedule');
const prisma = require('../config/database');
const whatsappService = require('../services/whatsapp.service');
const creditService = require('../services/credit.service');

// Helper to get start/end of day
const getDayRange = (date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

/**
 * FEATURE 2: Automated but Polite Payment Reminders
 * Run every day at 10:00 AM
 * Sends reminders at:
 * - T-1 day before due date
 * - On due date
 * - 3 days overdue
 */
const job = schedule.scheduleJob('0 10 * * *', async function () {
    console.log('⏰ Running Payment Reminder Job...');

    try {
        const today = new Date();

        // 1. T-1 Reminder (Due Tomorrow)
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        await processReminders(tomorrow, 'REMINDER_TOMORROW');

        // 2. Due Date Reminder (Due Today)
        await processReminders(today, 'REMINDER_TODAY');

        // 3. Overdue Reminder (Due 3 days ago)
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        await processReminders(threeDaysAgo, 'REMINDER_OVERDUE');

        console.log('✅ Payment Reminder Job completed successfully');

    } catch (e) {
        console.error('❌ Error in Payment Reminder Job:', e);
    }
});

async function processReminders(targetDate, type) {
    const { start, end } = getDayRange(targetDate);

    // Find OPEN DEBIT transactions due within the target range
    const transactions = await prisma.creditTransaction.findMany({
        where: {
            status: 'OPEN',
            type: 'DEBIT',
            dueDate: {
                gte: start,
                lte: end
            }
        },
        include: {
            retailer: true
        }
    });

    if (transactions.length === 0) {
        console.log(`   No transactions for ${type}`);
        return;
    }

    console.log(`📨 Processing ${transactions.length} ${type} reminders`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const tx of transactions) {
        try {
            if (!tx.retailer || !tx.retailer.phoneNumber) {
                skipped++;
                continue;
            }

            // Skip if credit is paused/blocked
            if (tx.retailer.creditStatus !== 'ACTIVE') {
                skipped++;
                console.log(`   ⊘ Skipped (credit ${tx.retailer.creditStatus}) - ${tx.retailer.phoneNumber}`);
                continue;
            }

            // Check reminder limit (don't spam - max 3 reminders per transaction)
            const reminderCount = tx.reminderCount || 0;
            if (reminderCount >= 3) {
                console.log(`   ⊘ Skipped (3 reminders already sent) - ${tx.retailer.phoneNumber}`);
                skipped++;
                continue;
            }

            let message = '';
            const amount = `Rs. ${parseFloat(tx.amount).toFixed(0)}`;
            const dateStr = targetDate.toLocaleDateString('en-IN');
            const name = tx.retailer.ownerName || tx.retailer.pasalName || 'Partner';

            // Respectful message tone - never threatening
            if (type === 'REMINDER_TOMORROW') {
                message = `👋 *Namaste ${name}*,\n\n📅 Friendly reminder: Your payment of *${amount}* is due tomorrow.\n\n💳 It helps us serve you better when payments are on time.\n\nThank you! 🙏`;
            } else if (type === 'REMINDER_TODAY') {
                message = `🔔 *Reminder - Payment Due Today*\n\n*${name}*, today is the due date for *${amount}*.\n\nPlease arrange the payment at your convenience. We appreciate your business!\n\n📞 Reply "Help" if you have questions.`;
            } else if (type === 'REMINDER_OVERDUE') {
                // Be polite but clear about overdue status
                const daysOverdue = Math.floor((new Date() - new Date(tx.dueDate)) / (1000 * 60 * 60 * 24));
                message = `⚠️ *Payment Outstanding - Action Needed*\n\n*${name}*, we haven't received your payment of *${amount}* (${daysOverdue} days outstanding).\n\n🙏 Please settle this to keep your credit active.\n\nWe value our partnership and want to help. Reply "Support" if you need assistance.`;
            }

            if (message) {
                await whatsappService.sendMessage(tx.retailer.phoneNumber, message);
                
                // Update transaction to track reminder
                await prisma.creditTransaction.update({
                    where: { id: tx.id },
                    data: {
                        reminderSentAt: new Date(),
                        reminderCount: reminderCount + 1
                    }
                });

                // Log audit trail
                await creditService.logAudit(
                    tx.retailerId,
                    'REMINDER_SENT',
                    tx.id,
                    {
                        type,
                        amount: tx.amount,
                        reminderCount: reminderCount + 1
                    },
                    'SYSTEM'
                );

                sent++;
                console.log(`   ✅ Sent ${type} to ${tx.retailer.phoneNumber} (reminder ${reminderCount + 1}/3)`);
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 1000));

        } catch (err) {
            failed++;
            console.error(`   ❌ Failed to send reminder for tx ${tx.id}:`, err.message);
        }
    }

    console.log(`   Summary: ${sent} sent, ${failed} failed, ${skipped} skipped`);
}

/**
 * Additional job: Auto-pause credit for severely overdue accounts
 * Run daily at 11:00 AM (after payment reminders)
 */
const autoPauseJob = schedule.scheduleJob('0 11 * * *', async function () {
    console.log('⏰ Running Auto-Pause Credit Job...');

    try {
        const retailers = await prisma.retailer.findMany({
            where: {
                status: 'ACTIVE',
                creditStatus: 'ACTIVE'
            },
            include: {
                credit: true,
                transactions: {
                    where: { type: 'DEBIT', status: 'OPEN' },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        let paused = 0;

        for (const retailer of retailers) {
            if (!retailer.credit || retailer.transactions.length === 0) continue;

            const maxDays = retailer.credit.maxOutstandingDays || 30;
            const oldestTransaction = retailer.transactions[0];
            const ageDays = Math.floor((new Date() - new Date(oldestTransaction.createdAt)) / (1000 * 60 * 60 * 24));

            if (ageDays > maxDays && retailer.creditStatus === 'ACTIVE') {
                // Auto-pause
                await prisma.retailer.update({
                    where: { id: retailer.id },
                    data: {
                        creditStatus: 'PAUSED',
                        creditPausedAt: new Date(),
                        creditPauseReason: `Auto-paused: Credit ${ageDays - maxDays} days overdue`
                    }
                });

                // Log the action
                await creditService.logAudit(
                    retailer.id,
                    'PAUSE_CREDIT',
                    oldestTransaction.id,
                    {
                        reason: `Credit ${ageDays - maxDays} days overdue`,
                        daysOutstanding: ageDays,
                        maxAllowed: maxDays
                    },
                    'SYSTEM'
                );

                // Send notification
                const message = `⛔ *Credit Paused*\n\nHi ${retailer.ownerName || retailer.pasalName},\n\nYour credit has been paused due to overdue payment of ${ageDays - maxDays} days.\n\n💳 You can still place orders via Cash on Delivery.\n\n📞 Please contact us to reactivate your credit. Reply "Support".`;
                try {
                    await whatsappService.sendMessage(retailer.phoneNumber, message);
                } catch (e) {
                    console.error(`Failed to notify ${retailer.phoneNumber}:`, e.message);
                }

                paused++;
                console.log(`   ⛔ Auto-paused credit for ${retailer.pasalName} (${ageDays} days outstanding)`);
            }
        }

        console.log(`✅ Auto-Pause Job completed - ${paused} retailers paused`);

    } catch (e) {
        console.error('❌ Error in Auto-Pause Credit Job:', e);
    }
});

module.exports = { job, autoPauseJob };
