const mongoose = require('mongoose');
const User = require('../models/User');
const Farm = require('../models/Farm');
const Surveyor = require('../models/Surveyor');
const Booking = require('../models/Booking');
const Candidate = require('../models/Candidate');
const TransferRequest = require('../models/TransferRequest');
const Payment = require('../models/Payment');
const { generateNextEmployeeId, getActiveSurveyorCount, getTalukaMaxCapacity, processTalukaWaitingQueue } = require('../utils/queueManager');

/**
 * @desc    Get system-wide dashboard aggregate statistics
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin only)
 */
const getDashboard = async (req, res) => {
  try {
    let totalUsers = 0, totalFarmers = 0, totalSurveyors = 0, totalCandidates = 0;
    let totalFarms = 0, totalBookings = 0, completedBookings = 0, pendingCandidates = 0;
    let totalPayments = 0, totalRevenue = 0;

    try {
      const [
        uCount,
        fCount,
        sCount,
        cCount,
        farmCount,
        bCount,
        compBCount,
        pCandCount,
        payments
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'farmer' }),
        Surveyor.countDocuments(),
        Candidate.countDocuments(),
        Farm.countDocuments(),
        Booking.countDocuments(),
        Booking.countDocuments({ status: { $in: ['Completed', 'Paid'] } }),
        Candidate.countDocuments({ applicationStatus: { $in: ['applied', 'under_review', 'document_verification', 'test_scheduled', 'interview_scheduled', 'waiting'] } }),
        Payment.find({ status: 'paid' })
      ]);

      totalUsers = uCount;
      totalFarmers = fCount;
      totalSurveyors = sCount;
      totalCandidates = cCount;
      totalFarms = farmCount;
      totalBookings = bCount;
      completedBookings = compBCount;
      pendingCandidates = pCandCount;
      totalPayments = payments.length;
      totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    } catch (queryErr) {
      console.warn('Dashboard count query fallback:', queryErr.message);
    }

    const statsObj = {
      totalUsers,
      totalFarmers,
      totalSurveyors,
      totalCandidates,
      totalFarms,
      totalBookings,
      completedBookings,
      pendingCandidates,
      totalPayments,
      totalRevenue
    };

    return res.status(200).json({
      success: true,
      stats: statsObj,
      dashboard: statsObj
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving dashboard metrics'
    });
  }
};

/**
 * @desc    Get candidates list with filtering
 * @route   GET /api/admin/candidates
 * @access  Private (Admin only)
 */
const getCandidates = async (req, res) => {
  try {
    const { status, taluka, qualification } = req.query;
    const filter = {};

    if (status && typeof status === 'string') {
      filter.applicationStatus = status.toLowerCase().trim();
    }

    if (taluka && typeof taluka === 'string') {
      filter.preferredTaluka = taluka.toLowerCase().trim();
    }

    if (qualification && typeof qualification === 'string') {
      filter.qualification = new RegExp(qualification.trim(), 'i');
    }

    const candidates = await Candidate.find(filter)
      .populate('userId', 'name email mobile taluka status')
      .sort({ qualifiedAt: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: candidates.length,
      candidates
    });
  } catch (error) {
    console.error('Admin get candidates error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving candidate applications'
    });
  }
};

/**
 * @desc    Get candidate by ID
 * @route   GET /api/admin/candidates/:id
 * @access  Private (Admin only)
 */
const getCandidateById = async (req, res) => {
  try {
    const { id } = req.params;

    const candidate = await Candidate.findById(id).populate('userId', 'name email mobile taluka status');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate application not found'
      });
    }

    return res.status(200).json({
      success: true,
      candidate
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    console.error('Admin get candidate by id error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving candidate details'
    });
  }
};

/**
 * @desc    Update candidate administrative evaluation & recruitment progression
 * @route   PUT /api/admin/candidates/:id
 * @access  Private (Admin only)
 */
const updateCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      applicationStatus,
      interviewScore,
      backgroundCheck,
      employeeId,
      interviewSchedule,
      testDetails
    } = req.body;

    const candidate = await Candidate.findById(id);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate application not found'
      });
    }

    // 1. Handle Document Verification / Test Date Auto-Generation (Rule 7)
    if (applicationStatus === 'test_scheduled' || applicationStatus === 'document_verification') {
      candidate.applicationStatus = 'test_scheduled';
      
      // Auto-schedule test date 3 days from now at 10:00 AM if not set
      if (!candidate.testDetails?.testDate) {
        const testDate = new Date();
        testDate.setDate(testDate.getDate() + 3);
        candidate.testDetails = {
          testDate: testDetails?.testDate || testDate.toISOString().split('T')[0],
          testTime: testDetails?.testTime || '10:00 AM',
          testStatus: 'scheduled',
          testScore: null
        };
      }
    } else if (applicationStatus) {
      const allowedStatuses = [
        'applied',
        'under_review',
        'document_verification',
        'test_scheduled',
        'test_passed',
        'test_failed',
        'interview_scheduled',
        'interview_passed',
        'selected',
        'waiting',
        'hired',
        'rejected',
        'bg_failed'
      ];
      let normalizedStatus = applicationStatus.toLowerCase().trim();
      if (normalizedStatus === 'interview') normalizedStatus = 'interview_scheduled';
      if (normalizedStatus === 'active') normalizedStatus = 'hired';
      if (normalizedStatus === 'passed') normalizedStatus = 'selected';
      if (normalizedStatus === 'interview pending') normalizedStatus = 'interview_scheduled';

      if (!allowedStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status ' + applicationStatus + '. Allowed: [' + allowedStatuses.join(', ') + ']'
        });
      }
      candidate.applicationStatus = normalizedStatus;
    }

    if (interviewScore !== undefined && interviewScore !== null) {
      const score = Number(interviewScore);
      if (isNaN(score) || score < 0 || score > 100) {
        return res.status(400).json({
          success: false,
          message: 'Interview score must be between 0 and 100'
        });
      }
      candidate.interviewScore = score;
    }

    if (backgroundCheck && typeof backgroundCheck === 'object') {
      candidate.backgroundCheck = {
        status: backgroundCheck.status || candidate.backgroundCheck.status || 'pending',
        verifiedAt: backgroundCheck.verifiedAt || new Date(),
        notes: backgroundCheck.notes || ''
      };
    }

    if (employeeId) {
      candidate.employeeId = employeeId.trim();
    }

    if (interviewSchedule && typeof interviewSchedule === 'object') {
      candidate.interviewSchedule = {
        date: interviewSchedule.date || candidate.interviewSchedule?.date || '',
        time: interviewSchedule.time || candidate.interviewSchedule?.time || '',
        meetingLink: interviewSchedule.meetingLink || candidate.interviewSchedule?.meetingLink || ''
      };
    }

    // 2. Rule 9, 13, 14, 15: Selection & Taluka Capacity Check
    const targetTaluka = (candidate.preferredTaluka || 'chopda').toLowerCase().trim();
    const isSelected = candidate.applicationStatus === 'selected' || candidate.applicationStatus === 'hired';

    if (isSelected) {
      // Check background check and interview score
      if (candidate.backgroundCheck.status === 'failed') {
        candidate.applicationStatus = 'bg_failed';
      } else if (candidate.interviewScore !== null && candidate.interviewScore < 70) {
        candidate.applicationStatus = 'rejected';
      } else {
        // Candidate passed all required stages!
        candidate.qualifiedAt = candidate.qualifiedAt || new Date();

        // Check active capacity in target taluka (max capacity: available + assigned + busy)
        const activeCount = await getActiveSurveyorCount(targetTaluka);
        const maxCap = await getTalukaMaxCapacity(targetTaluka);

        if (activeCount < maxCap) {
          // Direct activation in Taluka
          const empId = candidate.employeeId || await generateNextEmployeeId();
          candidate.employeeId = empId;
          candidate.applicationStatus = 'hired';

          if (candidate.userId) {
            await User.findByIdAndUpdate(candidate.userId, {
              role: 'surveyor',
              taluka: targetTaluka
            });

            const baseStationVal = targetTaluka.charAt(0).toUpperCase() + targetTaluka.slice(1);
            let surveyor = await Surveyor.findOne({ userId: candidate.userId });

            if (!surveyor) {
              await Surveyor.create({
                userId: candidate.userId,
                employeeId: empId,
                name: candidate.fullName,
                baseStation: baseStationVal,
                taluka: targetTaluka,
                status: 'available',
                rating: candidate.interviewScore ? Math.min(5.0, Math.max(4.0, (candidate.interviewScore / 20))) : 5.0,
                jobsCompleted: 0
              });
            } else {
              surveyor.status = 'available';
              surveyor.employeeId = empId;
              surveyor.taluka = targetTaluka;
              surveyor.baseStation = baseStationVal;
              await surveyor.save();
            }
          }
        } else {
          // Taluka is at full capacity (3 active surveyors) -> Place candidate in FIFO waiting queue (Rule 14 & 15)
          candidate.applicationStatus = 'waiting';
          console.log('ℹ️ [Taluka Full] Candidate ' + candidate.fullName + ' qualified but Taluka ' + targetTaluka + ' is at capacity (3 active). Placed in FIFO waiting queue.');
        }
      }
    }

    const saved = await candidate.save();

    return res.status(200).json({
      success: true,
      message: candidate.applicationStatus === 'waiting'
        ? 'Candidate qualified successfully. Taluka ' + targetTaluka + ' is at full capacity (3/3). Candidate placed in FIFO waiting queue.'
        : 'Candidate administrative record updated successfully',
      candidate: saved
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    console.error('Admin update candidate error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating candidate record: ' + error.message
    });
  }
};

/**
 * @desc    Get all transfer requests across platform
 * @route   GET /api/admin/transfer-requests
 * @access  Private (Admin only)
 */
const getTransferRequests = async (req, res) => {
  try {
    const requests = await TransferRequest.find()
      .populate({
        path: 'surveyorId',
        select: 'name employeeId taluka baseStation status rating jobsCompleted',
        populate: { path: 'userId', select: 'name email mobile' }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      transferRequests: requests
    });
  } catch (error) {
    console.error('Get transfer requests error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving transfer requests'
    });
  }
};

