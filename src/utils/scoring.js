/**
 * Simple scoring engine for vendor offers.
 * Higher score = better offer.
 */
function parseEtaToHours(eta) {
  if (!eta) return 48;
  const s = eta.toString().toLowerCase();
  if (s.includes('h')) {
    const m = s.match(/(\d+)/);
    return m ? Number(m[1]) : 24;
  }
  if (s.includes('day') || s.includes('d')) {
    const m = s.match(/(\d+)/);
    return m ? Number(m[1]) * 24 : 48;
  }
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : 48;
}

function scoreOffer(offer) {
  // offer: { price_quote, delivery_eta, stock_confirmed, wholesaler: { reliabilityScore, averageRating } }
  let score = 0;

  // Stock confirmed is high priority
  if (offer.stock_confirmed) score += 2000;

  // Price lower better: normalize by inverse (assume reasonable price range)
  const price = Number(offer.price_quote || 0);
  const priceScore = Math.max(0, 1000 - price); // simpler: lower price gives higher score
  score += priceScore;

  // ETA: shorter is better
  const hours = parseEtaToHours(offer.delivery_eta);
  const etaScore = Math.max(0, 500 - hours * 5);
  score += etaScore;

  // Wholesaler reliability and rating
  const reliability = (offer.wholesaler?.reliabilityScore || 50);
  const rating = (offer.wholesaler?.averageRating || 0) * 20; // scale 0-100
  score += reliability + rating;

  return score;
}

module.exports = {
  scoreOffer,
  parseEtaToHours
};
