const Product = require('../models/productModel');

const getAllProduct = async (req, res) => {
  try {
    const products = await Product.find();
    if (products.length > 0) {
      return res.status(200).json(products);
    } else {
      return res.status(404).json({ message: 'No products found' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found with that ID' });
    }
    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

const createProduct = async (req, res) => {
  try {
    const newProduct = await Product.create(req.body);
    return res.status(201).json({
      message: 'Success, new product created',
      product: newProduct
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!product) {
      return res.status(404).json({ message: 'No product with that ID' });
    }
    return res.status(200).json({
      message: 'Product information updated',
      product: product
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'No product with that ID' });
    }
    return res.status(200).json({ message: 'Product has been deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllProduct,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};