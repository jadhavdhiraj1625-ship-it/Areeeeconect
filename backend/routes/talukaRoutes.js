const express = require('express');
const router = express.Router();
const { getTalukas, createTaluka } = require('../controllers/talukaController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// Public / Authenticated list of talukas
router.get('/', getTalukas);

// Admin-only creation
router.post('/', protect, requireRole('admin'), createTaluka);

module.exports = router;
