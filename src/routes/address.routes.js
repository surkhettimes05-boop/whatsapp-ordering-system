const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const prisma = require('../config/database');

router.use(authenticate);

// Get all addresses
router.get('/', async (req, res) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { addresses }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create address
router.post('/', async (req, res) => {
  try {
    const addressData = req.body;

    // If this is set as default, unset other defaults
    if (addressData.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user.id, isDefault: true },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        ...addressData,
        userId: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      message: 'Address created',
      data: { address }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update address
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const addressData = req.body;

    // Check if address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: 'Address not found'
      });
    }

    // If setting as default, unset other defaults
    if (addressData.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user.id, isDefault: true },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.update({
      where: { id },
      data: addressData
    });

    res.json({
      success: true,
      message: 'Address updated',
      data: { address }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete address
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const address = await prisma.address.findFirst({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        error: 'Address not found'
      });
    }

    await prisma.address.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Address deleted'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

