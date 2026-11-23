const Student = require('../models/Student');
const Book = require('../models/Book');
const Issue = require('../models/Issue');
const { cleanText, escapeRegex, getPagination, buildPagination, isValidObjectId, parseDate } = require('../utils/validation');

exports.index = async (req, res, next) => {
  try {
    const q = cleanText(req.query.q, 80);
    const status = ['ISSUED', 'RETURNED'].includes(req.query.status) ? req.query.status : '';
    const pageData = getPagination(req.query);
    const filter = {};
    if (status) filter.status = status;

    if (q) {
      const term = new RegExp(escapeRegex(q), 'i');
      const [studentMatches, bookMatches] = await Promise.all([
        Student.find({ $or: [{ studentId: term }, { name: term }] }).select('_id').limit(500).lean(),
        Book.find({ $or: [{ title: term }, { author: term }, { isbn: term }] }).select('_id').limit(500).lean()
      ]);
      const clauses = [];
      if (studentMatches.length) clauses.push({ student: { $in: studentMatches.map(item => item._id) } });
      if (bookMatches.length) clauses.push({ book: { $in: bookMatches.map(item => item._id) } });
      if (clauses.length) filter.$or = clauses;
      else filter._id = null;
    }

    const [issues, total] = await Promise.all([
      Issue.find(filter).populate('student', 'name studentId').populate('book', 'title author isbn').sort({ createdAt: -1, _id: -1 }).skip(pageData.skip).limit(pageData.limit).lean(),
      Issue.countDocuments(filter)
    ]);

    res.render('issues/index', {
      title: 'Book Issues', issues, search: q, status,
      pagination: buildPagination(total, pageData.page, pageData.limit, { q, status })
    });
  } catch (error) { next(error); }
};

exports.newForm = async (req, res, next) => {
  try {
    const [students, books] = await Promise.all([
      Student.find({ status: 'ACTIVE' }).select('name studentId').sort({ name: 1 }).limit(1000).lean(),
      Book.find({ availableCopies: { $gt: 0 } }).select('title author availableCopies').sort({ title: 1 }).limit(1000).lean()
    ]);
    res.render('issues/form', { title: 'Issue Book', students, books });
  } catch (error) { next(error); }
};

exports.issue = async (req, res, next) => {
  try {
    const { studentId, bookId, dueAt } = req.body;
    if (!isValidObjectId(studentId) || !isValidObjectId(bookId)) {
      req.flash('error', 'Select a valid student and book.');
      return res.redirect('/admin/issues/new');
    }

    const [student, book] = await Promise.all([
      Student.findById(studentId),
      Book.findById(bookId)
    ]);
    if (!student || student.status !== 'ACTIVE') {
      req.flash('error', 'Please select a valid active student.');
      return res.redirect('/admin/issues/new');
    }
    if (!book) {
      req.flash('error', 'Book record was not found.');
      return res.redirect('/admin/issues/new');
    }

    const dueDate = parseDate(dueAt, 'due date');
    const existing = await Issue.exists({ student: student._id, book: book._id, status: 'ISSUED' });
    if (existing) {
      req.flash('error', 'This student already has this book issued. Return it before issuing another copy of the same title.');
      return res.redirect('/admin/issues/new');
    }

    // Atomic stock decrement prevents two admins issuing the last copy at once.
    const stockUpdated = await Book.findOneAndUpdate(
      { _id: book._id, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true }
    );
    if (!stockUpdated) {
      req.flash('error', 'No available copies remain for this book.');
      return res.redirect('/admin/issues/new');
    }

    try {
      await Issue.create({ student: student._id, book: book._id, dueAt: dueDate, status: 'ISSUED' });
    } catch (error) {
      await Book.updateOne({ _id: book._id }, { $inc: { availableCopies: 1 } });
      if (error.code === 11000) {
        req.flash('error', 'This student already has this book issued.');
        return res.redirect('/admin/issues/new');
      }
      throw error;
    }

    req.flash('success', `“${book.title}” issued to ${student.name}.`);
    res.redirect('/admin/issues');
  } catch (error) {
    if (error.message) {
      req.flash('error', error.message);
      return res.redirect('/admin/issues/new');
    }
    next(error);
  }
};

exports.returnBook = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      req.flash('error', 'Invalid issue record.');
      return res.redirect('/admin/issues');
    }

    const issue = await Issue.findOneAndUpdate(
      { _id: req.params.id, status: 'ISSUED' },
      { $set: { status: 'RETURNED', returnedAt: new Date() } },
      { new: true }
    );

    if (!issue) {
      req.flash('error', 'This book was already returned or the issue record was not found.');
      return res.redirect('/admin/issues');
    }

    const book = await Book.findById(issue.book);
    if (book) {
      book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      await book.save();
    }

    req.flash('success', 'Book returned successfully. Inventory has been updated.');
    res.redirect('/admin/issues');
  } catch (error) { next(error); }
};
