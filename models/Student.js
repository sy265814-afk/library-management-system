const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  course: {
    type: String,
    trim: true
  },
  semester: {
    type: String,
    trim: true
  },
  seat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seat',
    default: null
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
