const Student = require('../models/Student');
const Seat = require('../models/Seat');

exports.index = async (req, res, next) => {
  try {
    const students = await Student.find().populate('seat').sort({ createdAt: -1 });
    res.render('students/index', { title: 'Students', students });
  } catch (error) {
    next(error);
  }
};

exports.newForm = async (req, res, next) => {
  try {
    const seats = await Seat.find({ status: 'AVAILABLE' }).sort({ seatNumber: 1 });
    res.render('students/form', { title: 'Add Student', student: null, seats, mode: 'create' });
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { studentId, name, email, phone, course, semester, seatId } = req.body;

    if (!studentId || !name) {
      req.flash('error', 'Student ID and name are required.');
      return res.redirect('/admin/students/new');
    }

    const student = await Student.create({
      studentId,
      name,
      email,
      phone,
      course,
      semester
    });

    if (seatId) {
      const seat = await Seat.findOne({ _id: seatId, status: 'AVAILABLE' });

      if (!seat) {
        await Student.findByIdAndDelete(student._id);
        req.flash('error', 'Selected seat is no longer available.');
        return res.redirect('/admin/students/new');
      }

      student.seat = seat._id;
      await student.save();

      seat.status = 'OCCUPIED';
      seat.student = student._id;
      await seat.save();
    }

    req.flash('success', 'Student added successfully.');
    res.redirect('/admin/students');
  } catch (error) {
    if (error.code === 11000) {
      req.flash('error', 'Student ID already exists.');
      return res.redirect('/admin/students/new');
    }
    next(error);
  }
};

exports.editForm = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).populate('seat');
    if (!student) return res.status(404).render('error', { title: 'Student not found', message: 'Student not found.' });

    const seats = await Seat.find({
      $or: [
        { status: 'AVAILABLE' },
        { _id: student.seat?._id }
      ]
    }).sort({ seatNumber: 1 });

    res.render('students/form', { title: 'Edit Student', student, seats, mode: 'edit' });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.redirect('/admin/students');

    const oldSeatId = student.seat ? student.seat.toString() : null;
    const newSeatId = req.body.seatId || null;

    student.studentId = req.body.studentId;
    student.name = req.body.name;
    student.email = req.body.email;
    student.phone = req.body.phone;
    student.course = req.body.course;
    student.semester = req.body.semester;

    if (oldSeatId !== newSeatId) {
      if (oldSeatId) {
        await Seat.findByIdAndUpdate(oldSeatId, {
          status: 'AVAILABLE',
          student: null
        });
      }

      if (newSeatId) {
        const newSeat = await Seat.findOne({ _id: newSeatId, $or: [{ status: 'AVAILABLE' }, { student: student._id }] });
        if (!newSeat) {
          req.flash('error', 'Selected seat is not available.');
          return res.redirect(`/admin/students/${student._id}/edit`);
        }

        newSeat.status = 'OCCUPIED';
        newSeat.student = student._id;
        await newSeat.save();
      }

      student.seat = newSeatId;
    }

    await student.save();

    req.flash('success', 'Student updated successfully.');
    res.redirect('/admin/students');
  } catch (error) {
    if (error.code === 11000) {
      req.flash('error', 'Student ID already exists.');
      return res.redirect(`/admin/students/${req.params.id}/edit`);
    }
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (student?.seat) {
      await Seat.findByIdAndUpdate(student.seat, { status: 'AVAILABLE', student: null });
    }

    await Student.findByIdAndDelete(req.params.id);
    req.flash('success', 'Student removed successfully.');
    res.redirect('/admin/students');
  } catch (error) {
    next(error);
  }
};
