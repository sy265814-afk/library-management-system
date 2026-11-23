const mongoose = require('mongoose');
const { cleanText, normalizeCode } = require('../utils/validation');

const seatSchema = new mongoose.Schema({
  seatNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  floor: { type: String, trim: true, default: 'Ground Floor', maxlength: 80 },
  section: { type: String, trim: true, default: 'General', maxlength: 80 },
  status: { type: String, enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'], default: 'AVAILABLE' },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null }
}, { timestamps: true });

seatSchema.pre('validate', function normalizeSeat(next) {
  this.seatNumber = normalizeCode(this.seatNumber, 40);
  this.floor = cleanText(this.floor, 80) || 'Ground Floor';
  this.section = cleanText(this.section, 80) || 'General';
  next();
});

seatSchema.index({ seatNumber: 1 }, { unique: true, name: 'seatNumber_1' });
seatSchema.index({ status: 1, seatNumber: 1 });
seatSchema.index({ student: 1 }, { unique: true, partialFilterExpression: { student: { $type: 'objectId' } }, name: 'one_seat_per_student' });

module.exports = mongoose.models.Seat || mongoose.model('Seat', seatSchema);
