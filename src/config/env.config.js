const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const logger = require('../utils/logger');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = Joi.object({
    // Server
    NODE_ENV: Joi.string().valid('production', 'development', 'test').default('development'),
    PORT: Joi.number().default(3000),
    DOMAIN: Joi.string().default('localhost'),

    // Database
    DATABASE_URL: Joi.string().required().description('PostgreSQL Connection URL'),

    // Redis (Optional in Dev, Required in Prod)
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow('').optional(),

    // JWT
    JWT_SECRET: Joi.string().required().description('JWT Secret Key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30),

    // Twilio (Critical for this app)
    TWILIO_ACCOUNT_SID: Joi.string().required(),
    TWILIO_AUTH_TOKEN: Joi.string().required(),
    TWILIO_WHATSAPP_FROM: Joi.string().required().description('WhatsApp From Number (e.g., whatsapp:+1415...)'),

    // Admin
    ADMIN_EMAIL: Joi.string().email().optional(),
    ADMIN_PASSWORD: Joi.string().optional(),

}).unknown();

const { value: envVars, error } = envSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
    logger.error(`Config validation error: ${error.message}`);
    throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    domain: envVars.DOMAIN,
    db: {
        url: envVars.DATABASE_URL,
    },
    redis: {
        host: envVars.REDIS_HOST,
        port: envVars.REDIS_PORT,
        password: envVars.REDIS_PASSWORD,
    },
    jwt: {
        secret: envVars.JWT_SECRET,
        accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
        refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    },
    twilio: {
        accountSid: envVars.TWILIO_ACCOUNT_SID,
        authToken: envVars.TWILIO_AUTH_TOKEN,
        fromPhone: envVars.TWILIO_WHATSAPP_FROM,
    },
    admin: {
        email: envVars.ADMIN_EMAIL,
        password: envVars.ADMIN_PASSWORD,
    },
};
