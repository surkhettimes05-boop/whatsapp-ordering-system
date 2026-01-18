const schedule = require('node-schedule');
const retailerInsightsService = require('../services/retailerInsights.service');
const guardrailsService = require('../services/guardrails.service');

/**
 * FEATURE 6: Regenerate retailer insights
 * Run daily at 3:00 AM (off-peak)
 * Recalculates order stats, spending patterns, etc for all retailers
 */
const regenerateInsightsJob = schedule.scheduleJob('0 3 * * *', async function () {
    console.log('⏰ Running Regenerate Retailer Insights Job...');

    try {
        const result = await retailerInsightsService.regenerateAllInsights();
        console.log(`✅ Insights regeneration completed - ${result.success}/${result.total} successful`);
        if (result.failed > 0) {
            console.warn(`⚠️  ${result.failed} retailers failed`);
        }
    } catch (e) {
        console.error('❌ Error in Regenerate Insights Job:', e);
    }
});

/**
 * FEATURE 8: Evaluate system guardrails
 * Run daily at 4:00 AM
 * Auto-pauses credit for retailers exceeding max outstanding days
 * Auto-blocks orders that would exceed max order value
 */
const evaluateGuardrailsJob = schedule.scheduleJob('0 4 * * *', async function () {
    console.log('⏰ Running Evaluate Guardrails Job...');

    try {
        const result = await guardrailsService.evaluateAndApplyGuardrails();
        console.log(`✅ Guardrails evaluation completed - ${result.paused}/${result.evaluated} retailers had actions taken`);
        
        if (result.details.length > 0) {
            console.log('📋 Retailers with actions:');
            result.details.forEach(detail => {
                console.log(`   - ${detail.pasalName}: ${detail.reason}`);
            });
        }
    } catch (e) {
        console.error('❌ Error in Evaluate Guardrails Job:', e);
    }
});

module.exports = {
    regenerateInsightsJob,
    evaluateGuardrailsJob
};
