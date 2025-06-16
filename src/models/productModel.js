const mongoose = require('mongoose');

// Define the product schema
const productSchema = new mongoose.Schema({
  name: { // Renamed from 'product' to 'name'
    type: String,
    required: true
  },
  price: {
    type: Number, // Changed to Number for appropriate data type
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  stock: {
    type: Number,
    required: true,
    default: 0 // Added default value for stock
  },
  images: [String], // Array of strings for image URLs
  rating: {
    type: Number,
    default: 0 // Default rating value
  },
  reviews: [
    {
      user: String,
      rating: Number,
      comment: String
    }
  ],
  brand: {
    type: String,
    required: true
  },
  dimensions: {
    height: Number,
    width: Number,
    depth: Number
  },
  weight: Number,
  createdAt: {
    type: Date,
    default: Date.now // Automatically set the creation date
  },
  updatedAt: {
    type: Date,
    default: Date.now // Automatically set the update date
  }
}, {
  timestamps: true // Automatically manage createdAt and updatedAt
});

// Create the Product model
const Product = mongoose.model('Product', productSchema);

// Export the Product model
module.exports = Product;