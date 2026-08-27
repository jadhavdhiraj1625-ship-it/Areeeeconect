const express = require('express');
const router = express.Router();
const {
  createFarm,
  getFarms,
  getFarmById,
  updateFarm,
  deleteFarm
} = require('../controllers/farmController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// All farm routes require authentication and farmer role
router.use(protect);
router.use(requireRole('farmer'));

router.route('/')
  .post(createFarm)
  .get(getFarms);

router.route('/:id')
  .get(getFarmById)
  .put(updateFarm)
  .delete(deleteFarm);

module.exports = router;
