const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');
const studentController = require('../controllers/studentController');
const seatController = require('../controllers/seatController');
const bookController = require('../controllers/bookController');
const issueController = require('../controllers/issueController');

const router = express.Router();

router.get('/', requireAdmin, dashboardController.dashboard);

router.get('/students', requireAdmin, studentController.index);
router.get('/students/new', requireAdmin, studentController.newForm);
router.post('/students', requireAdmin, studentController.create);
router.get('/students/:id/edit', requireAdmin, studentController.editForm);
router.put('/students/:id', requireAdmin, studentController.update);
router.delete('/students/:id', requireAdmin, studentController.delete);

router.get('/seats', requireAdmin, seatController.index);
router.get('/seats/new', requireAdmin, seatController.newForm);
router.post('/seats', requireAdmin, seatController.create);
router.get('/seats/:id/edit', requireAdmin, seatController.editForm);
router.put('/seats/:id', requireAdmin, seatController.update);
router.post('/seats/:id/release', requireAdmin, seatController.release);
router.delete('/seats/:id', requireAdmin, seatController.delete);

router.get('/books', requireAdmin, bookController.index);
router.get('/books/new', requireAdmin, bookController.newForm);
router.post('/books', requireAdmin, bookController.create);
router.get('/books/:id/edit', requireAdmin, bookController.editForm);
router.put('/books/:id', requireAdmin, bookController.update);
router.delete('/books/:id', requireAdmin, bookController.delete);

router.get('/issues', requireAdmin, issueController.index);
router.get('/issues/new', requireAdmin, issueController.newForm);
router.post('/issues', requireAdmin, issueController.issue);
router.put('/issues/:id/return', requireAdmin, issueController.returnBook);

module.exports = router;
