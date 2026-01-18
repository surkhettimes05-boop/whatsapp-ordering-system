/**
 * Payment Reminders Processor
 * 
 * Sends payment reminders for overdue invoices
 */

const prisma = require('../../config/database');
const whatsappService = require('../../services/whatsapp.service');

/**
 * Process payment reminders job
 * @param {Job} job - BullMQ job
 * @returns {Promise<object>} - Result
 */
async function processPaymentReminders(job) {
    const { retailerId, wholesalerId } = job.data;

    try {
        const now = new Date();
        
        // Find overdue ledger entries
        const overdueEntries = await prisma.ledgerEntry.findMany({
            where: {
                ...(retailerId && { retailerId }),
                ...(wholesalerId && { wholesalerId }),
                entryType: 'DEBIT',
                dueDate: {
                    lt: now
                }
            },
            include: {
                retailer: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        pasalName: true
                    }
                },
                wholesaler: {
                    select: {
                        id: true,
                        businessName: true
                    }
                },
                order: {
                    select: {
                        id: true,
                        orderNumber: true
                    }
                }
            },
            orderBy: { dueDate: 'asc' }
        });

        if (overdueEntries.length === 0) {
            return {
                success: true,
                message: 'No overdue payments found',
                remindersSent: 0
            };
        }

        // Group by retailer-wholesaler pair
        const reminders = {};
        for (const entry of overdueEntries) {
            const key = `${entry.retailerId}-${entry.wholesalerId}`;
            if (!reminders[key]) {
                reminders[key] = {
                    retailer: entry.retailer,
                    wholesaler: entry.wholesaler,
                    entries: [],
                    totalAmount: 0
                };
            }
            reminders[key].entries.push(entry);
            reminders[key].totalAmount += Number(entry.amount);
        }

        // Send reminders
        let sentCount = 0;
        for (const reminder of Object.values(reminders)) {
            try {
                const daysOverdue = Math.floor(
                    (now - reminder.entries[0].dueDate) / (1000 * 60 * 60 * 24)
                );

                const message = `💰 *Payment Reminder*

You have overdue payments to *${reminder.wholesaler.businessName}*:

Total Amount: Rs. ${reminder.totalAmount.toFixed(2)}
Days Overdue: ${daysOverdue} day(s)
Number of Invoices: ${reminder.entries.length}

Please make payment at your earliest convenience.

Thank you!`;

                await whatsappService.sendMessage(reminder.retailer.phoneNumber, message);
                sentCount++;
            } catch (error) {
                console.error(`Failed to send payment reminder:`, error);
            }
        }

        return {
            success: true,
            remindersSent: sentCount,
            totalOverdue: overdueEntries.length,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error processing payment reminders:', error);
        throw error;
    }
}

module.exports = processPaymentReminders;
