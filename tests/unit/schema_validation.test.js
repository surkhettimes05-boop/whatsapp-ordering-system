const { createOrderSchema, whatsappWebhookSchema } = require('../../src/validators/schemas');
const assert = require('assert');

console.log('Testing Joi Schemas...');

// 1. Order Schema Valid
const validOrder = {
    items: [{ productId: 'p1', quantity: 10 }],
    notes: 'Urgent'
};
const { error: err1 } = createOrderSchema.validate(validOrder);
assert.strictEqual(err1, undefined, 'Valid order should pass');

// 2. Order Schema Invalid (No items)
const invalidOrder1 = { notes: 'Empty' };
const { error: err2 } = createOrderSchema.validate(invalidOrder1);
assert.ok(err2, 'Order without items should fail');

// 3. Order Schema Invalid (Bad quantity)
const invalidOrder2 = { items: [{ productId: 'p1', quantity: 0 }] };
const { error: err3 } = createOrderSchema.validate(invalidOrder2);
assert.ok(err3, 'Quantity 0 should fail');

// 4. WhatsApp Schema
const validWebhook = {
    SmsMessageSid: 'SM123',
    NumMedia: '0',
    SmsSid: 'SM123',
    WaId: '9779800000000',
    SmsStatus: 'received',
    Body: 'Hello',
    To: 'whatsapp:+123456',
    NumSegments: '1',
    MessageSid: 'SM123',
    AccountSid: 'AC123',
    From: 'whatsapp:+9779800000000',
    ApiVersion: '2010-04-01',
    ExtraField: 'ShouldBeAllowed' // .unknown(true)
};
const { error: err4 } = whatsappWebhookSchema.validate(validWebhook);
assert.strictEqual(err4, undefined, 'Valid WhatsApp webhook should pass');

console.log('✅ Schema Validation Tests Passed');
