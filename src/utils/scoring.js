/**
 * Vendor Offer Scoring Engine
 * 
 * Centralized logic for evaluating and ranking vendor bids
 * Used by both bidding.service.js and orderDecision.service.js
 */

/**
 * Score an offer based on multiple weighted criteria
 * @param {object} offer - VendorOffer with wholesaler data
 * @returns {number} - Composite score (higher is better)
 */
function scoreOffer(offer) {
  let score = 0;

  // 1. Stock Confirmed (highest priority) - 1000 points
  // If vendor confirms stock availability, massive boost
  if (offer.stockConfirmed || offer.stock_confirmed) {
    score += 1000;
  }

  // 2. Price (lower is better) - normalize to 0-500 points
  // Assuming max reasonable price is 100000, invert for scoring
  const priceQuote = Number(offer.priceQuote || offer.price_quote || 0);
  const priceScore = Math.max(0, 500 - (priceQuote / 200));
  score += priceScore;

  // 3. ETA (shorter is better) - 0-300 points
  // Parse ETA string (e.g., "2H", "3 hours", "1D")
  const eta = offer.deliveryEta || offer.delivery_eta;
  const etaScore = parseAndScoreETA(eta);
  score += etaScore;

  // 4. Wholesaler Trust Score - 0-200 points
  // Based on reliability score (0-100) and average rating (0-5)
  if (offer.wholesaler) {
    const reliabilityScore = (offer.wholesaler.reliabilityScore || 50) * 1.5; // 0-150
    const ratingScore = (offer.wholesaler.averageRating || 0) * 10; // 0-50
    score += reliabilityScore + ratingScore;
  }

  return Math.round(score);
}

/**
 * Parse ETA string and convert to score
 * @param {string} eta - ETA string like "2H", "3 hours", "1D"
 * @returns {number} - Score (0-300, higher is better/shorter)
 */
function parseAndScoreETA(eta) {
  if (!eta) return 0;

  const etaLower = eta.toLowerCase();
  let hours = 0;

  // Parse common formats
  if (etaLower.includes('h')) {
    const match = etaLower.match(/(\d+)\s*h/);
    hours = match ? parseInt(match[1]) : 24;
  } else if (etaLower.includes('day') || etaLower.includes('d')) {
    const match = etaLower.match(/(\d+)\s*(day|d)/);
    hours = match ? parseInt(match[1]) * 24 : 24;
  } else if (etaLower.includes('min')) {
    const match = etaLower.match(/(\d+)\s*min/);
    hours = match ? parseInt(match[1]) / 60 : 1;
  } else {
    // Try to extract any number
    const match = etaLower.match(/(\d+)/);
    hours = match ? parseInt(match[1]) : 24;
  }

  // Score: 300 points for immediate, decreasing with time
  // Max 72 hours (3 days) considered
  const maxHours = 72;
  const normalizedHours = Math.min(hours, maxHours);
  return Math.max(0, 300 - (normalizedHours * 4));
}

/**
 * Comparator function for sorting offers by score (descending)
 * @param {object} a - { offer, score }
 * @param {object} b - { offer, score }
 * @returns {number} - Comparison result
 */
function compareOffers(a, b) {
  // Primary: Score (descending)
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  // Tiebreaker 1: Stock confirmed
  const aStock = a.offer.stockConfirmed || a.offer.stock_confirmed || false;
  const bStock = b.offer.stockConfirmed || b.offer.stock_confirmed || false;
  if (aStock !== bStock) {
    return bStock ? 1 : -1;
  }

  // Tiebreaker 2: Lower price
  const aPrice = Number(a.offer.priceQuote || a.offer.price_quote || Infinity);
  const bPrice = Number(b.offer.priceQuote || b.offer.price_quote || Infinity);
  if (aPrice !== bPrice) {
    return aPrice - bPrice;
  }

  // Tiebreaker 3: Earlier submission (createdAt)
  const aTime = new Date(a.offer.createdAt).getTime();
  const bTime = new Date(b.offer.createdAt).getTime();
  return aTime - bTime;
}

/**
 * Score multiple offers and return sorted results
 * @param {Array} offers - Array of VendorOffer objects
 * @returns {Array} - Array of { offer, score } sorted by score descending
 */
function scoreAndRankOffers(offers) {
  const scored = offers.map(offer => ({
    offer,
    score: scoreOffer(offer)
  }));

  scored.sort(compareOffers);
  return scored;
}

module.exports = {
  scoreOffer,
  parseAndScoreETA,
  compareOffers,
  scoreAndRankOffers
};
