function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }

  next();
}

function redirectIfAdmin(req, res, next) {
  if (req.session.admin) {
    return res.redirect('/admin');
  }

  next();
}

module.exports = {
  requireAdmin,
  redirectIfAdmin
};
