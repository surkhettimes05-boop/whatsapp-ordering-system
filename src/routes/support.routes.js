const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/admin.middleware');

router.use(authenticate);

// User routes
router.post('/tickets', supportController.createTicket);
router.get('/tickets', supportController.getUserTickets);
router.get('/tickets/:id', supportController.getTicket);
router.post('/tickets/:id/messages', supportController.addMessage);

// Admin routes
router.get('/admin/tickets', isAdmin, supportController.getAllTickets);
router.put('/tickets/:id/status', isAdmin, supportController.updateTicketStatus);
router.put('/tickets/:id/assign', isAdmin, supportController.assignTicket);

module.exports = router;

