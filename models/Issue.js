const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  issuedAt: { type: Date, default: Date.now },
  dueAt: { type: Date, required: true },
  returnedAt: { type: Date, default: null },
  status: { type: String, enum: ['ISSUED', 'RETURNED'], default: 'ISSUED', index: true }
}, { timestamps: true });


issueSchema.index(
  { student: 1, book: 1 },
  { unique: true, partialFilterExpression: { status: 'ISSUED' }, name: 'active_student_book_unique' }
);
issueSchema.index({ createdAt: -1 });
issueSchema.index({ dueAt: 1, status: 1 });

module.exports = mongoose.models.Issue || mongoose.model('Issue', issueSchema);
