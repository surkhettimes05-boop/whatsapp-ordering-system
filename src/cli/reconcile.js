#!/usr/bin/env node

/**
 * Reconciliation CLI Command
 * 
 * Usage:
 *   npm run reconcile
 *   npm run reconcile -- --date 2024-01-15
 *   npm run reconcile -- --detailed
 *   npm run reconcile -- --export json
 * 
 * Fintech auditor tool for manual reconciliation runs
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const path = require('path');
const reconciliationService = require('../services/reconciliation.service');
const { runDailyReconciliation } = require('../jobs/daily-reconciliation.job');
const logger = require('../utils/logger');

const argv = yargs(hideBin(process.argv))
  .option('date', {
    alias: 'd',
    describe: 'Date to reconcile (YYYY-MM-DD)',
    type: 'string',
    default: new Date().toISOString().split('T')[0]
  })
  .option('detailed', {
    alias: 'v',
    describe: 'Include detailed breakdown',
    type: 'boolean',
    default: true
  })
  .option('export', {
    alias: 'e',
    describe: 'Export format (json, csv, txt)',
    type: 'string',
    default: 'txt'
  })
  .option('output', {
    alias: 'o',
    describe: 'Output file path',
    type: 'string'
  })
  .option('save', {
    alias: 's',
    describe: 'Save report to database',
    type: 'boolean',
    default: true
  })
  .option('alerts', {
    alias: 'a',
    describe: 'Send alerts on mismatches',
    type: 'boolean',
    default: false
  })
  .help()
  .alias('help', 'h')
  .parseSync();

/**
 * Main CLI execution
 */
