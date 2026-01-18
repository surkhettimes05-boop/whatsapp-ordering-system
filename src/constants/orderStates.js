/**
 * ORDER STATE MACHINE - Enum & Constants
 * 
 * Defines all valid order states and their properties
 */

const ORDER_STATES = {
  CREATED: 'CREATED',
  CREDIT_APPROVED: 'CREDIT_APPROVED',
  STOCK_RESERVED: 'STOCK_RESERVED',
  WHOLESALER_ACCEPTED: 'WHOLESALER_ACCEPTED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

/**
 * STATE TRANSITION RULES
 * Defines which states can transition to which other states
 */
const VALID_TRANSITIONS = {
  [ORDER_STATES.CREATED]: [
    ORDER_STATES.CREDIT_APPROVED,
    ORDER_STATES.FAILED,
    ORDER_STATES.CANCELLED
  ],
  [ORDER_STATES.CREDIT_APPROVED]: [
    ORDER_STATES.STOCK_RESERVED,
    ORDER_STATES.FAILED,
    ORDER_STATES.CANCELLED
  ],
  [ORDER_STATES.STOCK_RESERVED]: [
    ORDER_STATES.WHOLESALER_ACCEPTED,
    ORDER_STATES.FAILED,
    ORDER_STATES.CANCELLED
  ],
  [ORDER_STATES.WHOLESALER_ACCEPTED]: [
    ORDER_STATES.OUT_FOR_DELIVERY,
    ORDER_STATES.FAILED,
    ORDER_STATES.CANCELLED
  ],
  [ORDER_STATES.OUT_FOR_DELIVERY]: [
    ORDER_STATES.DELIVERED,
    ORDER_STATES.FAILED,
    ORDER_STATES.CANCELLED
  ],
  [ORDER_STATES.DELIVERED]: [
    // Terminal state - no transitions
  ],
  [ORDER_STATES.FAILED]: [
    ORDER_STATES.CANCELLED // Can cancel a failed order
  ],
  [ORDER_STATES.CANCELLED]: [
    // Terminal state - no transitions
  ]
};

/**
 * STATE DESCRIPTIONS
 * User-friendly descriptions for each state
 */
const STATE_DESCRIPTIONS = {
  [ORDER_STATES.CREATED]: 'Order created, awaiting credit approval',
  [ORDER_STATES.CREDIT_APPROVED]: 'Credit approved, awaiting stock reservation',
  [ORDER_STATES.STOCK_RESERVED]: 'Stock reserved, awaiting wholesaler acceptance',
  [ORDER_STATES.WHOLESALER_ACCEPTED]: 'Wholesaler accepted, out for delivery',
  [ORDER_STATES.OUT_FOR_DELIVERY]: 'Order is out for delivery',
  [ORDER_STATES.DELIVERED]: 'Order successfully delivered',
  [ORDER_STATES.FAILED]: 'Order failed to deliver',
  [ORDER_STATES.CANCELLED]: 'Order was cancelled'
};

/**
 * BUSINESS LOGIC TRIGGERS PER STATE
 * What business logic should execute when entering each state
 */
const STATE_TRIGGERS = {
  [ORDER_STATES.CREATED]: ['validateOrder', 'assignWholesaler'],
  [ORDER_STATES.CREDIT_APPROVED]: ['checkCredit', 'holdCredit'],
  [ORDER_STATES.STOCK_RESERVED]: ['reserveStock', 'notifyWholesaler'],
  [ORDER_STATES.WHOLESALER_ACCEPTED]: ['confirmDelivery', 'notifyRetailer'],
  [ORDER_STATES.OUT_FOR_DELIVERY]: ['updateInventory', 'trackShipment'],
  [ORDER_STATES.DELIVERED]: ['deductCredit', 'finalizeOrder', 'enableRating'],
  [ORDER_STATES.FAILED]: ['releaseCredit', 'releaseStock', 'notifyRetailer'],
  [ORDER_STATES.CANCELLED]: ['releaseCredit', 'releaseStock', 'notifyWholesaler']
};

/**
 * TERMINAL STATES
 * States where order lifecycle cannot proceed further
 */
const TERMINAL_STATES = [
  ORDER_STATES.DELIVERED,
  ORDER_STATES.CANCELLED
];

/**
 * FAILURE STATES
 * States considered as order failure
 */
const FAILURE_STATES = [
  ORDER_STATES.FAILED,
  ORDER_STATES.CANCELLED
];

module.exports = {
  ORDER_STATES,
  VALID_TRANSITIONS,
  STATE_DESCRIPTIONS,
  STATE_TRIGGERS,
  TERMINAL_STATES,
  FAILURE_STATES
};
