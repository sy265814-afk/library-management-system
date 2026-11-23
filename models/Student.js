const mongoose = require('mongoose');
const { cleanText, normalizeCode } = require('../utils/validation');

const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, trim: true, uppercase: true, maxlength: 50 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  nameNormalized: { type: String, default: '', select: false },
  email: { type: String, trim: true, lowercase: true, default: undefined, maxlength: 150 },
  phone: { type: String, trim: true, default: '', maxlength: 25 },
  course: { type: String, trim: true, default: '', maxlength: 100 },
  semester: { type: String, trim: true, default: '', maxlength: 40 },
  seat: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', default: null },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });

studentSchema.pre('validate', function normalizeStudent(next) {
  this.studentId = normalizeCode(this.studentId, 50);
  this.name = cleanText(this.name, 120);
  this.nameNormalized = this.name.toLocaleLowerCase('en-IN');
  this.email = cleanText(this.email, 150).toLowerCase() || undefined;
  this.phone = cleanText(this.phone, 25);
  this.course = cleanText(this.course, 100);
  this.semester = cleanText(this.semester, 40);
  next();
});

studentSchema.index({ studentId: 1 }, { unique: true, name: 'studentId_1' });
studentSchema.index({ nameNormalized: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);