async function main() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          FINANCIAL RECONCILIATION - AUDIT TOOL             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Parse date
    const reconcileDate = new Date(argv.date);
    if (isNaN(reconcileDate.getTime())) {
      console.error(`❌ Invalid date format: ${argv.date}`);
      console.error('   Use YYYY-MM-DD format\n');
      process.exit(1);
    }

    console.log(`📅 Reconciliation Date: ${reconcileDate.toISOString().split('T')[0]}`);
    console.log(`📊 Detailed Mode: ${argv.detailed ? 'YES' : 'NO'}`);
    console.log(`💾 Save to Database: ${argv.save ? 'YES' : 'NO'}`);
    console.log(`📢 Send Alerts: ${argv.alerts ? 'YES' : 'NO'}`);
    console.log(`📁 Export Format: ${argv.export.toUpperCase()}\n`);

    console.log('⏳ Running reconciliation...\n');

    // Run reconciliation
    const report = await runDailyReconciliation({
      date: reconcileDate,
      save_report: argv.save,
      send_alerts: argv.alerts
    });

    // Display report
    const formattedTable = reconciliationService.formatReportAsTable(report);
    console.log(formattedTable);

    // Export if requested
    if (argv.output) {
      await exportReport(report, argv.export, argv.output);
    }

    // Summary
    console.log('\n✅ Reconciliation completed successfully');
    console.log(`   Status: ${report.status}`);
    console.log(`   Mismatches: ${report.mismatch_count}`);
    console.log(`   Duration: ${report.duration_ms}ms\n`);

    // Exit with code based on status
    process.exit(report.status === 'MATCHED' ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Reconciliation failed');
    console.error(`   Error: ${error.message}\n`);
    logger.error('CLI reconciliation error', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

/**
 * Export report in specified format
 * 
 * @param {Object} report - Reconciliation report
 * @param {string} format - Export format (json, csv, txt)
 * @param {string} outputPath - Output file path
 */
async function exportReport(report, format, outputPath) {
  try {
    const dir = path.dirname(outputPath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let content;

    if (format === 'json') {
      content = JSON.stringify(report, null, 2);
    } else if (format === 'csv') {
      content = convertToCSV(report);
    } else if (format === 'txt') {
      content = convertToTXT(report);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`📤 Report exported to: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Export failed: ${error.message}`);
    logger.error('Report export error', {
      error: error.message,
      format,
      outputPath
    });
  }
}

/**
 * Convert report to CSV format
 */
function convertToCSV(report) {
  let csv = 'Reconciliation Report\n';
  csv += `Date,${report.reconciliation_date.toISOString()}\n`;
  csv += `Status,${report.status}\n`;
  csv += `Mismatches,${report.mismatch_count}\n\n`;

  csv += 'Ledger Summary\n';
  csv += 'Metric,Value\n';
  csv += `Total Entries,${report.statistics.total_ledger_entries}\n`;
  csv += `Total Debits,${report.statistics.total_debits}\n`;
  csv += `Total Credits,${report.statistics.total_credits}\n`;
  csv += `Net Position,${report.statistics.net_position}\n\n`;

  csv += 'Orders Summary\n';
  csv += 'Metric,Value\n';
  csv += `Outstanding Orders,${report.statistics.outstanding_orders}\n`;
  csv += `Pending Amount,${report.statistics.pending_amount}\n\n`;

  csv += 'Reconciliation\n';
  csv += 'Metric,Value\n';
  csv += `Variance,${report.statistics.variance}\n`;
  csv += `Variance %,${report.statistics.variance_percentage}\n`;
  csv += `Bookkeeping Balanced,${report.statistics.bookkeeping_balanced}\n\n`;

  if (report.mismatches.length > 0) {
    csv += 'Mismatches\n';
    csv += 'Type,Severity,Description,Count\n';
    for (const mismatch of report.mismatches) {
      csv += `${mismatch.type},${mismatch.severity},${mismatch.description},${mismatch.count || '-'}\n`;
    }
  }

  return csv;
}

/**
 * Convert report to formatted text
 */
function convertToTXT(report) {
  const s = '  ';
  let txt = 'FINANCIAL RECONCILIATION REPORT\n';
  txt += '=' .repeat(60) + '\n\n';

  txt += `Date: ${report.reconciliation_date.toISOString().split('T')[0]}\n`;
  txt += `Status: ${report.status}\n`;
  txt += `Mismatches: ${report.mismatch_count}\n`;
  txt += `Generated: ${new Date().toISOString()}\n\n`;

  txt += 'LEDGER SUMMARY\n';
  txt += '-'.repeat(60) + '\n';
  txt += `Total Entries:${s}${report.statistics.total_ledger_entries}\n`;
  txt += `Total Debits:${s}₹${report.statistics.total_debits.toFixed(2)}\n`;
  txt += `Total Credits:${s}₹${report.statistics.total_credits.toFixed(2)}\n`;
  txt += `Net Position:${s}₹${report.statistics.net_position.toFixed(2)}\n\n`;

  txt += 'ORDERS SUMMARY\n';
  txt += '-'.repeat(60) + '\n';
  txt += `Outstanding Orders:${s}${report.statistics.outstanding_orders}\n`;
  txt += `Pending Amount:${s}₹${report.statistics.pending_amount.toFixed(2)}\n\n`;

  txt += 'RECONCILIATION\n';
  txt += '-'.repeat(60) + '\n';
  txt += `Variance:${s}₹${report.statistics.variance.toFixed(2)}\n`;
  txt += `Variance %:${s}${report.statistics.variance_percentage.toFixed(2)}%\n`;
  txt += `Bookkeeping Balanced:${s}${report.statistics.bookkeeping_balanced ? 'YES' : 'NO'}\n\n`;

  if (report.mismatches.length > 0) {
    txt += 'MISMATCHES\n';
    txt += '-'.repeat(60) + '\n';
    for (const mismatch of report.mismatches) {
      txt += `Type: ${mismatch.type}\n`;
      txt += `Severity: ${mismatch.severity}\n`;
      txt += `Description: ${mismatch.description}\n`;
      if (mismatch.count) txt += `Count: ${mismatch.count}\n`;
      txt += '\n';
    }
  }

  txt += 'DURATION\n';
  txt += '-'.repeat(60) + '\n';
  txt += `Completed in: ${report.duration_ms}ms\n`;

  return txt;
}

// Run main
if (require.main === module) {
  main();
}

module.exports = { main };
