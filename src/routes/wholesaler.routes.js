const express = require('express');
const router = express.Router();
const wholesalerController = require('../controllers/wholesaler.controller');
const { authenticate, isAdmin } = require('../middleware/auth.middleware');

// Apply auth middleware to all routes - Wholesaler management is strictly Admin
router.use(authenticate, isAdmin);

// Wholesaler Management
router.post('/', wholesalerController.createWholesaler);
router.get('/', wholesalerController.getAllWholesalers);
router.get('/:id', wholesalerController.getWholesalerById);
router.put('/:id', wholesalerController.updateWholesaler);
router.delete('/:id', wholesalerController.deleteWholesaler);

// Specific Features
router.get('/:id/performance', wholesalerController.getPerformanceStats);
router.post('/:wholesalerId/products', wholesalerController.addProductInventory);

module.exports = router;
