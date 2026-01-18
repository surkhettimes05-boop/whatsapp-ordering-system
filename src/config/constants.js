// Application Constants

module.exports = {
  // User Roles
  USER_ROLES: {
    ADMIN: 'ADMIN',
    WHOLESALER: 'WHOLESALER',
    RETAILER: 'RETAILER',
    SUPPORT: 'SUPPORT'
  },

  // Order Status
  ORDER_STATUS: {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    PACKED: 'PACKED',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    RETURNED: 'RETURNED'
  },

  // Payment Status
  PAYMENT_STATUS: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED'
  },

  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 500,

  // File Upload Limits
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],

  // Token Expiry
  JWT_ACCESS_TOKEN_EXPIRY: '7d',
  JWT_REFRESH_TOKEN_EXPIRY: '30d',

  // Business Rules
  MIN_ORDER_AMOUNT: 100,
  FREE_DELIVERY_THRESHOLD: 1000,
  DELIVERY_CHARGE: 50,
  TAX_RATE: 0.18, // 18% GST
  
  // Confirmation Timeout (in minutes)
  WHOLESALER_CONFIRMATION_TIMEOUT_MINUTES: 15, // 15 minutes to confirm after winning
  
  // Bidding Timeout (in minutes)
  BIDDING_TIMEOUT_MINUTES: 30, // 30 minutes for bidding window
};