/**
 * @desc    Review/Approve/Reject a surveyor transfer request (Capacity-safe)
 * @route   PUT /api/admin/transfer-requests/:id
 * @access  Private (Admin only)
 */
const reviewTransferRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNotes } = req.body; // action: 'approve' | 'reject'

    const transferReq = await TransferRequest.findById(id).populate('surveyorId');
    if (!transferReq) {
      return res.status(404).json({ success: false, message: 'Transfer request not found' });
    }

    if (transferReq.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Transfer request has already been ' + transferReq.status
      });
    }

    if (action === 'reject') {
      transferReq.status = 'rejected';
      transferReq.adminNotes = adminNotes || 'Transfer request rejected by Admin';
      transferReq.reviewedBy = req.user._id;
      transferReq.reviewedAt = new Date();
      await transferReq.save();

      return res.status(200).json({
        success: true,
        message: 'Transfer request rejected',
        transferRequest: transferReq
      });
    }

    if (action === 'approve') {
      const surveyor = transferReq.surveyorId;
      if (!surveyor) {
        return res.status(404).json({ success: false, message: 'Surveyor profile not found' });
      }

      const destTaluka = transferReq.targetTaluka.toLowerCase().trim();
      const oldTaluka = surveyor.taluka.toLowerCase().trim();

      // Rule 4 & 17: Destination capacity check (must be < maxCap active)
      const destActiveCount = await getActiveSurveyorCount(destTaluka);
      const destMaxCap = await getTalukaMaxCapacity(destTaluka);
      if (destActiveCount >= destMaxCap) {
        return res.status(400).json({
          success: false,
          message: `Cannot approve transfer: Destination Taluka ${destTaluka} is already at maximum capacity (${destMaxCap} active surveyors).`
        });
      }

      // Update surveyor taluka and base station
      const destBase = destTaluka.charAt(0).toUpperCase() + destTaluka.slice(1);
      surveyor.taluka = destTaluka;
      surveyor.baseStation = destBase;
      await surveyor.save();

      // Update user taluka
      if (surveyor.userId) {
        await User.findByIdAndUpdate(surveyor.userId, { taluka: destTaluka });
      }

      transferReq.status = 'approved';
      transferReq.adminNotes = adminNotes || 'Transfer approved by Admin';
      transferReq.reviewedBy = req.user._id;
      transferReq.reviewedAt = new Date();
      await transferReq.save();

      // Rule 16 & 17: Old taluka vacancy opened up -> Process FIFO queue in old taluka!
      await processTalukaWaitingQueue(oldTaluka);

      return res.status(200).json({
        success: true,
        message: 'Transfer approved! Surveyor ' + surveyor.name + ' moved from ' + oldTaluka + ' to ' + destTaluka + '. Old taluka FIFO queue processed.',
        transferRequest: transferReq,
        surveyor
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be "approve" or "reject"'
    });
  } catch (error) {
    console.error('Review transfer request error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error reviewing transfer request: ' + error.message
    });
  }
};

/**
 * @desc    Get all surveyors across district for Admin inspection
 * @route   GET /api/admin/surveyors
 * @access  Private (Admin only)
 */
const getSurveyors = async (req, res) => {
  try {
    const surveyors = await Surveyor.find()
      .populate('userId', 'name email mobile taluka village status')
      .sort({ rating: -1, jobsCompleted: -1 });

    return res.status(200).json({
      success: true,
      count: surveyors.length,
      surveyors
    });
  } catch (error) {
    console.error('Admin get surveyors error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving surveyors'
    });
  }
};

/**
 * @desc    Get all bookings across platform with filters
 * @route   GET /api/admin/bookings
 * @access  Private (Admin only)
 */
const getBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status && typeof status === 'string') {
      filter.status = status.trim();
    }

    const bookings = await Booking.find(filter)
      .populate('farmerId', 'name email mobile taluka village')
      .populate('surveyorId', 'name employeeId baseStation taluka rating')
      .populate('farmId', 'farmName village taluka acreage location')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Admin get bookings error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving bookings'
    });
  }
};

/**
 * @desc    Get all registered farm plots
 * @route   GET /api/admin/farms
 * @access  Private (Admin only)
 */
const getFarms = async (req, res) => {
  try {
    const farms = await Farm.find()
      .populate('farmerId', 'name email mobile taluka village')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: farms.length,
      farms
    });
  } catch (error) {
    console.error('Admin get farms error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving farm plots'
    });
  }
};

/**
 * @desc    Get all registered platform users (Safe sanitized projection)
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Admin get users error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving user accounts'
    });
  }
};

/**
 * @desc    Get all payment transactions and invoice records from MongoDB Atlas
 * @route   GET /api/admin/payments
 * @access  Private (Admin only)
 */
const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('farmerId', 'name email mobile taluka village')
      .populate('bookingId')
      .sort({ createdAt: -1 });

    const totalRevenue = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return res.status(200).json({
      success: true,
      count: payments.length,
      totalRevenue,
      payments
    });
  } catch (error) {
    console.error('Admin get payments error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving payments'
    });
  }
};

module.exports = {
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
};
