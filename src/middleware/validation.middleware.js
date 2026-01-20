const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Generic Validation Middleware using Joi
 * @param {Joi.Schema} schema - The Joi schema to validate against
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            stripUnknown: true, // IMPORTANT: Strip unknown fields for security
            allowUnknown: false
        });

        if (error) {
            const errorDetails = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            // Log validation failure (warn level)
            logger.warn(`Validation failed for ${req.originalUrl}`, {
                ip: req.ip,
                errors: errorDetails
            });

            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                details: errorDetails
            });
        }

        // Replace request data with validated (and stripped) data
        req[source] = value;
        next();
    };
};

module.exports = validate;
