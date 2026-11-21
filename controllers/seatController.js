const Seat = require('../models/Seat');

exports.index = async (req, res, next) => {
  try {
    const seats = await Seat.find().populate('student').sort({ seatNumber: 1 });
    res.render('seats/index', { title: 'Seats', seats });
  } catch (error) {
    next(error);
  }
};

exports.newForm = (req, res) => {
  res.render('seats/form', { title: 'Add Seat', seat: null, mode: 'create' });
};

exports.create = async (req, res, next) => {
  try {
    await Seat.create({
      seatNumber: req.body.seatNumber,
      floor: req.body.floor,
      section: req.body.section,
      status: req.body.status || 'AVAILABLE'
    });

    req.flash('success', 'Seat added successfully.');
    res.redirect('/admin/seats');
  } catch (error) {
    if (error.code === 11000) {
      req.flash('error', 'Seat number already exists.');
      return res.redirect('/admin/seats/new');
    }
    next(error);
  }
};

exports.editForm = async (req, res, next) => {
  try {
    const seat = await Seat.findById(req.params.id).populate('student');
    if (!seat) return res.status(404).render('error', { title: 'Seat not found', message: 'Seat not found.' });

    res.render('seats/form', { title: 'Edit Seat', seat, mode: 'edit' });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const seat = await Seat.findById(req.params.id);
    if (!seat) return res.redirect('/admin/seats');

    seat.seatNumber = req.body.seatNumber;
    seat.floor = req.body.floor;
    seat.section = req.body.section;

    if (!seat.student) {
      seat.status = req.body.status || 'AVAILABLE';
    }

    await seat.save();
    req.flash('success', 'Seat updated successfully.');
    res.redirect('/admin/seats');
  } catch (error) {
    if (error.code === 11000) {
      req.flash('error', 'Seat number already exists.');
      return res.redirect(`/admin/seats/${req.params.id}/edit`);
    }
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const seat = await Seat.findById(req.params.id);
    if (seat?.student) {
      req.flash('error', 'Occupied seat cannot be deleted. Remove the student assignment first.');
      return res.redirect('/admin/seats');
    }

    await Seat.findByIdAndDelete(req.params.id);
    req.flash('success', 'Seat deleted successfully.');
    res.redirect('/admin/seats');
  } catch (error) {
    next(error);
  }
};
