'use strict';

// Pure review calculation. Persistence and customer approval are separate steps.
const Decimal = require('decimal.js');
function reviewBasket(items, decisions, deliveryFee = 0) {
  if (!Array.isArray(items) || !items.length || !Array.isArray(decisions) || decisions.length !== items.length) throw new Error('Review every order line');
  const byId = new Map();
  for (const decision of decisions) {
    if (!decision || typeof decision.id !== 'string' || byId.has(decision.id) || !Number.isSafeInteger(decision.quantity) || decision.quantity < 0) throw new Error('Invalid availability decision');
    byId.set(decision.id, decision.quantity);
  }
  let subtotal = new Decimal(0);
  let changed = false;
  const lines = items.map(item => {
    const quantity = byId.get(item.id);
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || quantity === undefined || quantity > item.quantity) throw new Error('Invalid reviewed quantity');
    byId.delete(item.id);
    const price = new Decimal(String(item.priceAtOrder));
    if (!price.isFinite() || price.isNegative() || price.decimalPlaces() > 2) throw new Error('Invalid order price');
    subtotal = subtotal.plus(price.times(quantity));
    changed ||= quantity !== item.quantity;
    return { id: item.id, requestedQuantity: item.quantity, quantity, unitPrice: price.toFixed(2) };
  });
  if (byId.size) throw new Error('Unknown order line');
  const fee = new Decimal(String(deliveryFee));
  if (!fee.isFinite() || fee.isNegative() || fee.decimalPlaces() > 2) throw new Error('Invalid delivery fee');
  const rejected = lines.every(line => line.quantity === 0);
  return { lines, outcome: rejected ? 'REJECTED' : changed ? 'CUSTOMER_APPROVAL_REQUIRED' : 'CONFIRMABLE', subtotal: subtotal.toFixed(2), total: rejected ? '0.00' : subtotal.plus(fee).toFixed(2) };
}
module.exports = { reviewBasket };
