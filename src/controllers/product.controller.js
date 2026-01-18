const { validationResult } = require('express-validator');
const productService = require('../services/product.service');

class ProductController {
  async createProduct(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const product = await productService.createProduct(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: { product }
      });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  async getAllProducts(req, res) {
    try {
      const result = await productService.getProducts(req.query);
      
      res.json({
        success: true,
        data: result.products,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  async getProductById(req, res) {
    try {
      const product = await productService.getProductById(req.params.id);
      
      res.json({
        success: true,
        data: { product }
      });
    } catch (error) {
      console.error('Get product error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }
  
  async updateProduct(req, res) {
    try {
      const product = await productService.updateProduct(
        req.params.id,
        req.body
      );
      
      res.json({
        success: true,
        message: 'Product updated successfully',
        data: { product }
      });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
  
  async deleteProduct(req, res) {
    try {
      const result = await productService.deleteProduct(req.params.id);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }
  
  async updateStock(req, res) {
    try {
      const { quantity, operation } = req.body;
      
      if (!quantity) {
        return res.status(400).json({
          success: false,
          error: 'Quantity is required'
        });
      }
      
      const product = await productService.updateStock(
        req.params.id,
        parseInt(quantity),
        operation
      );
      
      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: { product }
      });
    } catch (error) {
      console.error('Update stock error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ProductController();