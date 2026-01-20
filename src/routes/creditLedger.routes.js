/**
 * Credit Management Routes
 * All admin endpoints for credit control
 */

const express = require('express');
const router = express.Router();
const creditCheckService = require('../services/creditCheck.service');
const ledgerService = require('../services/ledgerEntry.service');
const { 
  requireCreditAdmin, 
  validateCreditConfig 
} = require('../middleware/creditCheck.middleware');

/**
 * GET /api/v1/credit-ledger/balance/:retailerId/:wholesalerId
 * Get current outstanding balance
 */
router.get('/balance/:retailerId/:wholesalerId', async (req, res) => {
  try {
    const { retailerId, wholesalerId } = req.params;
    const balance = await creditCheckService.getOutstandingBalance(
      retailerId,
      wholesalerId
    );

    res.json({
      success: true,
      retailerId,
      wholesalerId,
      ...balance,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/credit-ledger/check-order?retailerId=X&wholesalerId=Y&amount=Z
 * Pre-check if an order can be placed
 */
router.get('/check-order', async (req, res) => {
  try {
    const { retailerId, wholesalerId, amount } = req.query;

    if (!retailerId || !wholesalerId || !amount) {
      return res.status(400).json({
        error: 'Missing query params: retailerId, wholesalerId, amount',
      });
    }

    const check = await creditCheckService.canPlaceOrder(
      retailerId,
      wholesalerId,
      Number(amount)
    );

    res.json({
      success: true,
      ...check,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/credit-ledger/setup
 * Create or update credit limit configuration
 * REQUIRES: Admin
 */
router.post('/setup',
  requireCreditAdmin,
  validateCreditConfig,
  async (req, res) => {
    try {
      const { retailerId, wholesalerId, creditLimit, creditTerms, interestRate } = req.body;

      if (!retailerId || !wholesalerId || creditLimit === undefined) {
        return res.status(400).json({
          error: 'Missing: retailerId, wholesalerId, creditLimit',
        });
      }

      const config = await prisma.retailerWholesalerCredit.upsert({
        where: {
          retailerId_wholesalerId: {
            retailerId,
            wholesalerId,
          },
        },
        create: {
          retailerId,
          wholesalerId,
          creditLimit: Number(creditLimit),
          creditTerms: creditTerms || 30,
          interestRate: interestRate || 0,
        },
        update: {
          creditLimit: Number(creditLimit),
          creditTerms: creditTerms || 30,
          interestRate: interestRate || 0,
          isActive: true,
          blockedReason: null,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Credit limit configured',
        data: config,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/credit-ledger/payment
 * Record a payment (creates ledger CREDIT entry)
 * REQUIRES: Admin
 */
router.post('/payment',
  requireCreditAdmin,
  async (req, res) => {
    try {
      const { retailerId, wholesalerId, amount, paymentMode, chequeNumber, bankName, notes } = req.body;

      if (!retailerId || !wholesalerId || !amount || !paymentMode) {
        return res.status(400).json({
          error: 'Missing: retailerId, wholesalerId, amount, paymentMode',
        });
      }

      const result = await ledgerService.recordPayment(
        retailerId,
        wholesalerId,
        Number(amount),
        paymentMode,
        {
          chequeNumber,
          bankName,
          notes,
          approvedBy: req.user?.id || 'ADMIN',
        }
      );

      res.status(201).json({
        success: true,
        message: 'Payment recorded',
        data: result,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/credit-ledger/adjustment
 * Manual credit adjustment (ADMIN ONLY)
 * REQUIRES: Admin + Reason
 */
router.post('/adjustment',
  requireCreditAdmin,
  async (req, res) => {
    try {
      const { retailerId, wholesalerId, amount, reason, notes } = req.body;

      if (!retailerId || !wholesalerId || amount === undefined || !reason) {
        return res.status(400).json({
          error: 'Missing: retailerId, wholesalerId, amount, reason',
        });
      }

      const entry = await creditCheckService.createAdjustmentEntry(
        retailerId,
        wholesalerId,
        Number(amount),
        {
          reason,
          approvedBy: req.user?.id || 'ADMIN',
          description: notes || reason,
        }
      );

      res.status(201).json({
        success: true,
        message: 'Credit adjustment recorded',
        data: entry,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/credit-ledger/:retailerId/:wholesalerId
 * Get full ledger history (append-only transaction log)
 */
router.get('/:retailerId/:wholesalerId', async (req, res) => {
  try {
    const { retailerId, wholesalerId } = req.params;
    const { type, startDate, endDate, limit, skip } = req.query;

    const entries = await ledgerService.getLedger(
      retailerId,
      wholesalerId,
      {
        type,
        startDate,
        endDate,
        limit: limit ? Number(limit) : 100,
        skip: skip ? Number(skip) : 0,
      }
    );

    res.json({
      success: true,
      retailerId,
      wholesalerId,
      count: entries.length,
      data: entries,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/credit-ledger/report/:retailerId
 * Get comprehensive credit report across all wholesalers
 */
router.get('/report/:retailerId', async (req, res) => {
  try {
    const { retailerId } = req.params;
    const report = await creditCheckService.getCreditReport(retailerId);

    res.json({
      success: true,
      data: report,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/credit-ledger/hold
 * Place a credit hold (blocks orders)
 * REQUIRES: Admin
 */
router.post('/hold',
  requireCreditAdmin,
  async (req, res) => {
    try {
      const { retailerId, wholesalerId, reason, notes } = req.body;

      if (!retailerId || !wholesalerId || !reason) {
        return res.status(400).json({
          error: 'Missing: retailerId, wholesalerId, reason',
        });
      }

      const hold = await creditCheckService.placeCreditHold(
        retailerId,
        wholesalerId,
        reason,
        { notes }
      );

      res.status(201).json({
        success: true,
        message: 'Credit hold placed',
        data: hold,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/credit-ledger/hold/:holdId/release
 * Release a credit hold
 * REQUIRES: Admin + Reason
 */
router.post('/hold/:holdId/release',
  requireCreditAdmin,
  async (req, res) => {
    try {
      const { holdId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          error: 'Reason for release is required',
        });
      }

      const hold = await creditCheckService.releaseCreditHold(
        holdId,
        req.user?.id || 'ADMIN',
        reason
      );

      res.json({
        success: true,
        message: 'Credit hold released',
        data: hold,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/credit-ledger/clear-cheque/:paymentId
 * Clear a pending cheque payment (creates ledger entry)
 * REQUIRES: Admin
 */
router.post('/clear-cheque/:paymentId',
  requireCreditAdmin,
  async (req, res) => {
    try {
      const { paymentId } = req.params;

      const result = await ledgerService.clearPendingPayment(
        paymentId,
        req.user?.id || 'ADMIN'
      );

      res.json({
        success: true,
        message: 'Cheque cleared and credited',
        data: result,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/v1/credit-ledger/bounce-cheque/:paymentId
 * Mark a cheque as bounced
 * REQUIRES: Admin
 */
router.post('/bounce-cheque/:paymentId',
  requireCreditAdmin,
  async (req, res) => {
    try {
      const { paymentId } = req.params;

      const payment = await ledgerService.bounceCheque(
        paymentId,
        req.user?.id || 'ADMIN'
      );

      res.json({
        success: true,
        message: 'Cheque marked as bounced',
        data: payment,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/credit-ledger/pending-payments/:retailerId
 * Get all pending cheque payments
 */
router.get('/pending-payments/:retailerId', async (req, res) => {
  try {
    const { retailerId } = req.params;
    const payments = await ledgerService.getPendingPayments(retailerId);

    res.json({
      success: true,
      count: payments.length,
      data: payments,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/credit-ledger/verify/:retailerId/:wholesalerId
 * Verify ledger integrity (internal audit)
 * REQUIRES: Admin
 */
router.get('/verify/:retailerId/:wholesalerId',
  requireCreditAdmin,
  async (req, res) => {
    try {
      const { retailerId, wholesalerId } = req.params;
      const result = await ledgerService.verifyLedgerIntegrity(
        retailerId,
        wholesalerId
      );

      res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;
