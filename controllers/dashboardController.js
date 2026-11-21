const Student = require('../models/Student');
const Seat = require('../models/Seat');
const Book = require('../models/Book');
const Issue = require('../models/Issue');

exports.dashboard = async (req, res, next) => {
  try {
    const [students, seats, books, activeIssues, availableSeats] = await Promise.all([
      Student.countDocuments(),
      Seat.countDocuments(),
      Book.countDocuments(),
      Issue.countDocuments({ status: 'ISSUED' }),
      Seat.countDocuments({ status: 'AVAILABLE' })
    ]);

    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: { students, seats, books, activeIssues, availableSeats }
    });
  } catch (error) {
    next(error);
  }
};
