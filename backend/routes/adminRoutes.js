const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getCandidates,
  getCandidateById,
  updateCandidate,
  getTransferRequests,
  reviewTransferRequest,
  getSurveyors,
  getBookings,
  getFarms,
  getUsers,
  getPayments
} = require('../controllers/adminController');
const { getTalukas, createTaluka } = require('../controllers/talukaController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All admin routes require authentication and admin role
router.use(protect);
router.use(requireRole('admin'));

router.get('/dashboard', getDashboard);
router.get('/candidates', getCandidates);
router.get('/candidates/:id', getCandidateById);
router.put('/candidates/:id', updateCandidate);
router.get('/transfer-requests', getTransferRequests);
router.put('/transfer-requests/:id', reviewTransferRequest);
router.get('/surveyors', getSurveyors);
router.get('/bookings', getBookings);
router.get('/farms', getFarms);
router.get('/users', getUsers);
router.get('/payments', getPayments);
router.get('/talukas', getTalukas);
router.post('/talukas', createTaluka);

module.exports = router;
