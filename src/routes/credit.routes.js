/**
 * Credit System Routes
 */

const express = require('express');
const router = express.Router();
const creditController = require('../controllers/credit.controller');
const { enforceCreditLimit } = require('../middleware/creditLimit.middleware');
// const { authenticate, authorize } = require('../middleware/auth.middleware'); // Uncomment when auth is ready

// Balance queries
router.get('/balance/:retailerId/:wholesalerId', creditController.getBalance);
router.get('/account/:retailerId/:wholesalerId', creditController.getCreditAccount);

// Credit limit checks
router.post('/check-limit', creditController.checkLimit);
router.post('/check-limit-middleware', enforceCreditLimit, (req, res) => {
    res.json({
        success: true,
        message: 'Credit limit check passed',
        creditCheck: req.creditCheck
    });
});

// Exposure reports
router.get('/exposure/:wholesalerId', creditController.getExposureReport);

// Ledger entry management (admin only)
// router.post('/ledger-entry', authenticate, authorize(['ADMIN']), creditController.createLedgerEntry);
router.post('/ledger-entry', creditController.createLedgerEntry);

// Credit account management (admin only)
// router.put('/account/:retailerId/:wholesalerId', authenticate, authorize(['ADMIN']), creditController.updateCreditAccount);
router.put('/account/:retailerId/:wholesalerId', creditController.updateCreditAccount);

module.exports = router;
