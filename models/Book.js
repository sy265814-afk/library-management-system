const mongoose = require('mongoose');
const { cleanText, normalizeCode } = require('../utils/validation');

const bookSchema = new mongoose.Schema({
  isbn: { type: String, trim: true, uppercase: true, default: undefined, maxlength: 40 },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  titleNormalized: { type: String, default: '', select: false },
  author: { type: String, required: true, trim: true, maxlength: 120 },
  authorNormalized: { type: String, default: '', select: false },
  category: { type: String, trim: true, default: '', maxlength: 100 },
  publisher: { type: String, trim: true, default: '', maxlength: 120 },
  totalCopies: { type: Number, required: true, min: 0, default: 1 },
  availableCopies: { type: Number, required: true, min: 0, default: 1 }
}, { timestamps: true });

bookSchema.pre('validate', function normalizeBook(next) {
  this.isbn = normalizeCode(this.isbn, 40) || undefined;
  this.title = cleanText(this.title, 180);
  this.titleNormalized = this.title.toLocaleLowerCase('en-IN');
  this.author = cleanText(this.author, 120);
  this.authorNormalized = this.author.toLocaleLowerCase('en-IN');
  this.category = cleanText(this.category, 100);
  this.publisher = cleanText(this.publisher, 120);
  next();
});

bookSchema.virtual('issuedCopies').get(function issuedCopies() {
  return Math.max(0, this.totalCopies - this.availableCopies);
});

bookSchema.index({ isbn: 1 }, { unique: true, sparse: true, name: 'isbn_1' });
bookSchema.index({ titleNormalized: 1 });
bookSchema.index({ authorNormalized: 1 });
bookSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Book || mongoose.model('Book', bookSchema);
