const schedule = require('node-schedule');
const prisma = require('../config/database');
const reportingService = require('../services/reporting.service');
const emailService = require('../services/email.service');

/**
 * Scheduled Job: Daily Risk Report
 * Runs every day at 6:00 AM
 */
const job = schedule.scheduleJob('0 6 * * *', async () => {
    try {
        console.log('\n⏰ [Daily Risk Report] Starting generation...');

        // Get all active wholesalers
        const wholesalers = await prisma.wholesaler.findMany({
            where: { isActive: true, email: { not: null } },
            select: { id: true, businessName: true }
        });

        console.log(`📊 Processing reports for ${wholesalers.length} wholesalers...`);

        let sentCount = 0;
        let errorCount = 0;

        for (const wholesaler of wholesalers) {
            try {
                const report = await reportingService.generateDailyRiskReport(wholesaler.id);

                // Send Email
                if (report.wholesaler.email) {
                    await emailService.sendEmail(
                        report.wholesaler.email,
                        `Daily Risk Report - ${new Date().toLocaleDateString()}`,
                        report.html
                    );
                    sentCount++;
                }
            } catch (err) {
                console.error(`❌ Failed to generate/send report for ${wholesaler.businessName}:`, err.message);
                errorCount++;
            }
        }

        console.log(`✅ [Daily Risk Report] Completed. Sent: ${sentCount}, Failed: ${errorCount}`);

    } catch (error) {
        console.error('❌ [Daily Risk Report] Fatal Error:', error);
    }
});

console.log('✅ Daily Risk Report Job scheduled (runs daily at 6:00 AM)');

module.exports = job;
