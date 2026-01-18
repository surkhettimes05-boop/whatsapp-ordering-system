/**
 * Daily Reports Processor
 * 
 * Generates and sends daily reports
 */

const prisma = require('../../config/database');
const reportingService = require('../../services/reporting.service');
const emailService = require('../../services/email.service');
const analyticsService = require('../../services/analytics.service');

/**
 * Process daily reports job
 * @param {Job} job - BullMQ job
 * @returns {Promise<object>} - Result
 */
async function processDailyReports(job) {
    const { reportType = 'all', date } = job.data;
    const reportDate = date ? new Date(date) : new Date();

    console.log(`📊 Processing daily reports for ${reportDate.toISOString().split('T')[0]}`);

    const results = {
        wholesalersContacted: 0,
        wholesalersFailed: 0,
        adminReportGenerated: false
    };

    try {
        // 1. Send Risk Reports to Wholesalers
        if (reportType === 'all' || reportType === 'credit') {
            const wholesalers = await prisma.wholesaler.findMany({
                where: { isActive: true, email: { not: null } },
                select: { id: true, businessName: true, email: true }
            });

            console.log(`📧 Sending risk reports to ${wholesalers.length} wholesalers...`);

            for (const wholesaler of wholesalers) {
                try {
                    const report = await reportingService.generateDailyRiskReport(wholesaler.id);

                    if (report.wholesaler.email) {
                        await emailService.sendEmail(
                            report.wholesaler.email,
                            `Daily Risk Report - ${new Date().toLocaleDateString()}`,
                            report.html
                        );
                        results.wholesalersContacted++;
                    }
                } catch (err) {
                    console.error(`❌ Failed to send report to ${wholesaler.businessName}:`, err.message);
                    results.wholesalersFailed++;
                }
            }
        }

        // 2. Generate Admin Analytics (Summary) - Optional logging or separate admin email
        if (reportType === 'all' || reportType === 'admin') {
            try {
                const orderStats = await analyticsService.getAnalyticsDashboard({
                    startDate: new Date(reportDate.setHours(0, 0, 0, 0)),
                    endDate: new Date(reportDate.setHours(23, 59, 59, 999))
                });
                console.log('📈 Admin Daily Stats:', orderStats);
                results.adminReportGenerated = true;
            } catch (err) {
                console.error('Failed to generate admin stats:', err.message);
            }
        }

        return {
            success: true,
            timestamp: new Date().toISOString(),
            ...results
        };

    } catch (error) {
        console.error('Error processing daily reports:', error);
        throw error;
    }
}

module.exports = processDailyReports;
