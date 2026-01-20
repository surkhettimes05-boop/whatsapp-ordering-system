const Joi = require('joi');

/**
 * WhatsApp Webhook Schema (Twilio format)
 */
const whatsappWebhookSchema = Joi.object({
    SmsMessageSid: Joi.string().required(),
    NumMedia: Joi.string().required(),
    ProfileName: Joi.string().optional().allow(''),
    SmsSid: Joi.string().required(),
    WaId: Joi.string().required(),
    SmsStatus: Joi.string().required(),
    Body: Joi.string().required(),
    To: Joi.string().required(),
    NumSegments: Joi.string().required(),
    ReferralNumMedia: Joi.string().optional(),
    MessageSid: Joi.string().required(),
    AccountSid: Joi.string().required(),
    From: Joi.string().required(),
    ApiVersion: Joi.string().required()
}).unknown(true); // Twilio sends many extra fields, we validate strict shape for core ones but allow others

/**
 * Order Validation Schemas
 */
const createOrderSchema = Joi.object({
    items: Joi.array().items(
        Joi.object({
            productId: Joi.string().required(),
            quantity: Joi.number().integer().min(1).required()
        })
    ).min(1).required(),
    // Allow optional location override or notes
    notes: Joi.string().optional().max(500)
});

const getOrderParamsSchema = Joi.object({
    id: Joi.string().required().description('Order ID (CUID)')
});

module.exports = {
    whatsappWebhookSchema,
    createOrderSchema,
    getOrderParamsSchema
};
