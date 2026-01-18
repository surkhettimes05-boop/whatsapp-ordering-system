const express = require('express');
const router = express.Router();
const wholesalerController = require('../controllers/wholesaler.controller');
// const authMiddleware = require('../middleware/auth.middleware'); // Assuming you have admin auth

// Apply auth middleware to all routes if needed
// router.use(authMiddleware.verifyToken); 
// router.use(authMiddleware.isAdmin);

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
