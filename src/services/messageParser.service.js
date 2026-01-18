/**
 * WhatsApp Message Parser Service
 * Handles parsing of structured messages from wholesalers
 */

class MessageParser {
    /**
     * Parse a vendor bid message in format: PRICE <number> ETA <text>
     * @param {string} message - The raw message text
     * @returns {object|null} - Parsed data or null if invalid
     */
    parseVendorBid(message) {
        if (!message || typeof message !== 'string') {
            return null;
        }

        // Regex to match: PRICE <number> ETA <text>
        // Supports: PRICE 2450 ETA 2H, price 2450.50 eta 2 hours, etc.
        const bidRegex = /PRICE\s+([\d.]+)\s+ETA\s+(.+)/i;
        const match = message.trim().match(bidRegex);

        if (!match) {
            return null;
        }

        const priceStr = match[1];
        const eta = match[2].trim();

        // Validate price is a valid number
        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 0) {
            return null;
        }

        // Validate ETA is not empty
        if (!eta || eta.length === 0) {
            return null;
        }

        return {
            price,
            eta,
            raw: message
        };
    }

    /**
     * Check if a message matches the vendor bid format
     * @param {string} message
     * @returns {boolean}
     */
    isVendorBid(message) {
        return this.parseVendorBid(message) !== null;
    }
}

module.exports = new MessageParser();
