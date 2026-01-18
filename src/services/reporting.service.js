const prisma = require('../config/database');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

class ReportingService {
    /**
     * Generate a daily risk report for a wholesaler
     * @param {string} wholesalerId 
     * @returns {Promise<object>} Report data including HTML summary and raw stats
     */
    async generateDailyRiskReport(wholesalerId) {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // 1. Get Wholesaler Details
        const wholesaler = await prisma.wholesaler.findUnique({
            where: { id: wholesalerId },
            select: { businessName: true, email: true, whatsappNumber: true }
        });

        if (!wholesaler) throw new Error(`Wholesaler ${wholesalerId} not found`);

        // 2. Calculate Total Outstanding Credit (Exposure)
        // We can aggregate from Ledger Entries or sum up current balances
        // For performance, we'll sum up the calculated balances from LedgerEntry
        // But since we don't store "current balance" on a per-retailer level efficiently without query,
        // we'll query the latest ledger entry for each retailer associated with this wholesaler.

        // Find all retailers with credit relation
        const creditRelations = await prisma.retailerWholesalerCredit.findMany({
            where: { wholesalerId, isActive: true },
            include: { retailer: { select: { id: true, pasalName: true, phoneNumber: true } } }
        });

        let totalExposure = 0;
        let retailersOverLimit = [];
        let retailersOverdue = [];

        for (const relation of creditRelations) {
            // Get latest ledger entry to find current balance
            const lastEntry = await prisma.ledgerEntry.findFirst({
                where: { retailerId: relation.retailerId, wholesalerId },
                orderBy: { createdAt: 'desc' }
            });

            const balance = lastEntry ? Number(lastEntry.balanceAfter) : 0;
            if (balance > 0) {
                totalExposure += balance;
            }

            // Check if over limit
            if (balance > Number(relation.creditLimit)) {
                retailersOverLimit.push({
                    name: relation.retailer.pasalName,
                    phone: relation.retailer.phoneNumber,
                    balance: balance,
                    limit: Number(relation.creditLimit)
                });
            }

            // Check for overdue payments
            const overdue = await prisma.ledgerEntry.findMany({
                where: {
                    retailerId: relation.retailerId,
                    wholesalerId,
                    entryType: 'DEBIT',
                    dueDate: { lt: new Date() },
                    // Simplified: In a real system we'd check if specific invoice is paid.
                    // Here we assume if balance > 0 and old entries exist, we might have overdue.
                    // But correctly, we should check unmatched debits.
                    // For this MVP, we'll check if Total Credit < Total Debit of expired items
                    // This is complex, so we'll stick to a simpler metric: 
                    // "Has positive balance and oldest unpaid debit is overdue"
                }
            });
            // (Simpler overdue check: If balance > 0, check the oldest debit contributing to it. 
            // For now, we'll just list high-risk accounts based on balance/limit ratio)
        }

        // 3. Daily Sales & Orders
        const todaysOrders = await prisma.order.findMany({
            where: {
                wholesalerId,
                createdAt: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' } // Include all non-cancelled
            }
        });

        const totalOrders = todaysOrders.length;
        const totalSales = todaysOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

        // 4. Generate HTML Summary
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Daily Risk & Performance Report</h2>
                <p><strong>Wholesaler:</strong> ${wholesaler.businessName}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                
                <hr>

                <h3>📊 Daily Performance</h3>
                <ul>
                    <li><strong>Total Orders:</strong> ${totalOrders}</li>
                    <li><strong>Total Sales:</strong> Rs. ${totalSales.toLocaleString()}</li>
                </ul>

                <h3>⚠️ Credit Risk Exposure</h3>
                <ul>
                    <li><strong>Total Outstanding Credit:</strong> Rs. ${totalExposure.toLocaleString()}</li>
                    <li><strong>Retailers Over Limit:</strong> ${retailersOverLimit.length}</li>
                </ul>

                ${retailersOverLimit.length > 0 ? `
                    <h4>Critical Accounts (Over Limit)</h4>
                    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                        <tr><th>Retailer</th><th>Phone</th><th>Balance</th><th>Limit</th></tr>
                        ${retailersOverLimit.map(r => `
                            <tr>
                                <td>${r.name}</td>
                                <td>${r.phone}</td>
                                <td style="color: red;">Rs. ${r.balance.toLocaleString()}</td>
                                <td>Rs. ${r.limit.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </table>
                ` : '<p>✅ No retailers currently exceeding credit limits.</p>'}
                
                <p style="margin-top: 30px; font-size: 12px; color: #666;">Generated by Karnali Digital Trade Platform</p>
            </div>
        `;

        return {
            wholesaler,
            stats: { totalOrders, totalSales, totalExposure, retailersOverLimit },
            html
        };
    }

    /**
     * Generate CSV export for admin
     * @param {string} type 'ORDERS' | 'LEDGER'
     * @param {Date} startDate 
     * @param {Date} endDate 
     * @returns {Promise<string>} CSV string
     */
    async generateAdminExport(type, startDate, endDate) {
        let data = [];
        let fields = [];

        if (type === 'ORDERS') {
            const orders = await prisma.order.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                },
                include: {
                    retailer: { select: { pasalName: true, phoneNumber: true } },
                    wholesaler: { select: { businessName: true } }
                },
                orderBy: { createdAt: 'desc' }
            });

            data = orders.map(o => ({
                OrderID: o.orderNumber || o.id,
                Date: o.createdAt.toISOString(),
                Retailer: o.retailer?.pasalName || 'N/A',
                RetailerPhone: o.retailer?.phoneNumber,
                Wholesaler: o.wholesaler?.businessName || 'Unassigned',
                Status: o.status,
                TotalAmount: o.totalAmount,
                PaymentMode: o.paymentMode
            }));

            fields = ['OrderID', 'Date', 'Retailer', 'RetailerPhone', 'Wholesaler', 'Status', 'TotalAmount', 'PaymentMode'];

        } else if (type === 'LEDGER') {
            const entries = await prisma.ledgerEntry.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                },
                include: {
                    retailer: { select: { pasalName: true } },
                    wholesaler: { select: { businessName: true } }
                },
                orderBy: { createdAt: 'desc' }
            });

            data = entries.map(e => ({
                EntryID: e.id,
                Date: e.createdAt.toISOString(),
                Type: e.entryType,
                Amount: e.amount,
                BalanceAfter: e.balanceAfter,
                Retailer: e.retailer?.pasalName || 'N/A',
                Wholesaler: e.wholesaler?.businessName || 'N/A',
                ReferenceOrder: e.orderId || 'N/A'
            }));

            fields = ['EntryID', 'Date', 'Type', 'Amount', 'BalanceAfter', 'Retailer', 'Wholesaler', 'ReferenceOrder'];
        }

        const parser = new Parser({ fields });
        return parser.parse(data);
    }
}

module.exports = new ReportingService();
