const supportService = require('../services/support.service');
const { validationResult } = require('express-validator');

class SupportController {
  /**
   * Create support ticket
   */
  async createTicket(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const ticket = await supportService.createTicket(req.user.id, req.body);

      res.status(201).json({
        success: true,
        message: 'Support ticket created',
        data: { ticket }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicket(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.role === 'ADMIN' ? null : req.user.id;
      const ticket = await supportService.getTicketById(id, userId);

      res.json({
        success: true,
        data: { ticket }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get user's tickets
   */
  async getUserTickets(req, res) {
    try {
      const result = await supportService.getUserTickets(req.user.id, req.query);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all tickets (Admin)
   */
  async getAllTickets(req, res) {
    try {
      const result = await supportService.getAllTickets(req.query);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Add message to ticket
   */
  async addMessage(req, res) {
    try {
      const { id } = req.params;
      const { message, isInternal = false } = req.body;

      const supportMessage = await supportService.addMessage(
        id,
        req.user.id,
        message,
        req.user.role === 'ADMIN' || req.user.role === 'SUPPORT' ? 'SUPPORT' : 'USER',
        isInternal
      );

      res.json({
        success: true,
        message: 'Message added',
        data: { message: supportMessage }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, resolution } = req.body;

      const ticket = await supportService.updateTicketStatus(id, status, req.user.id, resolution);

      res.json({
        success: true,
        message: 'Ticket status updated',
        data: { ticket }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Assign ticket
   */
  async assignTicket(req, res) {
    try {
      const { id } = req.params;
      const { agentId } = req.body;

      const ticket = await supportService.assignTicket(id, agentId || req.user.id);

      res.json({
        success: true,
        message: 'Ticket assigned',
        data: { ticket }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new SupportController();

