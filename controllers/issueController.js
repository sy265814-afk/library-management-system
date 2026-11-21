const Student = require('../models/Student');
const Book = require('../models/Book');
const Issue = require('../models/Issue');

exports.index = async (req, res, next) => {
  try {
    const issues = await Issue.find()
      .populate('student')
      .populate('book')
      .sort({ createdAt: -1 });

    res.render('issues/index', { title: 'Book Issues', issues });
  } catch (error) {
    next(error);
  }
};

exports.newForm = async (req, res, next) => {
  try {
    const [students, books] = await Promise.all([
      Student.find({ status: 'ACTIVE' }).sort({ name: 1 }),
      Book.find({ availableCopies: { $gt: 0 } }).sort({ title: 1 })
    ]);

    res.render('issues/form', {
      title: 'Issue Book',
      students,
      books
    });
  } catch (error) {
    next(error);
  }
};

exports.issue = async (req, res, next) => {
  try {
    const { studentId, bookId, dueAt } = req.body;

    const [student, book] = await Promise.all([
      Student.findById(studentId),
      Book.findById(bookId)
    ]);

    if (!student || student.status !== 'ACTIVE') {
      req.flash('error', 'Please select a valid active student.');
      return res.redirect('/admin/issues/new');
    }

    if (!book || book.availableCopies < 1) {
      req.flash('error', 'This book is currently unavailable.');
      return res.redirect('/admin/issues/new');
    }

    const existing = await Issue.exists({
      student: student._id,
      book: book._id,
      status: 'ISSUED'
    });

    if (existing) {
      req.flash('error', 'This student already has this book issued.');
      return res.redirect('/admin/issues/new');
    }

    const dueDate = new Date(dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      req.flash('error', 'Please select a valid due date.');
      return res.redirect('/admin/issues/new');
    }

    await Issue.create({
      student: student._id,
      book: book._id,
      dueAt: dueDate
    });

    book.availableCopies -= 1;
    await book.save();

    req.flash('success', 'Book issued successfully.');
    res.redirect('/admin/issues');
  } catch (error) {
    next(error);
  }
};

exports.returnBook = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);

    if (!issue || issue.status === 'RETURNED') {
      req.flash('error', 'This issue is already returned or does not exist.');
      return res.redirect('/admin/issues');
    }

    issue.status = 'RETURNED';
    issue.returnedAt = new Date();
    await issue.save();

    await Book.findByIdAndUpdate(issue.book, {
      $inc: { availableCopies: 1 }
    });

    req.flash('success', 'Book returned successfully.');
    res.redirect('/admin/issues');
  } catch (error) {
    next(error);
  }
};
