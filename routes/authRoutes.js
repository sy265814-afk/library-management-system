const express = require('express');
const controller = require('../controllers/authController');

const router = express.Router();

router.get('/login', controller.loginPage);
router.post('/login', controller.login);
router.get('/signup', controller.signupPage);
router.post('/signup', controller.signup);
router.post('/logout', controller.logout);

module.exports = router;
