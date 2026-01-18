const prisma = require('../config/database');

class DeliveryService {
  /**
   * Create delivery for an order
   */
  async createDelivery(orderId, deliveryData = {}) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        deliveryAddress: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Generate tracking number
    const trackingNumber = this.generateTrackingNumber();

    const delivery = await prisma.delivery.create({
      data: {
        orderId,
        trackingNumber,
        status: 'PENDING',
        carrier: deliveryData.carrier,
        estimatedDate: deliveryData.estimatedDate,
        ...deliveryData
      },
      include: {
        order: {
          include: {
            user: true,
            deliveryAddress: true
          }
        }
      }
    });

    // Create initial status update
    await this.addDeliveryUpdate(delivery.id, 'PENDING', 'Delivery created');

    return delivery;
  }

  /**
   * Generate unique tracking number
   */
  generateTrackingNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `TRK${timestamp}${random}`;
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(deliveryId, status, updateData = {}) {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId }
    });

    if (!delivery) {
      throw new Error('Delivery not found');
    }

    const updateFields = {
      status,
      ...updateData
    };

    if (status === 'DELIVERED') {
      updateFields.actualDate = new Date();
    }

    const updatedDelivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: updateFields,
      include: {
        order: {
          include: {
            user: true
          }
        },
        history: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Add status update to history
    await this.addDeliveryUpdate(
      deliveryId,
      status,
      updateData.notes || `Status updated to ${status}`,
      updateData.updatedBy
    );

    // Update order status if delivery is completed
    if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: {
          status: 'DELIVERED',
          deliveryDate: new Date()
        }
      });
    }

    return updatedDelivery;
  }

  /**
   * Add delivery update to history
   */
  async addDeliveryUpdate(deliveryId, status, notes, updatedBy = 'SYSTEM') {
    const update = await prisma.deliveryUpdate.create({
      data: {
        deliveryId,
        status,
        notes,
        updatedBy
      }
    });

    return update;
  }

  /**
   * Get delivery by tracking number
   */
  async getDeliveryByTracking(trackingNumber) {
    const delivery = await prisma.delivery.findUnique({
      where: { trackingNumber },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phoneNumber: true
              }
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    thumbnailUrl: true
                  }
                }
              }
            },
            deliveryAddress: true
          }
        },
        history: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!delivery) {
      throw new Error('Delivery not found');
    }

    return delivery;
  }

  /**
   * Get delivery by order ID
   */
  async getDeliveryByOrder(orderId) {
    const delivery = await prisma.delivery.findUnique({
      where: { orderId },
      include: {
        history: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return delivery;
  }

  /**
   * Get all deliveries
   */
  async getAllDeliveries(filters = {}) {
    const { page = 1, limit = 50, status, carrier } = filters;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (carrier) where.carrier = carrier;

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phoneNumber: true
                }
              }
            }
          }
        }
      }),
      prisma.delivery.count({ where })
    ]);

    return {
      deliveries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update delivery location
   */
  async updateLocation(deliveryId, locationData) {
    const delivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        currentLocation: locationData.location,
        latitude: locationData.latitude,
        longitude: locationData.longitude
      }
    });

    // Add location update to history
    await this.addDeliveryUpdate(
      deliveryId,
      delivery.status,
      `Location updated: ${locationData.location}`,
      locationData.updatedBy
    );

    return delivery;
  }

  /**
   * Assign delivery agent
   */
  async assignAgent(deliveryId, agentData) {
    const delivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        agentName: agentData.name,
        agentPhone: agentData.phone,
        vehicleNumber: agentData.vehicleNumber,
        status: 'ASSIGNED'
      }
    });

    await this.addDeliveryUpdate(
      deliveryId,
      'ASSIGNED',
      `Assigned to ${agentData.name} (${agentData.phone})`,
      agentData.updatedBy
    );

    return delivery;
  }
}

module.exports = new DeliveryService();

