const axios = require('axios');
const prisma = require('../config/database');
const { logger } = require('../config/logger');

class VisionService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.model = "gpt-4o-mini"; // Efficient and good with vision
    }

    /**
     * Process an image URL from WhatsApp to extract order items
     * @param {string} imageUrl - The URL of the image from Twilio
     * @returns {Promise<Array>} - List of extracted items {productName, quantity}
     */
    async extractOrderFromImage(imageUrl) {
        if (!this.apiKey) {
            logger.warn('OPENAI_API_KEY not found. Vision processing skipped.');
            return {
                success: false,
                error: 'Vision API key not configured'
            };
        }

        try {
            // 1. Get all active products from DB to help the AI match names
            const products = await prisma.product.findMany({
                where: { isActive: true },
                select: { name: true, id: true }
            });

            const productNames = products.map(p => p.name).join(', ');

            // 2. Call OpenAI Vision API
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: this.model,
                    messages: [
                        {
                            role: "system",
                            content: `You are an expert order processing assistant for a B2B trade platform in Nepal. 
                            Your task is to read images of handwritten or printed order lists (often titled 'Saman Ko List' or similar).
                            
                            Available products in our catalog: [${productNames}]
                            
                            Return ONLY a JSON array of objects with 'productName' and 'quantity'. 
                            If a product name in the image is slightly different or in Nepali, map it to the closest catalog name provided.
                            Example Format: [{"productName": "Sugar", "quantity": 10}, {"productName": "Cooking Oil", "quantity": 5}]`
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Please extract the items and quantities from this order list image." },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: imageUrl
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0].message.content;
            // Clean up Markdown formatting if any
            const jsonString = content.replace(/```json|```/g, '').trim();
            const extractedItems = JSON.parse(jsonString);

            // 3. Match extracted items to database IDs
            const mappedItems = [];
            for (const item of extractedItems) {
                const product = products.find(p =>
                    p.name.toLowerCase() === item.productName.toLowerCase() ||
                    p.name.toLowerCase().includes(item.productName.toLowerCase())
                );

                if (product) {
                    mappedItems.push({
                        productId: product.id,
                        name: product.name,
                        quantity: item.quantity
                    });
                }
            }

            return {
                success: true,
                items: mappedItems,
                rawResponse: extractedItems
            };

        } catch (error) {
            logger.error('Vision processing error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new VisionService();
