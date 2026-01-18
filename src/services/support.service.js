const prisma = require('../config/database');

class SupportService {
  /**
   * Generate unique ticket number
   */
  generateTicketNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `TKT${timestamp}${random}`;
  }

  /**
   * Create support ticket
   */
  async createTicket(userId, ticketData) {
    const ticketNumber = this.generateTicketNumber();

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId,
        subject: ticketData.subject,
        description: ticketData.description,
        category: ticketData.category || 'OTHER',
        priority: ticketData.priority || 'MEDIUM',
        orderId: ticketData.orderId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      }
    });

    // Create initial message
    if (ticketData.description) {
      await this.addMessage(ticket.id, userId, ticketData.description, 'USER');
    }

    return ticket;
  }

  /**
   * Add message to ticket
   */
  async addMessage(ticketId, senderId, message, senderType = 'USER', isInternal = false) {
    const supportMessage = await prisma.supportMessage.create({
      data: {
        ticketId,
        senderId,
        senderType,
        message,
        isInternal
      },
      include: {
        ticket: true
      }
    });

    // Update ticket updatedAt
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    });

    return supportMessage;
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId, userId = null) {
    const where = { id: ticketId };

    // If not admin, ensure user can only see their own tickets
    if (userId) {
      where.userId = userId;
    }

    const ticket = await prisma.supportTicket.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true
          }
        },
        messages: {
          where: {
            OR: [
              { isInternal: false },
              { senderId: userId } // Allow internal messages if user is sender
            ]
          },
          orderBy: { createdAt: 'asc' },
          include: {
            attachments: true
          }
        },
        attachments: true
      }
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    return ticket;
  }

  /**
   * Get user's tickets
   */
  async getUserTickets(userId, filters = {}) {
    const { page = 1, limit = 50, status, category } = filters;
    const skip = (page - 1) * limit;

    const where = { userId };
    if (status) where.status = status;
    if (category) where.category = category;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    return {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get all tickets (Admin)
   */
  async getAllTickets(filters = {}) {
    const { page = 1, limit = 50, status, category, priority, assignedTo } = filters;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true
            }
          },
          order: {
            select: {
              id: true,
              orderNumber: true
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    return {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(ticketId, status, adminId, resolution = null) {
    const updateData = {
      status
    };

    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedBy = adminId;
      updateData.resolvedAt = new Date();
      if (resolution) {
        updateData.resolution = resolution;
      }
    }

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        user: true
      }
    });

    return ticket;
  }

  /**
   * Assign ticket to support agent
   */
  async assignTicket(ticketId, agentId) {
    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedTo: agentId,
        status: 'IN_PROGRESS'
      }
    });

    // Add internal note
    await this.addMessage(
      ticketId,
      agentId,
      `Ticket assigned to support agent`,
      'SUPPORT',
      true
    );

    return ticket;
  }

  /**
   * Add attachment to ticket or message
   */
  async addAttachment(ticketId, messageId, fileData) {
    const attachment = await prisma.supportAttachment.create({
      data: {
        ticketId: ticketId || null,
        messageId: messageId || null,
        fileName: fileData.fileName,
        fileUrl: fileData.fileUrl,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize
      }
    });

    return attachment;
  }
}

module.exports = new SupportService();

