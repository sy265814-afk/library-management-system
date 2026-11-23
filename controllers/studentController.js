const Student = require('../models/Student');
const Seat = require('../models/Seat');
const Issue = require('../models/Issue');
const { cleanText, normalizeCode, escapeRegex, getPagination, buildPagination, isValidObjectId } = require('../utils/validation');
const { duplicateMessage, isDuplicateKey } = require('../utils/duplicateKey');

function studentInput(body) {
  const payload = {
    studentId: normalizeCode(body.studentId, 50),
    name: cleanText(body.name, 120),
    email: cleanText(body.email, 150).toLowerCase() || undefined,
    phone: cleanText(body.phone, 25),
    course: cleanText(body.course, 100),
    semester: cleanText(body.semester, 40),
    status: body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
  };
  if (!payload.studentId || !payload.name) {
    const error = new Error('Student ID and student name are required.');
    error.isFormError = true;
    throw error;
  }
  return payload;
}

function handleSaveError(req, res, error, redirectTo, next, labels) {
  if (isDuplicateKey(error)) {
    req.flash('error', duplicateMessage(error, labels));
    return res.redirect(redirectTo);
  }
  if (error.isFormError || error.name === 'ValidationError' || error.name === 'CastError') {
    req.flash('error', error.message);
    return res.redirect(redirectTo);
  }
  return next(error);
}

exports.index = async (req, res, next) => {
  try {
    const q = cleanText(req.query.q, 80);
    const pageData = getPagination(req.query);
    const filter = {};
    if (q) {
      const prefix = new RegExp(`^${escapeRegex(q.toLocaleLowerCase('en-IN'))}`);
      const codePrefix = new RegExp(`^${escapeRegex(normalizeCode(q, 80))}`);
      filter.$or = [
        { studentId: codePrefix },
        { nameNormalized: prefix },
        { email: new RegExp(`^${escapeRegex(q.toLowerCase())}`) },
        { phone: new RegExp(`^${escapeRegex(q)}`) }
      ];
    }

    const [students, total] = await Promise.all([
      Student.find(filter).select('+nameNormalized').populate('seat').sort({ createdAt: -1, _id: -1 }).skip(pageData.skip).limit(pageData.limit).lean(),
      Student.countDocuments(filter)
    ]);

    res.render('students/index', {
      title: 'Students', students, search: q,
      pagination: buildPagination(total, pageData.page, pageData.limit, { q })
    });
  } catch (error) { next(error); }
};

