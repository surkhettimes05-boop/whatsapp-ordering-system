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

    /**
     * Parse simple order string (e.g. "1 x 10")
     * @param {string} text 
     * @returns {Object|null} { index, quantity }
     */
    parseOrderItem(text) {
        const orderMatch = text.match(/^(\d+)\s*[xX*]\s*(\d+)$/);
        if (orderMatch) {
            return {
                index: parseInt(orderMatch[1]),
                quantity: parseInt(orderMatch[2])
            };
        }
        return null;
    }

    /**
     * Identify intent from text
     * @param {string} text 
     * @returns {string} Intent code (MENU, CATALOG, CREDIT, RECENT_ORDER, PLACE_ORDER, CONFIRM, CANCEL, UNKNOWN)
     */
    getIntent(text) {
        if (!text) return 'UNKNOWN';
        const lower = text.toLowerCase().trim();

        if (['hi', 'hello', 'start', 'menu'].includes(lower)) return 'MENU';
        if (['view catalog', '1'].includes(lower)) return 'CATALOG';
        if (['check credit', '2'].includes(lower)) return 'CREDIT';
        if (['recent orders', '3'].includes(lower)) return 'RECENT_ORDERS';
        if (['place order', 'checkout'].includes(lower)) return 'PLACE_ORDER';
        if (['yes', 'confirm', 'ok'].includes(lower)) return 'CONFIRM';
        if (['no', 'cancel'].includes(lower)) return 'CANCEL';

        return 'UNKNOWN';
    }
}

module.exports = new MessageParser();
