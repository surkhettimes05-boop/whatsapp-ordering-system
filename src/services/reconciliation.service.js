/**
 * Financial Reconciliation Service
 * 
 * Fintech Auditor: Daily reconciliation and compliance verification
 * 
 * Responsibilities:
 * - Sum ledger debits and credits
 * - Compare with outstanding orders
 * - Identify and flag mismatches
 * - Generate audit reports
 * 
 * Compliance:
 * - Append-only ledger verification
 * - Double-entry bookkeeping validation
 * - Order-to-ledger traceability
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class ReconciliationService {
  /**
   * Perform full daily reconciliation
   * 
   * @param {Object} options - Reconciliation options
   * @param {string} options.date - Date to reconcile (default: today)
   * @param {boolean} options.detailed - Include detailed breakdown (default: true)
   * @returns {Promise<Object>} Reconciliation report
   */
  async performDailyReconciliation(options = {}) {
    const { date = new Date(), detailed = true } = options;

    const startTime = Date.now();
    logger.info('Starting daily reconciliation', { date: date.toISOString() });

    try {
      // 1. Get ledger summary
      const ledgerSummary = await this.getLedgerSummary(date);
      logger.debug('Ledger summary retrieved', ledgerSummary);

      // 2. Get outstanding orders summary
      const ordersSummary = await this.getOutstandingOrdersSummary(date);
      logger.debug('Orders summary retrieved', ordersSummary);

      // 3. Calculate expected vs actual
      const comparison = await this.compareAccountsToOrders(ledgerSummary, ordersSummary);

      // 4. Identify mismatches
      const mismatches = await this.identifyMismatches(date);
      logger.debug('Mismatches identified', { count: mismatches.length });

      // 5. Generate report
      const report = {
        reconciliation_date: date,
        status: mismatches.length === 0 ? 'MATCHED' : 'MISMATCHED',
        
        ledger: ledgerSummary,
        orders: ordersSummary,
        comparison,
        
        mismatches,
        mismatch_count: mismatches.length,
        
        statistics: {
          total_ledger_entries: ledgerSummary.total_entries,
          total_debits: ledgerSummary.total_debits,
          total_credits: ledgerSummary.total_credits,
          net_position: ledgerSummary.net_position,
          
          outstanding_orders: ordersSummary.outstanding_orders,
          pending_amount: ordersSummary.pending_amount,
          
          variance: comparison.variance,
          variance_percentage: comparison.variance_percentage,
          bookkeeping_balanced: comparison.bookkeeping_balanced
        },
        
        generated_at: new Date(),
        duration_ms: Date.now() - startTime,
        
        ...(detailed && {
          detailed_ledger: await this.getDetailedLedgerBreakdown(date),
          detailed_orders: await this.getDetailedOrdersBreakdown(date)
        })
      };

      logger.info('Daily reconciliation completed', {
        status: report.status,
        mismatches: report.mismatch_count,
        duration_ms: report.duration_ms
      });

      return report;
    } catch (error) {
      logger.error('Reconciliation failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get ledger summary (debits/credits totals)
   * 
   * @param {Date} date - Date to summarize
   * @returns {Promise<Object>} Ledger summary
   */
  async getLedgerSummary(date) {
    try {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      // Get all ledger entries
      const entries = await prisma.ledgerEntry.findMany({
        where: {
          created_at: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        select: {
          id: true,
          entryType: true,
          amount: true,
          retailerId: true,
          wholesalerId: true
        }
      });

      // Sum by type
      const debits = entries
        .filter(e => e.entryType === 'DEBIT')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const credits = entries
        .filter(e => e.entryType === 'CREDIT')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const adjustments = entries
        .filter(e => e.entryType === 'ADJUSTMENT')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      // Sum by entity
      const byRetailer = {};
      const byWholesaler = {};

      for (const entry of entries) {
        if (entry.retailerId) {
          byRetailer[entry.retailerId] = (byRetailer[entry.retailerId] || 0) + Number(entry.amount);
        }
        if (entry.wholesalerId) {
          byWholesaler[entry.wholesalerId] = (byWholesaler[entry.wholesalerId] || 0) + Number(entry.amount);
        }
      }

      return {
        total_entries: entries.length,
        total_debits: debits,
        total_credits: credits,
        total_adjustments: adjustments,
        net_position: credits - debits, // Positive = money in system
        
        by_type: {
          DEBIT: debits,
          CREDIT: credits,
          ADJUSTMENT: adjustments
        },
        
        retailers: Object.keys(byRetailer).length,
        wholesalers: Object.keys(byWholesaler).length,
        
        by_retailer_count: byRetailer,
        by_wholesaler_count: byWholesaler
      };
    } catch (error) {
      logger.error('Error getting ledger summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Get outstanding orders summary
   * 
   * @param {Date} date - Date reference
   * @returns {Promise<Object>} Orders summary
   */
  async getOutstandingOrdersSummary(date) {
    try {
      // Outstanding orders = created but not delivered/failed
      const orders = await prisma.order.findMany({
        where: {
          status: {
            in: ['CREATED', 'CONFIRMED', 'PROCESSING']
          },
          created_at: {
            lte: new Date(date.getTime() + 24 * 60 * 60 * 1000) // Up to end of date
          }
        },
        select: {
          id: true,
          totalAmount: true,
          status: true,
          retailerId: true,
          wholesalerId: true
        }
      });

      // Sum by status
      const byStatus = {};
      let totalAmount = 0;

      for (const order of orders) {
        byStatus[order.status] = (byStatus[order.status] || 0) + 1;
        totalAmount += Number(order.totalAmount);
      }

      return {
        outstanding_orders: orders.length,
        pending_amount: totalAmount,
        
        by_status: byStatus,
        
        // Breakdown by date range
        orders_breakdown: {
          created_today: orders.filter(o => {
            const created = new Date(o.created_at);
            return created.toDateString() === date.toDateString();
          }).length,
          created_earlier: orders.filter(o => {
            const created = new Date(o.created_at);
            return created.toDateString() !== date.toDateString();
          }).length
        }
      };
    } catch (error) {
      logger.error('Error getting orders summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Compare ledger accounts to orders
   * 
   * Principle: Orders should match ledger entries
   * - Each order should have corresponding ledger entries
   * - Totals should reconcile
   * 
   * @param {Object} ledger - Ledger summary
   * @param {Object} orders - Orders summary
   * @returns {Object} Comparison results
   */
  async compareAccountsToOrders(ledger, orders) {
    const ledgerTotal = ledger.total_debits + ledger.total_credits;
    const orderTotal = orders.pending_amount;
    const variance = Math.abs(ledgerTotal - orderTotal);
    const variance_percentage = (variance / (ledgerTotal || 1)) * 100;

    // Check double-entry bookkeeping (debits = credits for closed orders)
    const bookkeeping_balanced = ledger.total_debits === ledger.total_credits;

    return {
      ledger_total: ledgerTotal,
      orders_total: orderTotal,
      variance,
      variance_percentage,
      
      status: variance === 0 ? 'BALANCED' : 'UNBALANCED',
      bookkeeping_balanced,
      
      variance_status: variance < 1 ? 'OK' : 'FLAG_FOR_REVIEW'
    };
  }

  /**
   * Identify specific mismatches
   * 
   * @param {Date} date - Date to check
   * @returns {Promise<Array>} Array of mismatches
   */
  async identifyMismatches(date) {
    const mismatches = [];

    try {
      // 1. Orders without ledger entries
      const ordersWithoutLedger = await prisma.order.findMany({
        where: {
          status: { in: ['CONFIRMED', 'PROCESSING'] },
          ledgerEntries: { none: {} }
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true
        },
        take: 10
      });

      if (ordersWithoutLedger.length > 0) {
        mismatches.push({
          type: 'ORDERS_WITHOUT_LEDGER',
          severity: 'HIGH',
          count: ordersWithoutLedger.length,
          description: 'Orders exist without corresponding ledger entries',
          affected_orders: ordersWithoutLedger
        });
      }

      // 2. Ledger entries without orders
      const ledgerWithoutOrders = await prisma.ledgerEntry.findMany({
        where: {
          orderId: null,
          entryType: 'DEBIT'
        },
        select: {
          id: true,
          amount: true,
          retailerId: true,
          wholesalerId: true
        },
        take: 10
      });

      if (ledgerWithoutOrders.length > 0) {
        mismatches.push({
          type: 'LEDGER_WITHOUT_ORDERS',
          severity: 'MEDIUM',
          count: ledgerWithoutOrders.length,
          description: 'Ledger entries exist without corresponding orders',
          affected_entries: ledgerWithoutOrders
        });
      }

      // 3. Amount mismatches between orders and ledger
      const orders = await prisma.order.findMany({
        where: { status: { in: ['CONFIRMED', 'PROCESSING'] } },
        include: { ledgerEntries: true }
      });

      for (const order of orders) {
        const ledgerSum = order.ledgerEntries.reduce((sum, e) => sum + Number(e.amount), 0);
        if (ledgerSum !== Number(order.totalAmount)) {
          mismatches.push({
            type: 'AMOUNT_MISMATCH',
            severity: 'HIGH',
            order_id: order.id,
            order_amount: order.totalAmount,
            ledger_sum: ledgerSum,
            variance: Math.abs(ledgerSum - Number(order.totalAmount))
          });
        }
      }

      // 4. Duplicate ledger entries for same order
      const duplicates = await prisma.$queryRaw`
        SELECT order_id, COUNT(*) as count, SUM(amount) as total
        FROM ledger_entries
        WHERE order_id IS NOT NULL
        GROUP BY order_id
        HAVING COUNT(*) > 1
        LIMIT 10
      `;

      if (duplicates && duplicates.length > 0) {
        mismatches.push({
          type: 'DUPLICATE_LEDGER_ENTRIES',
          severity: 'MEDIUM',
          count: duplicates.length,
          description: 'Orders have multiple ledger entries',
          affected: duplicates
        });
      }

      return mismatches;
    } catch (error) {
      logger.error('Error identifying mismatches', { error: error.message });
      return mismatches;
    }
  }

  /**
   * Get detailed ledger breakdown
   * 
   * @param {Date} date - Date to break down
   * @returns {Promise<Array>} Detailed ledger entries
   */
  async getDetailedLedgerBreakdown(date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const entries = await prisma.ledgerEntry.findMany({
      where: {
        created_at: {
          gte: dayStart,
          lte: dayEnd
        }
      },
      select: {
        id: true,
        entryType: true,
        amount: true,
        retailerId: true,
        wholesalerId: true,
        orderId: true,
        created_at: true
      },
      orderBy: { created_at: 'asc' }
    });

    return entries;
  }

  /**
   * Get detailed orders breakdown
   * 
   * @param {Date} date - Date reference
   * @returns {Promise<Array>} Outstanding orders with details
   */
  async getDetailedOrdersBreakdown(date) {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['CREATED', 'CONFIRMED', 'PROCESSING'] },
        created_at: { lte: new Date(date.getTime() + 24 * 60 * 60 * 1000) }
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        status: true,
        retailerId: true,
        wholesalerId: true,
        created_at: true,
        _count: {
          select: { ledgerEntries: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    return orders;
  }

  /**
   * Store reconciliation report in database
   * 
   * @param {Object} report - Reconciliation report
   * @returns {Promise<Object>} Stored report
   */
  async storeReconciliationReport(report) {
    try {
      const stored = await prisma.financialReconciliation.create({
        data: {
          reconciliation_date: report.reconciliation_date,
          reconciliationType: 'DAILY',
          
          systemAmount: report.statistics.total_debits + report.statistics.total_credits,
          externalAmount: report.statistics.pending_amount,
          discrepancy: report.statistics.variance,
          isMatched: report.status === 'MATCHED',
          
          matchedTransactions: report.statistics.total_ledger_entries,
          unmatchedCount: report.mismatch_count,
          unmatchedDetails: JSON.stringify(report.mismatches),
          
          resolutionStatus: report.status === 'MATCHED' ? 'RESOLVED' : 'PENDING',
          
          startedAt: new Date(Date.now() - report.duration_ms),
          completedAt: new Date()
        }
      });

      logger.info('Reconciliation report stored', {
        id: stored.id,
        status: stored.resolutionStatus
      });

      return stored;
    } catch (error) {
      logger.error('Error storing reconciliation report', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get reconciliation statistics for monitoring
   * 
   * @returns {Promise<Object>} Statistics
   */
  async getReconciliationStatistics() {
    try {
      const totalReports = await prisma.financialReconciliation.count();
      
      const resolved = await prisma.financialReconciliation.count({
        where: { resolutionStatus: 'RESOLVED' }
      });
      
      const pending = await prisma.financialReconciliation.count({
        where: { resolutionStatus: 'PENDING' }
      });
      
      const matched = await prisma.financialReconciliation.count({
        where: { isMatched: true }
      });

      return {
        total_reconciliations: totalReports,
        resolved: resolved,
        pending: pending,
        matched: matched,
        success_rate: totalReports > 0 ? (matched / totalReports * 100).toFixed(2) : 0
      };
    } catch (error) {
      logger.error('Error getting reconciliation statistics', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Format report as audit table (ASCII format)
   * 
   * @param {Object} report - Reconciliation report
   * @returns {string} Formatted table
   */
  formatReportAsTable(report) {
    const s = '  '; // spacing

    let table = '\n';
    table += '╔════════════════════════════════════════════════════════════════════╗\n';
    table += '║                    DAILY RECONCILIATION REPORT                      ║\n';
    table += '╚════════════════════════════════════════════════════════════════════╝\n';
    table += `\nReport Date: ${report.reconciliation_date.toISOString().split('T')[0]}\n`;
    table += `Status: ${report.status} (${report.mismatch_count} mismatches)\n`;
    table += `Generated: ${new Date().toISOString()}\n`;

    // Ledger Summary
    table += '\n┌─ LEDGER SUMMARY ─────────────────────────────────────┐\n';
    table += `│ Total Entries:${s}${report.statistics.total_ledger_entries.toString().padEnd(35)}│\n`;
    table += `│ Total Debits:${s}${`₹${report.statistics.total_debits.toFixed(2)}`.padEnd(34)}│\n`;
    table += `│ Total Credits:${s}${`₹${report.statistics.total_credits.toFixed(2)}`.padEnd(33)}│\n`;
    table += `│ Net Position:${s}${`₹${report.statistics.net_position.toFixed(2)}`.padEnd(33)}│\n`;
    table += '└──────────────────────────────────────────────────────┘\n';

    // Orders Summary
    table += '\n┌─ ORDERS SUMMARY ─────────────────────────────────────┐\n';
    table += `│ Outstanding Orders:${s}${report.statistics.outstanding_orders.toString().padEnd(28)}│\n`;
    table += `│ Pending Amount:${s}${`₹${report.statistics.pending_amount.toFixed(2)}`.padEnd(31)}│\n`;
    table += '└──────────────────────────────────────────────────────┘\n';

    // Comparison
    table += '\n┌─ RECONCILIATION ─────────────────────────────────────┐\n';
    table += `│ Variance:${s}${`₹${report.statistics.variance.toFixed(2)}`.padEnd(37)}│\n`;
    table += `│ Variance %:${s}${`${report.statistics.variance_percentage.toFixed(2)}%`.padEnd(35)}│\n`;
    table += `│ Status:${s}${report.comparison.status.padEnd(40)}│\n`;
    table += `│ Bookkeeping Balanced:${s}${(report.statistics.bookkeeping_balanced ? 'YES' : 'NO').padEnd(28)}│\n`;
    table += '└──────────────────────────────────────────────────────┘\n';

    // Mismatches
    if (report.mismatches.length > 0) {
      table += '\n┌─ MISMATCHES FLAGGED ─────────────────────────────────┐\n';
      for (const mismatch of report.mismatches) {
        table += `│ TYPE: ${mismatch.type.padEnd(42)}│\n`;
        table += `│ SEVERITY: ${mismatch.severity.padEnd(37)}│\n`;
        if (mismatch.count) {
          table += `│ COUNT: ${mismatch.count.toString().padEnd(41)}│\n`;
        }
        table += `│ ${mismatch.description.padEnd(60)}│\n`;
      }
      table += '└──────────────────────────────────────────────────────┘\n';
    }

    // Performance
    table += `\nCompleted in: ${report.duration_ms}ms\n`;

    return table;
  }
}

module.exports = new ReconciliationService();
