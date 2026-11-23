const Seat = require('../models/Seat');
const Student = require('../models/Student');
const { cleanText, normalizeCode, escapeRegex, getPagination, buildPagination, isValidObjectId } = require('../utils/validation');
const { duplicateMessage, isDuplicateKey } = require('../utils/duplicateKey');

exports.index = async (req, res, next) => {
  try {
    const q = cleanText(req.query.q, 60);
    const status = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'].includes(req.query.status) ? req.query.status : '';
    const pageData = getPagination(req.query);
    const filter = {};
    if (q) filter.seatNumber = new RegExp(`^${escapeRegex(normalizeCode(q, 60))}`);
    if (status) filter.status = status;

    const [seats, total, available, occupied, maintenance] = await Promise.all([
      Seat.find(filter).populate('student', 'name studentId').sort({ seatNumber: 1 }).skip(pageData.skip).limit(pageData.limit).lean(),
      Seat.countDocuments(filter),
      Seat.countDocuments({ status: 'AVAILABLE' }),
      Seat.countDocuments({ status: 'OCCUPIED' }),
      Seat.countDocuments({ status: 'MAINTENANCE' })
    ]);

    res.render('seats/index', {
      title: 'Seats', seats, search: q, status,
      seatStats: { available, occupied, maintenance },
      pagination: buildPagination(total, pageData.page, pageData.limit, { q, status })
    });
  } catch (error) { next(error); }
};

exports.newForm = (req, res) => res.render('seats/form', { title: 'Add Seat', seat: null, mode: 'create' });

exports.create = async (req, res, next) => {
  try {
    const seatNumber = normalizeCode(req.body.seatNumber, 40);
    if (!seatNumber) {
      req.flash('error', 'Seat number is required.');
      return res.redirect('/admin/seats/new');
    }
    const duplicate = await Seat.findOne({ seatNumber }).select('_id').lean();
    if (duplicate) {
      req.flash('error', `Seat ${seatNumber} already exists. Enter a different seat number.`);
      return res.redirect('/admin/seats/new');
    }

    await Seat.create({
      seatNumber,
      floor: cleanText(req.body.floor, 80) || 'Ground Floor',
      section: cleanText(req.body.section, 80) || 'General',
      status: req.body.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE',
      student: null
    });
    req.flash('success', 'Seat added successfully.');
    res.redirect('/admin/seats');
  } catch (error) {
    if (isDuplicateKey(error)) {
      req.flash('error', duplicateMessage(error, { seatNumber: 'Seat number' }));
      return res.redirect('/admin/seats/new');
    }
    next(error);
  }
};

exports.editForm = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(404).render('error', { title: 'Seat not found', message: 'Seat not found.' });
    const seat = await Seat.findById(req.params.id).populate('student', 'name studentId').lean();
    if (!seat) return res.status(404).render('error', { title: 'Seat not found', message: 'Seat not found.' });
    res.render('seats/form', { title: 'Edit Seat', seat, mode: 'edit' });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const seat = await Seat.findById(req.params.id);
    if (!seat) {
      req.flash('error', 'Seat record was not found.');
      return res.redirect('/admin/seats');
    }
    seat.seatNumber = normalizeCode(req.body.seatNumber, 40);
    seat.floor = cleanText(req.body.floor, 80) || 'Ground Floor';
    seat.section = cleanText(req.body.section, 80) || 'General';
    if (!seat.student) seat.status = req.body.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'AVAILABLE';
    await seat.save();
    req.flash('success', 'Seat updated successfully.');
    res.redirect('/admin/seats');
  } catch (error) {
    if (isDuplicateKey(error)) {
      req.flash('error', duplicateMessage(error, { seatNumber: 'Seat number' }));
      return res.redirect(`/admin/seats/${req.params.id}/edit`);
    }
    if (error.name === 'ValidationError') {
      req.flash('error', error.message);
      return res.redirect(`/admin/seats/${req.params.id}/edit`);
    }
    next(error);
  }
};

exports.release = async (req, res, next) => {
  try {
    const seat = await Seat.findById(req.params.id);
    if (!seat) {
      req.flash('error', 'Seat record was not found.');
      return res.redirect('/admin/seats');
    }
    if (!seat.student) {
      req.flash('error', 'This seat is already available.');
      return res.redirect('/admin/seats');
    }

    const studentId = seat.student;
    await Student.updateOne({ _id: studentId, seat: seat._id }, { $set: { seat: null } });
    seat.student = null;
    seat.status = 'AVAILABLE';
    await seat.save();

    req.flash('success', `Seat ${seat.seatNumber} released successfully.`);
    res.redirect('/admin/seats');
  } catch (error) { next(error); }
};

exports.delete = async (req, res, next) => {
  try {
    const seat = await Seat.findById(req.params.id);
    if (!seat) {
      req.flash('error', 'Seat record was not found.');
      return res.redirect('/admin/seats');
    }
    if (seat.student || seat.status === 'OCCUPIED') {
      req.flash('error', 'Release the assigned student before deleting this seat.');
      return res.redirect('/admin/seats');
    }
    await Seat.findByIdAndDelete(seat._id);
    req.flash('success', 'Seat deleted successfully.');
    res.redirect('/admin/seats');
  } catch (error) { next(error); }
};
