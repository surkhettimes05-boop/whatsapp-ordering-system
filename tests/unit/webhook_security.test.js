const { validateTwilioWebhook, replayProtectionMiddleware } = require('../../src/middleware/twilio-webhook.middleware');
const httpMocks = require('node-mocks-http');
const assert = require('assert');
const twilio = require('twilio');

// Mock Logger
const logger = require('../../src/utils/logger');
logger.warn = () => { };
logger.error = () => { };
logger.debug = () => { };
logger.info = () => { };

// Mock Env
process.env.TWILIO_AUTH_TOKEN = 'mock-auth-token';
process.env.NODE_ENV = 'production'; // Force validation
process.env.FORCE_TWILIO_VERIFY = 'true';

describe('Webhook Security', () => {

    // Helper to generate signature
    function getSignature(url, params) {
        return twilio.webhooks.getExpectedTwilioSignature(
            process.env.TWILIO_AUTH_TOKEN,
            url,
            params
        );
    }

    it('should reject missing signature', () => {
        const req = httpMocks.createRequest({
            method: 'POST',
            url: '/webhook',
            headers: {}
        });
        const res = httpMocks.createResponse();
        const next = () => { };

        const middleware = validateTwilioWebhook('https://example.com/webhook');
        middleware(req, res, next);

        assert.strictEqual(res.statusCode, 403);
        const data = JSON.parse(res._getData());
        assert.strictEqual(data.error, 'Missing Twilio signature');
    });

    it('should accept valid signature', () => {
        const url = 'https://example.com/webhook';
        const params = { Body: 'Hello' };
        const signature = getSignature(url, params);

        const req = httpMocks.createRequest({
            method: 'POST',
            url: '/webhook',
            headers: {
                'x-twilio-signature': signature,
                'host': 'example.com'
            },
            originalUrl: '/webhook',
            body: params
        });
        const res = httpMocks.createResponse();
        let nextCalled = false;
        const next = () => { nextCalled = true; };

        const middleware = validateTwilioWebhook(url);
        middleware(req, res, next);

        assert.strictEqual(nextCalled, true, 'Next should be called for valid signature');
    });

    it('should reject invalid signature', () => {
        const url = 'https://example.com/webhook';
        const params = { Body: 'Hello' };

        const req = httpMocks.createRequest({
            method: 'POST',
            url: '/webhook',
            headers: {
                'x-twilio-signature': 'invalid-signature',
                'host': 'example.com'
            },
            originalUrl: '/webhook',
            body: params
        });
        const res = httpMocks.createResponse();
        const next = () => { };

        const middleware = validateTwilioWebhook(url);
        middleware(req, res, next);

        assert.strictEqual(res.statusCode, 403);
    });
});

console.log('✅ Webhook Security Tests Passed (Mocked)');
