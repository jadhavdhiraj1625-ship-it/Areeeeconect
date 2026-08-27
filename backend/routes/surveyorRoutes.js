const express = require('express');
const router = express.Router();
const {
  getSurveyors,
  getSurveyorById,
  updateSurveyorStatus,
  createSurveyor,
  requestTransfer
} = require('../controllers/surveyorController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All surveyor routes require authentication
router.use(protect);

router.get('/', getSurveyors);
router.post('/transfer-request', requireRole('surveyor'), requestTransfer);
router.get('/:id', getSurveyorById);
router.post('/', requireRole('admin'), createSurveyor);
router.put('/:id/status', requireRole('surveyor', 'admin'), updateSurveyorStatus);

module.exports = router;
