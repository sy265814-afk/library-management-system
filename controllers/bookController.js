const Book = require('../models/Book');
const Issue = require('../models/Issue');
const { cleanText, normalizeCode, escapeRegex, getPagination, buildPagination, isValidObjectId, parsePositiveInteger } = require('../utils/validation');
const { duplicateMessage, isDuplicateKey } = require('../utils/duplicateKey');

function bookInput(body, currentBook = null) {
  const isbn = normalizeCode(body.isbn, 40) || undefined;
  const title = cleanText(body.title, 180);
  const author = cleanText(body.author, 120);
  if (!title || !author) throw new Error('Book title and author are required.');

  const totalCopies = Number(body.totalCopies);
  if (!Number.isInteger(totalCopies) || totalCopies < 0 || totalCopies > 1000000) {
    throw new Error('Total copies must be a whole number from 0 to 1,000,000.');
  }

  const issuedCopies = currentBook ? Math.max(0, currentBook.totalCopies - currentBook.availableCopies) : 0;
  if (totalCopies < issuedCopies) {
    throw new Error(`Total copies cannot be lower than the ${issuedCopies} copies currently issued.`);
  }

  return {
    isbn,
    title,
    author,
    category: cleanText(body.category, 100),
    publisher: cleanText(body.publisher, 120),
    totalCopies,
    availableCopies: totalCopies - issuedCopies
  };
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
        { isbn: codePrefix },
        { titleNormalized: prefix },
        { authorNormalized: prefix },
        { category: new RegExp(`^${escapeRegex(q)}`, 'i') }
      ];
    }

    const [books, total, inventory] = await Promise.all([
      Book.find(filter).select('+titleNormalized +authorNormalized').sort({ title: 1, _id: 1 }).skip(pageData.skip).limit(pageData.limit).lean(),
      Book.countDocuments(filter),
      Book.aggregate([{ $group: { _id: null, totalCopies: { $sum: '$totalCopies' }, availableCopies: { $sum: '$availableCopies' } } }])
    ]);

    res.render('books/index', {
      title: 'Books', books, search: q,
      inventory: inventory[0] || { totalCopies: 0, availableCopies: 0 },
      pagination: buildPagination(total, pageData.page, pageData.limit, { q })
    });
  } catch (error) { next(error); }
};

exports.newForm = (req, res) => res.render('books/form', { title: 'Add Book', book: null, mode: 'create' });

exports.create = async (req, res, next) => {
  const redirectTo = '/admin/books/new';
  try {
    const payload = bookInput(req.body);
    if (payload.isbn) {
      const duplicate = await Book.findOne({ isbn: payload.isbn }).select('_id').lean();
      if (duplicate) {
        req.flash('error', `ISBN ${payload.isbn} already exists. Leave ISBN blank or enter a different ISBN.`);
        return res.redirect(redirectTo);
      }
    }
    await Book.create(payload);
    req.flash('success', 'Book added to inventory successfully.');
    res.redirect('/admin/books');
  } catch (error) {
    if (isDuplicateKey(error)) {
      req.flash('error', duplicateMessage(error, { isbn: 'ISBN', bookCode: 'Book code' }));
      return res.redirect(redirectTo);
    }
    if (error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'Error' && /required|must be|cannot be|ISBN|Book title|Author/i.test(error.message)) {
      req.flash('error', error.message);
      return res.redirect(redirectTo);
    }
    next(error);
  }
};

exports.editForm = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(404).render('error', { title: 'Book not found', message: 'Book not found.' });
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.status(404).render('error', { title: 'Book not found', message: 'Book not found.' });
    res.render('books/form', { title: 'Edit Book', book, mode: 'edit' });
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  const redirectTo = `/admin/books/${req.params.id}/edit`;
  try {
    if (!isValidObjectId(req.params.id)) return res.redirect('/admin/books');
    const book = await Book.findById(req.params.id);
    if (!book) {
      req.flash('error', 'Book record was not found.');
      return res.redirect('/admin/books');
    }

    const payload = bookInput(req.body, book);
    if (payload.isbn) {
      const duplicate = await Book.findOne({ isbn: payload.isbn, _id: { $ne: book._id } }).select('_id').lean();
      if (duplicate) {
        req.flash('error', `ISBN ${payload.isbn} is already used by another book.`);
        return res.redirect(redirectTo);
      }
    }
    Object.assign(book, payload);
    await book.save();
    req.flash('success', 'Book details updated successfully.');
    res.redirect('/admin/books');
  } catch (error) {
    if (isDuplicateKey(error)) {
      req.flash('error', duplicateMessage(error, { isbn: 'ISBN', bookCode: 'Book code' }));
      return res.redirect(redirectTo);
    }
    if (error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'Error' && /required|must be|cannot be|ISBN|Book title|Author/i.test(error.message)) {
      req.flash('error', error.message);
      return res.redirect(redirectTo);
    }
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.redirect('/admin/books');
    const activeIssue = await Issue.findOne({ book: req.params.id, status: 'ISSUED' }).select('_id').lean();
    if (activeIssue) {
      req.flash('error', 'Return all currently issued copies before deleting this book.');
      return res.redirect('/admin/books');
    }
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) req.flash('error', 'Book record was not found.');
    else req.flash('success', 'Book deleted successfully.');
    res.redirect('/admin/books');
  } catch (error) { next(error); }
};
