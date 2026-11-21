function notFound(req, res) {
  res.status(404).render('error', {
    title: 'Page not found',
    message: 'The page you are looking for does not exist.'
  });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).render('error', {
    title: 'Something went wrong',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message
  });
}

module.exports = {
  notFound,
  errorHandler
};
