/**
 * Comprehensive Validation Schemas
 * 
 * Joi schemas for all API endpoints
 * Ensures data integrity and prevents invalid inputs
 */

const { Joi, commonSchemas } = require('../middleware/validation.middleware');

const schemas = {
    // ============================================
    // ORDER SCHEMAS
    // ============================================

    createOrder: {
        body: {
            items: Joi.array().items(
                Joi.object({
                    productId: commonSchemas.uuid,
                    quantity: Joi.number().integer().min(1).max(10000).required()
                        .messages({
                            'number.min': 'Quantity must be at least 1',
                            'number.max': 'Quantity cannot exceed 10,000'
                        })
                })
            ).min(1).max(50).required()
                .messages({
                    'array.min': 'Order must contain at least 1 item',
                    'array.max': 'Order cannot contain more than 50 items'
                }),
            paymentMode: commonSchemas.paymentMode.required(),
            deliveryAddress: Joi.string().max(500).optional(),
            notes: Joi.string().max(1000).optional()
        }
    },

    updateOrderStatus: {
        params: {
            orderId: commonSchemas.uuid
        },
        body: {
            status: commonSchemas.orderStatus.required(),
            reason: Joi.string().max(500).optional()
        }
    },

    cancelOrder: {
        params: {
            orderId: commonSchemas.uuid
        },
        body: {
            reason: Joi.string().min(10).max(500).required()
        }
    },

    // ============================================
    // BIDDING SCHEMAS
    // ============================================

    submitBid: {
        body: {
            orderId: commonSchemas.uuid,
            priceQuote: Joi.number().positive().precision(2).required()
                .messages({
                    'number.positive': 'Price must be positive'
                }),
            deliveryEta: Joi.string().max(50).required()
                .pattern(/^(\d+)\s*(h|hour|hours|d|day|days|min|minutes)$/i)
                .messages({
                    'string.pattern.base': 'ETA must be in format: "2H", "3 hours", "1D"'
                }),
            stockConfirmed: Joi.boolean().required(),
            notes: Joi.string().max(500).optional()
        }
    },

    selectWinner: {
        params: {
            orderId: commonSchemas.uuid
        }
    },

    // ============================================
    // CREDIT SCHEMAS
    // ============================================

    updateCreditLimit: {
        params: {
            retailerId: commonSchemas.uuid
        },
        body: {
            newLimit: Joi.number().positive().max(10000000).required()
                .messages({
                    'number.max': 'Credit limit cannot exceed 10,000,000'
                }),
            reason: Joi.string().min(10).max(500).required()
                .messages({
                    'string.min': 'Reason must be at least 10 characters'
                })
        }
    },

    overrideCredit: {
        params: {
            orderId: commonSchemas.uuid
        },
        body: {
            approved: Joi.boolean().required(),
            reason: Joi.string().min(10).max(500).required(),
            adminId: commonSchemas.uuid.required()
        }
    },

    // ============================================
    // PAYMENT SCHEMAS
    // ============================================

    recordPayment: {
        body: {
            retailerId: commonSchemas.uuid,
            wholesalerId: commonSchemas.uuid,
            amount: Joi.number().positive().precision(2).required(),
            paymentMode: commonSchemas.paymentMode.required(),
            chequeNumber: Joi.string().when('paymentMode', {
                is: 'CHEQUE',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
            chequeDate: Joi.date().when('paymentMode', {
                is: 'CHEQUE',
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
            bankName: Joi.string().when('paymentMode', {
                is: Joi.valid('CHEQUE', 'BANK_TRANSFER'),
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
            notes: Joi.string().max(1000).optional()
        }
    },

    // ============================================
    // LEDGER SCHEMAS
    // ============================================

    createManualLedgerEntry: {
        body: {
            retailerId: commonSchemas.uuid,
            wholesalerId: commonSchemas.uuid,
            entryType: commonSchemas.ledgerEntryType.required(),
            amount: Joi.number().positive().precision(2).required(),
            reason: Joi.string().min(10).max(500).required(),
            dueDate: commonSchemas.dateOptional
        }
    },

    reverseLedgerEntry: {
        params: {
            entryId: commonSchemas.uuid
        },
        body: {
            reason: Joi.string().min(10).max(500).required()
        }
    },

    // ============================================
    // ADMIN SCHEMAS
    // ============================================

    forceAssignVendor: {
        params: {
            orderId: commonSchemas.uuid
        },
        body: {
            wholesalerId: commonSchemas.uuid,
            reason: Joi.string().min(10).max(500).required()
        }
    },

    // ============================================
    // QUERY SCHEMAS (for GET requests)
    // ============================================

    paginatedQuery: {
        query: {
            page: Joi.number().integer().min(1).default(1).optional(),
            limit: Joi.number().integer().min(1).max(100).default(50).optional(),
            sortBy: Joi.string().valid('createdAt', 'updatedAt', 'amount', 'status').optional(),
            sortOrder: Joi.string().valid('asc', 'desc').default('desc').optional()
        }
    },

    orderFilters: {
        query: {
            ...schemas.paginatedQuery?.query,
            status: commonSchemas.orderStatus.optional(),
            retailerId: commonSchemas.uuidOptional,
            wholesalerId: commonSchemas.uuidOptional,
            startDate: commonSchemas.dateOptional,
            endDate: commonSchemas.dateOptional
        }
    },

    creditFilters: {
        query: {
            ...schemas.paginatedQuery?.query,
            retailerId: commonSchemas.uuidOptional,
            wholesalerId: commonSchemas.uuidOptional,
            minAmount: Joi.number().positive().optional(),
            maxAmount: Joi.number().positive().optional(),
            overdue: Joi.boolean().optional()
        }
    },

    // ============================================
    // PRODUCT SCHEMAS
    // ============================================

    createProduct: {
        body: {
            name: Joi.string().min(3).max(200).required(),
            categoryId: commonSchemas.uuid,
            unit: Joi.string().max(50).optional(),
            fixedPrice: Joi.number().positive().precision(2).required(),
            description: Joi.string().max(1000).optional(),
            imageUrl: Joi.string().uri().optional()
        }
    },

    updateProduct: {
        params: {
            productId: commonSchemas.uuid
        },
        body: {
            name: Joi.string().min(3).max(200).optional(),
            categoryId: commonSchemas.uuidOptional,
            unit: Joi.string().max(50).optional(),
            fixedPrice: Joi.number().positive().precision(2).optional(),
            description: Joi.string().max(1000).optional(),
            imageUrl: Joi.string().uri().optional(),
            isActive: Joi.boolean().optional()
        }
    },

    // ============================================
    // STOCK SCHEMAS
    // ============================================

    updateStock: {
        params: {
            wholesalerProductId: commonSchemas.uuid
        },
        body: {
            stock: Joi.number().integer().min(0).max(1000000).required(),
            priceOffered: Joi.number().positive().precision(2).optional(),
            minOrderQuantity: Joi.number().integer().min(1).optional(),
            leadTime: Joi.number().integer().min(0).max(720).optional() // Max 30 days
        }
    }
};

module.exports = schemas;
