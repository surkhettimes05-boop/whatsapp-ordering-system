/**
 * Order Validation Schemas (Joi)
 * 
 * Joi-based validation schemas for order endpoints
 * Can be used alongside or instead of express-validator
 */

const { createSchema, commonSchemas, Joi } = require('../middleware/validation.middleware');

// Create order schema
const createOrderSchema = createSchema({
    body: {
        items: Joi.array().items({
            productId: commonSchemas.uuid,
            quantity: Joi.number().integer().min(1).required()
        }).min(1).required(),
        addressId: commonSchemas.uuidOptional,
        paymentMethod: Joi.string().valid('COD', 'ONLINE', 'CHEQUE', 'BANK_TRANSFER', 'CASH').optional(),
        notes: Joi.string().max(500).optional()
    }
});

// Update order status schema
const updateOrderStatusSchema = createSchema({
    params: {
        id: commonSchemas.uuid
    },
    body: {
        status: commonSchemas.orderStatus.required(),
        reason: Joi.string().max(500).optional()
    }
});

// List orders schema
const listOrdersSchema = createSchema({
    query: {
        ...commonSchemas.pagination,
        status: commonSchemas.orderStatus.optional()
    }
});

// Get order schema
const getOrderSchema = createSchema({
    params: {
        id: commonSchemas.uuid
    }
});

module.exports = {
    createOrderSchema,
    updateOrderStatusSchema,
    listOrdersSchema,
    getOrderSchema
};
