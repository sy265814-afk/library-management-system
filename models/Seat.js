const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  seatNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  floor: {
    type: String,
    trim: true,
    default: 'Ground Floor'
  },
  section: {
    type: String,
    trim: true,
    default: 'General'
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'],
    default: 'AVAILABLE'
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Seat', seatSchema);
