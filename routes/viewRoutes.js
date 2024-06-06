const express = require('express');
const viewsController = require('../controller/viewController');
const authController = require('../controller/authController');
// const bookingController = require('../controller/bookingController');

const router = express.Router();

router.use(viewsController.alerts);
router.get(
  '/',
  // bookingController.createBookingCheckout,
  authController.isLoggedin,
  viewsController.getOverview
);
router.get('/tour/:slug', authController.isLoggedin, viewsController.getTour);
router.get('/login', authController.isLoggedin, viewsController.getLoginForm);
router.get('/signup', authController.isLoggedin, viewsController.getSignupForm);
router.get('/me', authController.protect, viewsController.getAccount);
router.get('/mybookings', authController.protect, viewsController.getMyTours);


module.exports = router;