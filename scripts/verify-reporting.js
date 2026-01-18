const reportingService = require('../src/services/reporting.service');
const { verifyTwilioSignature } = require('../src/middleware/production.middleware');
const prisma = require('../src/config/database');
const fs = require('fs');
const path = require('path');

// Mock Express Objects
const mockReq = (headers, body) => ({
    headers: headers || {},
    body: body || {},
    originalUrl: '/api/v1/whatsapp/webhook',
    clientIP: '127.0.0.1',
    get: (h) => headers[h]
});

const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.body = data;
        return res;
    };
    res.send = (data) => {
        res.body = data;
        return res;
    };
    return res;
};

const mockNext = () => {
    return 'NEXT_CALLED';
};

async function verifyReporting() {
    console.log('🧪 Verifying Reporting System...');

    try {
        // 1. Get a wholesaler to test with
        const wholesaler = await prisma.wholesaler.findFirst();
        if (!wholesaler) {
            console.log('⚠️ No wholesalers found, skipping report generation test.');
        } else {
            console.log(`   Testing Daily Risk Report for ${wholesaler.businessName}...`);
            const report = await reportingService.generateDailyRiskReport(wholesaler.id);
            if (report.html && report.stats) {
                console.log('   ✅ Daily Report Generated successfully');
                console.log(`      Stats: Orders=${report.stats.totalOrders}, Exposure=${report.stats.totalExposure}`);
            } else {
                console.error('   ❌ Daily Report generation failed (missing html/stats)');
            }
        }

        // 2. Test Admin Export
        console.log('   Testing Admin CSV Export...');
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const endDate = new Date();

        const orderCsv = await reportingService.generateAdminExport('ORDERS', startDate, endDate);
        if (typeof orderCsv === 'string' && (orderCsv.length === 0 || orderCsv.includes('OrderID'))) {
            console.log('   ✅ Order Export CSV generated successfully');
        } else {
            console.error('   ❌ Order Export CSV failed');
        }

        const ledgerCsv = await reportingService.generateAdminExport('LEDGER', startDate, endDate);
        if (typeof ledgerCsv === 'string' && (ledgerCsv.length === 0 || ledgerCsv.includes('EntryID'))) {
            console.log('   ✅ Ledger Export CSV generated successfully');
        } else {
            console.error('   ❌ Ledger Export CSV failed');
        }

    } catch (error) {
        console.error('❌ Reporting verification failed:', error);
    }
}

async function verifySecurity() {
    console.log('\n🔐 Verifying Webhook Security...');

    // Save original env
    const originalEnv = process.env.NODE_ENV;

    try {
        // Force production mode behavior for test
        process.env.NODE_ENV = 'production';
        process.env.TWILIO_AUTH_TOKEN = 'mock_token';
        process.env.WEBHOOK_URL = 'https://example.com/webhook';

        // 1. Test Missing Signature
        const reqMissing = mockReq({});
        const resMissing = mockRes();
        verifyTwilioSignature(reqMissing, resMissing, mockNext);

        if (resMissing.statusCode === 403) {
            console.log('   ✅ correctly blocked request without signature');
        } else {
            console.error(`   ❌ Failed to block missing signature (Status: ${resMissing.statusCode})`);
        }

        // 2. Test Invalid Signature
        const reqInvalid = mockReq({ 'x-twilio-signature': 'invalid_sig' });
        const resInvalid = mockRes();
        verifyTwilioSignature(reqInvalid, resInvalid, mockNext);

        if (resInvalid.statusCode === 403) {
            console.log('   ✅ correctly blocked request with invalid signature');
        } else {
            console.error(`   ❌ Failed to block invalid signature (Status: ${resInvalid.statusCode})`);
        }

        // 3. Test Bypass in Dev
        process.env.NODE_ENV = 'development';
        const reqDev = mockReq({});
        const resDev = mockRes();
        const result = verifyTwilioSignature(reqDev, resDev, mockNext);

        if (result === 'NEXT_CALLED') {
            console.log('   ✅ correctly skipped verification in development');
        } else {
            console.error('   ❌ Failed to skip verification in dev');
        }

    } catch (error) {
        console.error('❌ Security verification failed:', error);
    } finally {
        process.env.NODE_ENV = originalEnv;
    }
}

async function run() {
    await verifyReporting();
    await verifySecurity();
    await prisma.$disconnect();
}

run();
