/**
 * Order Parser Service
 * Parses natural language order strings into structured data
 */

class OrderParser {
    constructor() {
        // Common units for normalization
        this.units = ['kg', 'g', 'gm', 'gram', 'l', 'ml', 'liter', 'litre', 'pkt', 'packet', 'pcs', 'piece', 'box', 'carton', 'dozen'];
    }

    /**
     * Parse a single line order
     * Examples: "10 kg rice", "2 packet oil", "5 sugar"
     * @param {string} text 
     * @returns {Object|null} { quantity, unit, product }
     */
    parse(text) {
        if (!text) return null;

        // Clean text
        const cleanText = text.trim().toLowerCase();

        // Regex strategies

        // Strategy 1: [Quantity] [Unit] [Product]
        // Matches: "10 kg rice", "2.5 l oil"
        const standardRegex = /^(\d+(?:\.\d+)?)\s*([a-z]+)\s+(.+)$/;
        const match1 = cleanText.match(standardRegex);

        if (match1) {
            // meaningful check if group 2 is actually a unit
            const possibleUnit = match1[2];
            if (this.units.includes(possibleUnit) || this.units.some(u => possibleUnit.startsWith(u))) {
                return {
                    quantity: parseFloat(match1[1]),
                    unit: this.normalizeUnit(possibleUnit),
                    product: match1[3].trim()
                };
            }
        }

        // Strategy 2: [Quantity] [Product] (Implicit Unit)
        // Matches: "10 soap", "2 bread"
        const quantityOnlyRegex = /^(\d+(?:\.\d+)?)\s+(.+)$/;
        const match2 = cleanText.match(quantityOnlyRegex);

        if (match2) {
            return {
                quantity: parseFloat(match2[1]),
                unit: 'pcs', // Default to pieces/units if unspecified
                product: match2[2].trim()
            };
        }

        // Failed to parse
        return null;
    }

    /**
     * Parse multiple lines
     */
    parseBatch(text) {
        const lines = text.split(/\r?\n/);
        const results = [];
        const errors = [];

        lines.forEach(line => {
            if (!line.trim()) return;

            const parsed = this.parse(line);
            if (parsed) {
                results.push(parsed);
            } else {
                errors.push(line);
            }
        });

        return { results, errors };
    }

    /**
     * Normalize unit names
     */
    normalizeUnit(unit) {
        if (['kg', 'kilo', 'kilogram'].includes(unit)) return 'kg';
        if (['g', 'gm', 'gram'].includes(unit)) return 'g';
        if (['l', 'ltr', 'liter', 'litre'].includes(unit)) return 'l';
        if (['ml'].includes(unit)) return 'ml';
        if (['pkt', 'packet', 'pack'].includes(unit)) return 'packet';
        if (['pcs', 'pc', 'piece', 'pieces'].includes(unit)) return 'pcs';
        return unit;
    }
}

module.exports = new OrderParser();
