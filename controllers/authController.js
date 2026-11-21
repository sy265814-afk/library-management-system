const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

exports.loginPage = (req, res) => {
  res.render('auth/login', {
    title: 'Admin Login'
  });
};

exports.signupPage = (req, res) => {
  res.render('auth/signup', {
    title: 'Create Admin Account'
  });
};

exports.signup = async (req, res, next) => {
  try {
    const { name, username, password, confirmPassword } = req.body;

    if (!name || !username || !password || !confirmPassword) {
      req.flash('error', 'Please fill every required field.');
      return res.redirect('/admin/signup');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/admin/signup');
    }

    if (password.length < 8) {
      req.flash('error', 'Password must contain at least 8 characters.');
      return res.redirect('/admin/signup');
    }

    const normalizedUsername = username.trim().toLowerCase();
    const existing = await Admin.findOne({ username: normalizedUsername });

    if (existing) {
      req.flash('error', 'This username already exists. Please login.');
      return res.redirect('/admin/login');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await Admin.create({
      name: name.trim(),
      username: normalizedUsername,
      passwordHash
    });

    req.flash('success', 'Admin account created successfully. Please login.');
    res.redirect('/admin/login');
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username: String(username || '').trim().toLowerCase() });

    if (!admin || !(await bcrypt.compare(password || '', admin.passwordHash))) {
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/admin/login');
    }

    req.session.admin = {
      id: admin._id.toString(),
      username: admin.username,
      name: admin.name
    };

    res.redirect('/admin');
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('library.sid');
    res.redirect('/admin/login');
  });
};
