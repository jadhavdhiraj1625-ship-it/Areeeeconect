const Surveyor = require('../models/Surveyor');
const User = require('../models/User');
const Farm = require('../models/Farm');
const { generateNextEmployeeId, getActiveSurveyorCount, getTalukaMaxCapacity, processTalukaWaitingQueue } = require('../utils/queueManager');

/**
 * @desc    Get list of surveyors with mandatory taluka filtering for Farmers
 * @route   GET /api/surveyors
 * @access  Private (Authenticated)
 */
const getSurveyors = async (req, res) => {
  try {
    const { taluka, status, baseStation, farmId } = req.query;
    const userRole = (req.user?.role || '').toLowerCase();

    const filter = {};

    // ── Phase 8 Enforcement: Farmer MUST ONLY see Surveyors from their assigned Taluka ──
    if (userRole === 'farmer') {
      let farmerTaluka = (req.user.taluka || '').toLowerCase().trim();

      // If farmId is supplied, verify ownership and check farm's taluka
      if (farmId) {
        const farm = await Farm.findById(farmId);
        if (farm && farm.farmerId.toString() === req.user._id.toString() && farm.taluka) {
          farmerTaluka = farm.taluka.toLowerCase().trim();
        }
      }

      // Backend strictly forces farmer's own taluka, preventing cross-taluka parameter tampering
      filter.taluka = farmerTaluka;
      
      // Farmers only see active/available surveyors
      filter.status = 'available';
    } else {
      // Non-farmers (Admins, Surveyors) can filter by taluka or status
      if (taluka && typeof taluka === 'string') {
        filter.taluka = taluka.toLowerCase().trim();
      }

      if (status && typeof status === 'string') {
        filter.status = status.toLowerCase().trim();
      }
    }

    if (baseStation && typeof baseStation === 'string') {
      filter.baseStation = new RegExp('^' + baseStation.trim() + '$', 'i');
    }

    const surveyors = await Surveyor.find(filter)
      .populate('userId', 'name email mobile taluka village')
      .select('-__v')
      .sort({ rating: -1, jobsCompleted: -1 });

    return res.status(200).json({
      success: true,
      count: surveyors.length,
      surveyors
    });
  } catch (error) {
    console.error('Get surveyors error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving surveyors list'
    });
  }
};

/**
 * @desc    Get single surveyor by ID
 * @route   GET /api/surveyors/:id
 * @access  Private (Authenticated)
 */
const getSurveyorById = async (req, res) => {
  try {
    const { id } = req.params;

    let surveyor = await Surveyor.findById(id).populate('userId', 'name email mobile taluka village');

    if (!surveyor) {
      surveyor = await Surveyor.findOne({ employeeId: id }).populate('userId', 'name email mobile taluka village');
    }

    if (!surveyor) {
      return res.status(404).json({
        success: false,
        message: 'Surveyor not found'
      });
    }

    return res.status(200).json({
      success: true,
      surveyor
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Surveyor not found'
      });
    }
    console.error('Get surveyor by id error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving surveyor details'
    });
  }
};

/**
 * @desc    Update surveyor status (available, assigned, busy, inactive, resigned)
 * @route   PUT /api/surveyors/:id/status
 * @access  Private (Surveyor or Admin)
 */
const updateSurveyorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['available', 'assigned', 'busy', 'inactive', 'resigned'];
    const normalizedStatus = String(status || '').toLowerCase().trim();

    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: [${allowedStatuses.join(', ')}]`
      });
    }

    let surveyor = await Surveyor.findById(id);
    if (!surveyor) {
      surveyor = await Surveyor.findOne({ userId: req.user._id });
    }

    if (!surveyor) {
      return res.status(404).json({
        success: false,
        message: 'Surveyor record not found'
      });
    }

    // Role & Ownership check
    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';
    const isOwner = surveyor.userId.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only update your own surveyor status'
      });
    }

    const previousStatus = surveyor.status;
    const targetTaluka = surveyor.taluka;

    // Rule 2 & 3: Check max 3 active capacity if moving from inactive/resigned back to active
    const isBecomingActive = ['available', 'assigned', 'busy'].includes(normalizedStatus);
    const wasInactive = ['inactive', 'resigned'].includes(previousStatus);

    if (isBecomingActive && wasInactive) {
      const activeCount = await getActiveSurveyorCount(targetTaluka);
      const maxCap = await getTalukaMaxCapacity(targetTaluka);
      if (activeCount >= maxCap) {
        return res.status(400).json({
          success: false,
          message: `Cannot activate surveyor: Taluka '${targetTaluka}' already has the maximum of ${maxCap} active surveyors.`
        });
      }
    }

    surveyor.status = normalizedStatus;
    await surveyor.save();

    // Rule 16: If surveyor resigned, their active slot opens up -> Process FIFO waiting queue!
    if (normalizedStatus === 'resigned') {
      await processTalukaWaitingQueue(targetTaluka);
    }

    return res.status(200).json({
      success: true,
      message: `Surveyor status updated to ${normalizedStatus}`,
      surveyor
    });
  } catch (error) {
    console.error('Update surveyor status error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating surveyor status'
    });
  }
};

/**
 * @desc    Create a new surveyor (Admin only, enforces max 3 active limit)
 * @route   POST /api/surveyors
 * @access  Private (Admin only)
 */
const createSurveyor = async (req, res) => {
  try {
    const {
      name,
      mobile,
      email,
      password,
      employeeId,
      baseStation,
      taluka,
      status,
      rating
    } = req.body;

    // 1. Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Surveyor name is required' });
    }
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile/login ID is required' });
    }

    const cleanMobile = String(mobile).trim();
    const cleanEmail = (email || `${cleanMobile}@agriconnect.in`).toLowerCase().trim();
    const cleanTaluka = (taluka || 'chopda').toLowerCase().trim();
    const cleanBase = (baseStation || cleanTaluka.charAt(0).toUpperCase() + cleanTaluka.slice(1)).trim();
    const targetStatus = (status || 'available').toLowerCase().trim();

    // Rule 2 & 3: Check maximum active surveyors limit for this taluka
    if (['available', 'assigned', 'busy'].includes(targetStatus)) {
      const activeCount = await getActiveSurveyorCount(cleanTaluka);
      const maxCap = await getTalukaMaxCapacity(cleanTaluka);
      if (activeCount >= maxCap) {
        return res.status(400).json({
          success: false,
          message: `Cannot create active surveyor: Taluka '${cleanTaluka}' already has the maximum of ${maxCap} active surveyors.`
        });
      }
    }

    // Generate or use employee ID
    let empId = employeeId ? String(employeeId).trim() : await generateNextEmployeeId();

    // 2. Check if employeeId is already taken
    const existingEmp = await Surveyor.findOne({ employeeId: empId });
    if (existingEmp) {
      return res.status(409).json({
        success: false,
        message: `Surveyor with Employee ID '${empId}' already exists`
      });
    }

    // 3. Find or Create User document with role: 'surveyor'
    let user = await User.findOne({
      $or: [{ mobile: cleanMobile }, { email: cleanEmail }]
    });

    if (user) {
      const existingProfile = await Surveyor.findOne({ userId: user._id });
      if (existingProfile) {
        return res.status(409).json({
          success: false,
          message: `User '${cleanMobile}' is already registered as a surveyor with ID '${existingProfile.employeeId}'`
        });
      }
      user.role = 'surveyor';
      user.taluka = cleanTaluka;
      user.name = name.trim();
      await user.save();
    } else {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password || 'password123', salt);
      user = await User.create({
        name: name.trim(),
        mobile: cleanMobile,
        email: cleanEmail,
        passwordHash,
        role: 'surveyor',
        taluka: cleanTaluka,
        status: 'active'
      });
    }

    // 4. Create Surveyor Profile linked to user
    const surveyor = await Surveyor.create({
      userId: user._id,
      employeeId: empId,
      name: name.trim(),
      baseStation: cleanBase,
      taluka: cleanTaluka,
      status: targetStatus,
      rating: rating !== undefined ? Number(rating) : 5.0,
      jobsCompleted: 0
    });

    return res.status(201).json({
      success: true,
      message: 'Surveyor created successfully in MongoDB Atlas',
      surveyor: {
        id: surveyor._id,
        employeeId: surveyor.employeeId,
        name: surveyor.name,
        baseStation: surveyor.baseStation,
        taluka: surveyor.taluka,
        status: surveyor.status,
        rating: surveyor.rating,
        jobsCompleted: surveyor.jobsCompleted,
        userId: user._id,
        userMobile: user.mobile
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate key conflict: mobile, email, or employee ID already in use'
      });
    }
    console.error('Create surveyor error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error creating surveyor: ' + error.message
    });
  }
};

/**
 * @desc    Submit a Taluka transfer request (Surveyor only)
 * @route   POST /api/surveyors/transfer-request
 * @access  Private (Surveyor only)
 */
const requestTransfer = async (req, res) => {
  try {
    const { targetTaluka, reason } = req.body;

    if (!targetTaluka || !targetTaluka.trim()) {
      return res.status(400).json({ success: false, message: 'Target destination taluka is required' });
    }

    const surveyor = await Surveyor.findOne({ userId: req.user._id });
    if (!surveyor) {
      return res.status(404).json({ success: false, message: 'Surveyor profile not found' });
    }

    const cleanTarget = targetTaluka.toLowerCase().trim();
    if (cleanTarget === surveyor.taluka.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'You are already assigned to this taluka' });
    }

    // Check for existing pending request
    const existingReq = await TransferRequest.findOne({
      surveyorId: surveyor._id,
      status: 'pending'
    });

    if (existingReq) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending transfer request awaiting Admin approval'
      });
    }

    const transferReq = await TransferRequest.create({
      surveyorId: surveyor._id,
      currentTaluka: surveyor.taluka,
      targetTaluka: cleanTarget,
      reason: reason ? reason.trim() : '',
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Transfer request submitted successfully. Awaiting Admin review.',
      transferRequest: transferReq
    });
  } catch (error) {
    console.error('Transfer request error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error submitting transfer request'
    });
  }
};

module.exports = {
  getSurveyors,
  getSurveyorById,
  updateSurveyorStatus,
  createSurveyor,
  requestTransfer
};
