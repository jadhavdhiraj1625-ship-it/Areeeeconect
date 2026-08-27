const express = require('express');
const router = express.Router();
const {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  payBooking
} = require('../controllers/bookingController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All booking routes require authentication
router.use(protect);

router.post('/', requireRole('farmer'), createBooking);
router.get('/', getBookings);
router.get('/:id', getBookingById);
router.put('/:id/status', updateBookingStatus);
router.post('/:id/pay', requireRole('farmer', 'admin'), payBooking);

module.exports = router;
