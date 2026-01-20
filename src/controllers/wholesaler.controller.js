const prisma = require('../config/database');

class WholesalerController {

    // Create a new Query
    async createWholesaler(req, res) {
        try {
            const data = req.body;

            // Basic validation
            if (!data.businessName || !data.phoneNumber || !data.latitude || !data.longitude) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Format JSON fields if they are objects
            if (typeof data.categories === 'object') data.categories = JSON.stringify(data.categories);
            if (typeof data.operatingHours === 'object') data.operatingHours = JSON.stringify(data.operatingHours);

            const wholesaler = await prisma.wholesaler.create({
                data: {
                    ...data,
                    reliabilityScore: 50 // Default start
                }
            });

            res.status(201).json(wholesaler);
        } catch (error) {
            console.error('Create Wholesaler Error:', error);
            res.status(500).json({ error: 'Failed to create wholesaler', details: error.message });
        }
    }

    // Get all with filtering
    async getAllWholesalers(req, res) {
        try {
            const { city, isActive } = req.query;
            const where = {};

            if (city) where.city = city;
            if (isActive !== undefined) where.isActive = isActive === 'true';

            const wholesalers = await prisma.wholesaler.findMany({
                where,
                orderBy: { createdAt: 'desc' }
            });

            res.json(wholesalers);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch wholesalers' });
        }
    }

    // Get detailed view
    async getWholesalerById(req, res) {
        try {
            const { id } = req.params;
            const wholesaler = await prisma.wholesaler.findUnique({
                where: { id },
                include: {
                    products: {
                        include: { product: true }
                    },
                    ratings: true
                }
            });

            if (!wholesaler) return res.status(404).json({ error: 'Wholesaler not found' });
            res.json(wholesaler);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch wholesaler' });
        }
    }

    // Update
    async updateWholesaler(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;

            if (typeof data.categories === 'object') data.categories = JSON.stringify(data.categories);
            if (typeof data.operatingHours === 'object') data.operatingHours = JSON.stringify(data.operatingHours);

            const wholesaler = await prisma.wholesaler.update({
                where: { id },
                data
            });

            res.json(wholesaler);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update wholesaler' });
        }
    }

    // Delete (Soft delete preferred usually, but we'll do hard delete for now or de-activate)
    async deleteWholesaler(req, res) {
        try {
            const { id } = req.params;
            await prisma.wholesaler.delete({ where: { id } });
            res.json({ message: 'Wholesaler deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete wholesaler' });
        }
    }

    // Performance Stats
    async getPerformanceStats(req, res) {
        try {
            const { id } = req.params;

            const wholesaler = await prisma.wholesaler.findUnique({ where: { id } });
            if (!wholesaler) return res.status(404).json({ error: 'Wholesaler not found' });

            // Get recent orders stats
            const recentOrders = await prisma.order.findMany({
                where: { wholesalerId: id },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            const stats = {
                reliabilityScore: wholesaler.reliabilityScore,
                totalOrders: wholesaler.totalOrders,
                completedOrders: wholesaler.completedOrders,
                completionRate: wholesaler.totalOrders > 0 ? (wholesaler.completedOrders / wholesaler.totalOrders * 100).toFixed(1) : 0,
                averageRating: wholesaler.averageRating,
                totalRevenue: wholesaler.totalRevenue,
                recentOrdersCount: recentOrders.length
            };

            res.json(stats);

        } catch (error) {
            res.status(500).json({ error: 'Failed to get stats' });
        }
    }

    // Inventory Management
    async addProductInventory(req, res) {
        try {
            const { wholesalerId } = req.params;
            const { productId, priceOffered, stock, minOrderQuantity, leadTime } = req.body;

            const inventory = await prisma.wholesalerProduct.create({
                data: {
                    wholesalerId,
                    productId,
                    priceOffered,
                    stock: stock || 0,
                    minOrderQuantity: minOrderQuantity || 1,
                    leadTime: leadTime || 24
                }
            });

            res.status(201).json(inventory);
        } catch (error) {
            res.status(500).json({ error: 'Failed to add inventory', details: error.message });
        }
    }
}

module.exports = new WholesalerController();
