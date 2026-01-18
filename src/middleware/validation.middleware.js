/**
 * Request Validation Middleware
 * 
 * Fintech-grade request validation using Joi
 * Validates request body, query, and params
 */

const Joi = require('joi');

/**
 * Validate request using Joi schema
 * @param {object} schema - Joi schema object with body, query, params
 * @returns {Function} - Express middleware
 */
function validate(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(
            {
                body: req.body,
                query: req.query,
                params: req.params
            },
            {
                abortEarly: false, // Return all errors
                stripUnknown: true, // Remove unknown fields
                allowUnknown: false // Don't allow unknown fields
            }
        );

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                errors: errors
            });
        }

        // Replace request data with validated (sanitized) data
        req.body = value.body || req.body;
        req.query = value.query || req.query;
        req.params = value.params || req.params;

        next();
    };
}

/**
 * Create validation schema
 * @param {object} schemaDef - Schema definition with body, query, params
 * @returns {Joi.ObjectSchema} - Joi schema
 */
function createSchema(schemaDef) {
    const schema = {};

    if (schemaDef.body) {
        schema.body = Joi.object(schemaDef.body);
    }

    if (schemaDef.query) {
        schema.query = Joi.object(schemaDef.query);
    }

    if (schemaDef.params) {
        schema.params = Joi.object(schemaDef.params);
    }

    return Joi.object(schema);
}

/**
 * Common validation schemas
 */
const commonSchemas = {
    // UUID validation
    uuid: Joi.string().uuid().required(),
    uuidOptional: Joi.string().uuid().optional(),

    // Phone number (international format)
    phoneNumber: Joi.string()
        .pattern(/^\+?[1-9]\d{9,14}$/)
        .required()
        .messages({
            'string.pattern.base': 'Phone number must be in international format'
        }),

    // Email
    email: Joi.string().email().required(),
    emailOptional: Joi.string().email().optional(),

    // Amount (decimal)
    amount: Joi.number().positive().precision(2).required(),
    amountOptional: Joi.number().positive().precision(2).optional(),

    // Date
    date: Joi.date().iso().required(),
    dateOptional: Joi.date().iso().optional(),

    // Pagination
    pagination: {
        page: Joi.number().integer().min(1).default(1).optional(),
        limit: Joi.number().integer().min(1).max(100).default(50).optional()
    },

    // Order status
    orderStatus: Joi.string().valid(
        'CREATED',
        'PENDING_BIDS',
        'CREDIT_APPROVED',
        'STOCK_RESERVED',
        'WHOLESALER_ACCEPTED',
        'CONFIRMED',
        'PROCESSING',
        'PACKED',
        'OUT_FOR_DELIVERY',
        'SHIPPED',
        'DELIVERED',
        'FAILED',
        'CANCELLED',
        'RETURNED'
    ),

    // Payment mode
    paymentMode: Joi.string().valid('COD', 'ONLINE', 'CHEQUE', 'BANK_TRANSFER', 'CASH'),

    // Ledger entry type
    ledgerEntryType: Joi.string().valid('DEBIT', 'CREDIT', 'ADJUSTMENT', 'REVERSAL')
};

module.exports = {
    validate,
    createSchema,
    Joi,
    commonSchemas
};
