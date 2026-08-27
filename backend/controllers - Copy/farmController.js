const Farm = require('../models/Farm');

/**
 * Helper to calculate estimated survey cost based on acreage
 * 1–3 acres: ₹1000/acre
 * 4–8 acres: ₹800/acre
 * >8 acres: ₹600/acre
 */
const calculateCost = (acreage) => {
  const a = Number(acreage);
  if (!a || a <= 0) return 0;
  if (a <= 3) return Math.ceil(a * 1000);
  if (a <= 8) return Math.ceil(a * 800);
  return Math.ceil(a * 600);
};

/**
 * Normalizes location input (string or object with lat/lng/address)
 */
const normalizeLocation = (loc) => {
  if (!loc) return {};
  if (typeof loc === 'string') return { address: loc.trim() };
  if (typeof loc === 'object') {
    const res = {};
    if (loc.address) res.address = String(loc.address).trim();
    if (loc.latitude !== undefined && loc.latitude !== null && loc.latitude !== '') {
      const lat = Number(loc.latitude);
      if (!isNaN(lat)) res.latitude = lat;
    }
    if (loc.longitude !== undefined && loc.longitude !== null && loc.longitude !== '') {
      const lng = Number(loc.longitude);
      if (!isNaN(lng)) res.longitude = lng;
    }
    return res;
  }
  return {};
};

/**
 * @desc    Create a new farm plot
 * @route   POST /api/farms
 * @access  Private (Farmer only)
 */
const createFarm = async (req, res) => {
  try {
    const { farmName, village, taluka, location, acreage, contactNumber, surveyType, estimatedCost } = req.body;

    // 1. Validation
    if (!farmName || !farmName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Farm name is required'
      });
    }

    if (!village || !village.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Village is required'
      });
    }

    const numAcreage = Number(acreage);
    if (isNaN(numAcreage) || numAcreage <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Acreage must be a positive number greater than 0'
      });
    }

    if (!surveyType || !surveyType.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Survey type is required'
      });
    }

    // 2. Format Location & Cost
    const formattedLocation = normalizeLocation(location);
    if (formattedLocation.latitude !== undefined && (formattedLocation.latitude < -90 || formattedLocation.latitude > 90)) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be between -90 and 90 degrees'
      });
    }
    if (formattedLocation.longitude !== undefined && (formattedLocation.longitude < -180 || formattedLocation.longitude > 180)) {
      return res.status(400).json({
        success: false,
        message: 'Longitude must be between -180 and 180 degrees'
      });
    }

    const computedCost = (estimatedCost !== undefined && Number(estimatedCost) >= 0)
      ? Number(estimatedCost)
      : calculateCost(numAcreage);

    // 3. Ownership & Taluka: ALWAYS derived from authenticated user JWT
    const farmerId = req.user._id;
    const farmerTaluka = (req.user.taluka || taluka || village || 'thalner').toLowerCase().trim();

    // 4. Create Farm
    const farm = await Farm.create({
      farmerId,
      farmName: farmName.trim(),
      village: village.trim(),
      taluka: farmerTaluka,
      location: formattedLocation,
      acreage: numAcreage,
      contactNumber: contactNumber ? String(contactNumber).trim() : (req.user.mobile || ''),
      surveyType: surveyType.trim(),
      estimatedCost: computedCost
    });

    return res.status(201).json({
      success: true,
      message: 'Farm created successfully',
      farm
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    console.error('Create farm error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error creating farm plot'
    });
  }
};

/**
 * @desc    Get all farms for the authenticated farmer
 * @route   GET /api/farms
 * @access  Private (Farmer only)
 */
const getFarms = async (req, res) => {
  try {
    const farmerId = req.user._id;

    const farms = await Farm.find({ farmerId })
      .select('-__v')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: farms.length,
      farms
    });
  } catch (error) {
    console.error('Get farms error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving farms'
    });
  }
};

/**
 * @desc    Get single farm by ID (Owner only)
 * @route   GET /api/farms/:id
 * @access  Private (Farmer only)
 */
const getFarmById = async (req, res) => {
  try {
    const { id } = req.params;
    const farmerId = req.user._id;
    const userRole = (req.user.role || '').toLowerCase();

    const farm = await Farm.findById(id);

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'Farm plot not found'
      });
    }

    if (farm.farmerId.toString() !== farmerId.toString() && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view this farm plot'
      });
    }

    return res.status(200).json({
      success: true,
      farm
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Farm plot not found' });
    }
    console.error('Get farm by id error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving farm plot'
    });
  }
};

/**
 * @desc    Update a farm plot (Owner only)
 * @route   PUT /api/farms/:id
 * @access  Private (Farmer only)
 */
const updateFarm = async (req, res) => {
  try {
    const { id } = req.params;
    const farmerId = req.user._id;

    const farm = await Farm.findById(id);

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'Farm plot not found'
      });
    }

    if (farm.farmerId.toString() !== farmerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot modify another farmer's plot"
      });
    }

    const { farmName, village, location, acreage, contactNumber, surveyType } = req.body;

    if (farmName) farm.farmName = farmName.trim();
    if (village) farm.village = village.trim();
    if (contactNumber) farm.contactNumber = String(contactNumber).trim();
    if (surveyType) farm.surveyType = surveyType.trim();

    if (acreage !== undefined) {
      const numAcreage = Number(acreage);
      if (isNaN(numAcreage) || numAcreage <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Acreage must be a positive number greater than 0'
        });
      }
      farm.acreage = numAcreage;
      farm.estimatedCost = calculateCost(numAcreage);
    }

    if (location) {
      farm.location = normalizeLocation(location);
    }

    const updatedFarm = await farm.save();

    return res.status(200).json({
      success: true,
      message: 'Farm plot updated successfully',
      farm: updatedFarm
    });
  } catch (error) {
    console.error('Update farm error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating farm plot'
    });
  }
};

/**
 * @desc    Delete a farm plot (Owner only)
 * @route   DELETE /api/farms/:id
 * @access  Private (Farmer only)
 */
const deleteFarm = async (req, res) => {
  try {
    const { id } = req.params;
    const farmerId = req.user._id;

    const farm = await Farm.findById(id);

    if (!farm) {
      return res.status(404).json({
        success: false,
        message: 'Farm plot not found'
      });
    }

    if (farm.farmerId.toString() !== farmerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot delete another farmer's plot"
      });
    }

    await Farm.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Farm plot deleted successfully'
    });
  } catch (error) {
    console.error('Delete farm error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting farm plot'
    });
  }
};

module.exports = {
  createFarm,
  getFarms,
  getFarmById,
  updateFarm,
  deleteFarm
};
