const Book = require('../models/Book');

exports.index = async (req, res, next) => {
  try {
    const books = await Book.find().sort({ title: 1 });
    res.render('books/index', { title: 'Books', books });
  } catch (error) {
    next(error);
  }
};

exports.newForm = (req, res) => {
  res.render('books/form', { title: 'Add Book', book: null, mode: 'create' });
};

exports.create = async (req, res, next) => {
  try {
    const totalCopies = Math.max(0, Number(req.body.totalCopies || 0));
    await Book.create({
      isbn: req.body.isbn || undefined,
      title: req.body.title,
      author: req.body.author,
      category: req.body.category,
      publisher: req.body.publisher,
      totalCopies,
      availableCopies: totalCopies
    });

    req.flash('success', 'Book added successfully.');
    res.redirect('/admin/books');
  } catch (error) {
    if (error.code === 11000) {
      req.flash('error', 'ISBN already exists.');
      return res.redirect('/admin/books/new');
    }
    next(error);
  }
};

exports.editForm = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).render('error', { title: 'Book not found', message: 'Book not found.' });

    res.render('books/form', { title: 'Edit Book', book, mode: 'edit' });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.redirect('/admin/books');

    const oldTotal = book.totalCopies;
    const oldAvailable = book.availableCopies;
    const newTotal = Math.max(0, Number(req.body.totalCopies || 0));
    const issuedCopies = oldTotal - oldAvailable;

    if (newTotal < issuedCopies) {
      req.flash('error', `Total copies cannot be less than currently issued copies (${issuedCopies}).`);
      return res.redirect(`/admin/books/${book._id}/edit`);
    }

    book.isbn = req.body.isbn || undefined;
    book.title = req.body.title;
    book.author = req.body.author;
    book.category = req.body.category;
    book.publisher = req.body.publisher;
    book.totalCopies = newTotal;
    book.availableCopies = newTotal - issuedCopies;

    await book.save();
    req.flash('success', 'Book updated successfully.');
    res.redirect('/admin/books');
  } catch (error) {
    if (error.code === 11000) {
      req.flash('error', 'ISBN already exists.');
      return res.redirect(`/admin/books/${req.params.id}/edit`);
    }
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const BookIssue = require('../models/Issue');
    const active = await BookIssue.exists({ book: req.params.id, status: 'ISSUED' });

    if (active) {
      req.flash('error', 'This book has active issues and cannot be deleted.');
      return res.redirect('/admin/books');
    }

    await Book.findByIdAndDelete(req.params.id);
    req.flash('success', 'Book deleted successfully.');
    res.redirect('/admin/books');
  } catch (error) {
    next(error);
  }
};
