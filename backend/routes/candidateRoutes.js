const express = require('express');
const router = express.Router();
const {
  createCandidate,
  getMyCandidate,
  getInterviewSlots,
  bookInterviewSlot,
  submitTest,
  getCandidateById
} = require('../controllers/candidateController');
const { protect, requireRole } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', requireRole('candidate'), createCandidate);
router.get('/me', requireRole('candidate'), getMyCandidate);
router.get('/interview-slots', getInterviewSlots);
router.post('/book-interview-slot', requireRole('candidate'), bookInterviewSlot);
router.post('/submit-test', requireRole('candidate'), submitTest);
router.get('/:id', getCandidateById);

module.exports = router;
