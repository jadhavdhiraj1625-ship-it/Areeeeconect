const Taluka = require('../models/Taluka');
const Surveyor = require('../models/Surveyor');
const Candidate = require('../models/Candidate');

// Default starter talukas if none exist
const DEFAULT_TALUKAS = [
  { name: 'chopda', displayName: 'Chopda', node: 'Chopda', maxCapacity: 3, coordinates: { lat: 21.2, lng: 75.5 } },
  { name: 'thalner', displayName: 'Thalner', node: 'Thalner', maxCapacity: 3, coordinates: { lat: 21.0, lng: 75.0 } },
  { name: 'shirpur', displayName: 'Shirpur', node: 'Shirpur', maxCapacity: 3, coordinates: { lat: 21.5, lng: 75.3 } },
  { name: 'jalgaon', displayName: 'Jalgaon', node: 'Jalgaon', maxCapacity: 3, coordinates: { lat: 21.0, lng: 75.4 } },
  { name: 'jamner', displayName: 'Jamner', node: 'Jamner', maxCapacity: 3, coordinates: { lat: 20.8, lng: 75.8 } },
  { name: 'pachora', displayName: 'Pachora', node: 'Pachora', maxCapacity: 3, coordinates: { lat: 20.6, lng: 75.3 } }
];

/**
 * @desc    Get all active talukas with live active surveyor counts and waiting queues
 * @route   GET /api/talukas
 * @access  Public / Authenticated
 */
const getTalukas = async (req, res) => {
  try {
    let talukas = await Taluka.find({ isActive: true }).sort({ name: 1 });

    // Seed defaults if collection is empty
    if (talukas.length === 0) {
      talukas = await Taluka.insertMany(DEFAULT_TALUKAS);
    }

    // Enrich with live active surveyor counts and waiting queue counts
    const enriched = await Promise.all(talukas.map(async (t) => {
      const activeCount = await Surveyor.countDocuments({
        taluka: t.name,
        status: { $in: ['available', 'assigned', 'busy'] }
      });

      const waitingCount = await Candidate.countDocuments({
        preferredTaluka: t.name,
        applicationStatus: 'waiting'
      });

      return {
        _id: t._id,
        name: t.name,
        displayName: t.displayName || t.name.charAt(0).toUpperCase() + t.name.slice(1),
        node: t.node,
        maxCapacity: t.maxCapacity || 3,
        activeSurveyors: activeCount,
        availableSlots: Math.max(0, (t.maxCapacity || 3) - activeCount),
        waitingCount,
        coordinates: t.coordinates,
        isActive: t.isActive
      };
    }));

    // Deduplicate by normalized name (Requirement 10)
    const seen = new Set();
    const uniqueTalukas = [];
    for (const t of enriched) {
      const normName = (t.name || '').toLowerCase().trim();
      if (!seen.has(normName)) {
        seen.add(normName);
        uniqueTalukas.push(t);
      }
    }

    return res.status(200).json({
      success: true,
      count: uniqueTalukas.length,
      talukas: uniqueTalukas
    });
  } catch (error) {
    console.error('Get talukas error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving talukas list'
    });
  }
};

/**
 * @desc    Create a new Taluka (Admin only)
 * @route   POST /api/admin/talukas
 * @access  Private (Admin only)
 */
const createTaluka = async (req, res) => {
  try {
    const { name, displayName, node, maxCapacity, coordinates } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Taluka name is required' });
    }

    const cleanName = name.toLowerCase().trim();
    const cleanDisplayName = (displayName || cleanName.charAt(0).toUpperCase() + cleanName.slice(1)).trim();
    const cleanNode = (node || cleanDisplayName).trim();
    const capacityNum = maxCapacity !== undefined ? Number(maxCapacity) : 3;

    const existing = await Taluka.findOne({ name: cleanName });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Taluka ' + cleanDisplayName + ' already exists'
      });
    }

    const taluka = await Taluka.create({
      name: cleanName,
      displayName: cleanDisplayName,
      node: cleanNode,
      maxCapacity: capacityNum > 0 ? capacityNum : 3,
      coordinates: coordinates || { lat: 21.0, lng: 75.0 },
      isActive: true
    });

    return res.status(201).json({
      success: true,
      message: 'Taluka ' + cleanDisplayName + ' created successfully',
      taluka: {
        _id: taluka._id,
        name: taluka.name,
        displayName: taluka.displayName,
        node: taluka.node,
        maxCapacity: taluka.maxCapacity,
        activeSurveyors: 0,
        availableSlots: taluka.maxCapacity,
        waitingCount: 0
      }
    });
  } catch (error) {
    console.error('Create taluka error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error creating new taluka: ' + error.message
    });
  }
};

module.exports = {
  getTalukas,
  createTaluka
};
