const Student = require('../models/Student');
const Seat = require('../models/Seat');
const Book = require('../models/Book');
const Issue = require('../models/Issue');

exports.dashboard = async (req, res, next) => {
  try {
    const [students, seats, books, activeIssues, availableSeats, inventory] = await Promise.all([
      Student.countDocuments(),
      Seat.countDocuments(),
      Book.countDocuments(),
      Issue.countDocuments({ status: 'ISSUED' }),
      Seat.countDocuments({ status: 'AVAILABLE' }),
      Book.aggregate([{ $group: { _id: null, totalCopies: { $sum: '$totalCopies' }, availableCopies: { $sum: '$availableCopies' } } }])
    ]);

    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: { students, seats, books, activeIssues, availableSeats,
        totalBookCopies: inventory[0]?.totalCopies || 0,
        availableBookCopies: inventory[0]?.availableCopies || 0 }
    });
  } catch (error) { next(error); }
};