exports.newForm = async (req, res, next) => {
  try {
    const seats = await Seat.find({ status: 'AVAILABLE', student: null }).sort({ seatNumber: 1 }).limit(500).lean();
    res.render('students/form', { title: 'Add Student', student: null, seats, mode: 'create' });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const redirectTo = '/admin/students/new';
  let createdStudent = null;
  let claimedSeatId = null;
  try {
    const payload = studentInput(req.body);

    const duplicate = await Student.findOne({ studentId: payload.studentId }).select('_id').lean();
    if (duplicate) {
      req.flash('error', `Student ID ${payload.studentId} is already in use. Enter a different Student ID.`);
      return res.redirect(redirectTo);
    }

    if (req.body.seatId && !isValidObjectId(req.body.seatId)) {
      req.flash('error', 'Please select a valid seat.');
      return res.redirect(redirectTo);
    }

    createdStudent = await Student.create(payload);

    if (req.body.seatId) {
      const seat = await Seat.findOneAndUpdate(
        { _id: req.body.seatId, status: 'AVAILABLE', student: null },
        { $set: { status: 'OCCUPIED', student: createdStudent._id } },
        { new: true }
      );

      if (!seat) {
        await Student.findByIdAndDelete(createdStudent._id);
        req.flash('error', 'That seat is no longer available. Choose another seat.');
        return res.redirect(redirectTo);
      }

      claimedSeatId = seat._id;
      createdStudent.seat = seat._id;
      await createdStudent.save();
    }

    req.flash('success', 'Student added successfully.');
    return res.redirect('/admin/students');
  } catch (error) {
    if (claimedSeatId && createdStudent) {
      await Seat.updateOne({ _id: claimedSeatId, student: createdStudent._id }, { $set: { status: 'AVAILABLE', student: null } }).catch(() => {});
    }
    if (createdStudent) await Student.findByIdAndDelete(createdStudent._id).catch(() => {});
    return handleSaveError(req, res, error, redirectTo, next, { studentId: 'Student ID', email: 'Email address' });
  }
};

exports.editForm = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(404).render('error', { title: 'Student not found', message: 'Student not found.' });
    const student = await Student.findById(req.params.id).populate('seat').lean();
    if (!student) return res.status(404).render('error', { title: 'Student not found', message: 'Student not found.' });

    const seats = await Seat.find({
      $or: [
        { status: 'AVAILABLE', student: null },
        { _id: student.seat?._id }
      ]
    }).sort({ seatNumber: 1 }).limit(500).lean();

    res.render('students/form', { title: 'Edit Student', student, seats, mode: 'edit' });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  const redirectTo = `/admin/students/${req.params.id}/edit`;
  let newlyClaimedSeat = null;
  let oldSeatReleased = false;
  let oldSeatId = null;
  let studentIdForRollback = null;
  let studentSaved = false;

  try {
    if (!isValidObjectId(req.params.id)) {
      req.flash('error', 'Invalid student record.');
      return res.redirect('/admin/students');
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      req.flash('error', 'Student record was not found.');
      return res.redirect('/admin/students');
    }

    studentIdForRollback = student._id;
    const payload = studentInput(req.body);
    const duplicate = await Student.findOne({ studentId: payload.studentId, _id: { $ne: student._id } }).select('_id').lean();
    if (duplicate) {
      req.flash('error', `Student ID ${payload.studentId} is already in use by another student.`);
      return res.redirect(redirectTo);
    }

    oldSeatId = student.seat ? String(student.seat) : null;
    const requestedSeatId = req.body.seatId || null;
    if (requestedSeatId && !isValidObjectId(requestedSeatId)) {
      req.flash('error', 'Please select a valid seat.');
      return res.redirect(redirectTo);
    }

    if (requestedSeatId && requestedSeatId !== oldSeatId) {
      const assignedToAnotherStudent = await Student.findOne({ seat: requestedSeatId, _id: { $ne: student._id } }).select('_id').lean();
      if (assignedToAnotherStudent) {
        req.flash('error', 'This seat is already assigned to another student.');
        return res.redirect(redirectTo);
      }

      const targetSeat = await Seat.findOne({ _id: requestedSeatId, status: 'AVAILABLE', student: null }).select('_id').lean();
      if (!targetSeat) {
        req.flash('error', 'Selected seat is not available.');
        return res.redirect(redirectTo);
      }

      // Release the old seat first because the database enforces one occupied
      // seat per student. If the new seat cannot be claimed, restore the old one.
      if (oldSeatId) {
        const released = await Seat.findOneAndUpdate(
          { _id: oldSeatId, student: student._id, status: 'OCCUPIED' },
          { $set: { status: 'AVAILABLE', student: null } },
          { new: true }
        );
        oldSeatReleased = Boolean(released);
      }

      const claimed = await Seat.findOneAndUpdate(
        { _id: requestedSeatId, status: 'AVAILABLE', student: null },
        { $set: { status: 'OCCUPIED', student: student._id } },
        { new: true }
      );

      if (!claimed) {
        if (oldSeatReleased) {
          await Seat.updateOne(
            { _id: oldSeatId, status: 'AVAILABLE', student: null },
            { $set: { status: 'OCCUPIED', student: student._id } }
          );
          oldSeatReleased = false;
        }
        req.flash('error', 'Selected seat was just assigned to someone else. Please choose another seat.');
        return res.redirect(redirectTo);
      }
      newlyClaimedSeat = claimed._id;
    }

    Object.assign(student, payload);
    student.seat = requestedSeatId || null;
    await student.save();
    studentSaved = true;

    if (!requestedSeatId && oldSeatId) {
      await Seat.updateOne(
        { _id: oldSeatId, student: student._id },
        { $set: { status: 'AVAILABLE', student: null } }
      );
    }

    req.flash('success', 'Student details updated successfully.');
    return res.redirect('/admin/students');
  } catch (error) {
    if (!studentSaved) {
      if (newlyClaimedSeat) {
        await Seat.updateOne(
          { _id: newlyClaimedSeat, student: studentIdForRollback },
          { $set: { status: 'AVAILABLE', student: null } }
        ).catch(() => {});
      }
      if (oldSeatReleased && oldSeatId && studentIdForRollback) {
        await Seat.updateOne(
          { _id: oldSeatId, status: 'AVAILABLE', student: null },
          { $set: { status: 'OCCUPIED', student: studentIdForRollback } }
        ).catch(() => {});
      }
    }
    return handleSaveError(req, res, error, redirectTo, next, { studentId: 'Student ID', email: 'Email address' });
  }
};

exports.delete = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      req.flash('error', 'Invalid student record.');
      return res.redirect('/admin/students');
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      req.flash('error', 'Student record was not found.');
      return res.redirect('/admin/students');
    }

    const activeIssue = await Issue.findOne({ student: student._id, status: 'ISSUED' }).select('_id').lean();
    if (activeIssue) {
      req.flash('error', 'Return all currently issued books before deleting this student.');
      return res.redirect('/admin/students');
    }

    if (student.seat) {
      await Seat.updateOne({ _id: student.seat, student: student._id }, { $set: { status: 'AVAILABLE', student: null } });
    }

    await Student.findByIdAndDelete(student._id);
    req.flash('success', 'Student deleted successfully.');
    res.redirect('/admin/students');
  } catch (error) { next(error); }
};
