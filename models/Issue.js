const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  dueAt: {
    type: Date,
    required: true
  },
  returnedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['ISSUED', 'RETURNED'],
    default: 'ISSUED'
  }
}, { timestamps: true });

module.exports = mongoose.model('Issue', issueSchema);
