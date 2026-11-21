const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  isbn: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  publisher: {
    type: String,
    trim: true
  },
  totalCopies: {
    type: Number,
    required: true,
    min: 0,
    default: 1
  },
  availableCopies: {
    type: Number,
    required: true,
    min: 0,
    default: 1
  }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);
