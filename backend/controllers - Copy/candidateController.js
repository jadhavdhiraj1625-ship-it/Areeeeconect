const Candidate = require('../models/Candidate');
const InterviewSlot = require('../models/InterviewSlot');
const User = require('../models/User');

/**
 * Helper to generate starter interview slots if none exist
 */
async function ensureInterviewSlotsExist() {
  const count = await InterviewSlot.countDocuments();
  if (count === 0) {
    const slots = [];
    const today = new Date();
    // Generate slots for next 20 days
    for (let i = 1; i <= 20; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      // Skip Sundays (0)
      if (d.getDay() === 0) continue;

      slots.push(
        { date: dateStr, time: '10:00 AM', maxCapacity: 1, bookedCount: 0, meetingLink: 'https://meet.google.com/agr-interview-slot-1' },
        { date: dateStr, time: '11:30 AM', maxCapacity: 1, bookedCount: 0, meetingLink: 'https://meet.google.com/agr-interview-slot-2' },
        { date: dateStr, time: '02:30 PM', maxCapacity: 1, bookedCount: 0, meetingLink: 'https://meet.google.com/agr-interview-slot-3' },
        { date: dateStr, time: '04:00 PM', maxCapacity: 1, bookedCount: 0, meetingLink: 'https://meet.google.com/agr-interview-slot-4' }
      );
    }
    await InterviewSlot.insertMany(slots);
  }
}

/**
 * @desc    Submit initial candidate application
 * @route   POST /api/candidates
 * @access  Private (Candidate only)
 */
const createCandidate = async (req, res) => {
  try {
    const {
      fullName,
      email,
      mobile,
      address,
      district,
      preferredTaluka,
      qualification,
      experienceYears,
      licenseId,
      documents
    } = req.body;

    const userId = req.user._id;

    // 1. Validation
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }

    const candidateEmail = (email || req.user.email || '').toLowerCase().trim();
    if (!candidateEmail) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const candidateMobile = String(mobile || req.user.mobile || '').trim();
    if (!candidateMobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    if (!preferredTaluka || !preferredTaluka.trim()) {
      return res.status(400).json({ success: false, message: 'Preferred taluka is required' });
    }

    if (!qualification || !qualification.trim()) {
      return res.status(400).json({ success: false, message: 'Qualification is required' });
    }

    const expYears = experienceYears !== undefined ? Number(experienceYears) : 0;
    if (isNaN(expYears) || expYears < 0) {
      return res.status(400).json({ success: false, message: 'Experience years cannot be negative' });
    }

    // 2. Check if candidate application already exists for this user
    const existing = await Candidate.findOne({
      $or: [{ userId }, { email: candidateEmail }]
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An application has already been submitted for this account'
      });
    }

    // 3. Security: Force initial status 'applied' and null administrative ratings
    const candidate = await Candidate.create({
      userId,
      fullName: fullName.trim(),
      email: candidateEmail,
      mobile: candidateMobile,
      address: address ? address.trim() : '',
      district: district ? district.trim() : '',
      preferredTaluka: preferredTaluka.toLowerCase().trim(),
      qualification: qualification.trim(),
      experienceYears: expYears,
      licenseId: licenseId ? licenseId.trim() : '',
      applicationStatus: 'applied',
      testDetails: {
        testDate: '',
        testTime: '',
        testStatus: 'pending',
        testScore: null
      },
      interviewSchedule: {
        date: '',
        time: '',
        meetingLink: '',
        status: 'pending'
      },
      interviewScore: null,
      backgroundCheck: { status: 'pending' },
      employeeId: null,
      documents: Array.isArray(documents) ? documents : []
    });

    return res.status(201).json({
      success: true,
      message: 'Candidate application submitted successfully',
      candidate
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('Create candidate error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error submitting candidate application'
    });
  }
};

/**
 * @desc    Get current authenticated candidate profile
 * @route   GET /api/candidates/me
 * @access  Private (Candidate only)
 */
const getMyCandidate = async (req, res) => {
  try {
    const userId = req.user._id;

    const candidate = await Candidate.findOne({ userId });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'No candidate application found for this account. Please submit an application.'
      });
    }

    return res.status(200).json({
      success: true,
      candidate
    });
  } catch (error) {
    console.error('Get my candidate error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving candidate profile'
    });
  }
};

/**
 * @desc    Get available interview slots across recruitment window
 * @route   GET /api/candidates/interview-slots
 * @access  Private (Candidate & Admin)
 */
const getInterviewSlots = async (req, res) => {
  try {
    await ensureInterviewSlotsExist();

    const todayStr = new Date().toISOString().split('T')[0];

    const slots = await InterviewSlot.find({
      date: { $gte: todayStr },
      isAvailable: true,
      $expr: { $lt: ['$bookedCount', '$maxCapacity'] }
    }).sort({ date: 1, time: 1 });

    return res.status(200).json({
      success: true,
      count: slots.length,
      slots
    });
  } catch (error) {
    console.error('Get interview slots error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving interview slots'
    });
  }
};

/**
 * @desc    Book an interview slot (Concurrency-safe atomic operation)
 * @route   POST /api/candidates/book-interview-slot
 * @access  Private (Candidate only)
 */
const bookInterviewSlot = async (req, res) => {
  try {
    const { slotId } = req.body;
    const userId = req.user._id;

    if (!slotId) {
      return res.status(400).json({ success: false, message: 'Slot ID is required' });
    }

    const candidate = await Candidate.findOne({ userId });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate profile not found' });
    }

    // Must be in interview stage or test_passed stage
    const eligibleStatuses = ['test_passed', 'interview_scheduled', 'interview'];
    if (!eligibleStatuses.includes(candidate.applicationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'You must pass the qualification test before scheduling an interview.'
      });
    }

    // Atomic update: only increments bookedCount if bookedCount < maxCapacity
    const updatedSlot = await InterviewSlot.findOneAndUpdate(
      {
        _id: slotId,
        $expr: { $lt: ['$bookedCount', '$maxCapacity'] },
        isAvailable: true
      },
      {
        $inc: { bookedCount: 1 }
      },
      {
        new: true
      }
    );

    if (!updatedSlot) {
      return res.status(409).json({
        success: false,
        message: 'Selected interview slot is no longer available or is full. Please choose another slot.'
      });
    }

    // Save schedule in Candidate record
    candidate.interviewSchedule = {
      slotId: updatedSlot._id,
      date: updatedSlot.date,
      time: updatedSlot.time,
      meetingLink: updatedSlot.meetingLink,
      status: 'scheduled'
    };
    candidate.applicationStatus = 'interview_scheduled';
    await candidate.save();

    return res.status(200).json({
      success: true,
      message: 'Interview slot successfully booked and confirmed in MongoDB Atlas',
      interviewSchedule: candidate.interviewSchedule,
      candidate
    });
  } catch (error) {
    console.error('Book interview slot error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error booking interview slot: ' + error.message
    });
  }
};

/**
 * @desc    Submit qualification test (Candidate self-submission or automated grading)
 * @route   POST /api/candidates/submit-test
 * @access  Private (Candidate only)
 */
const submitTest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { answers, score } = req.body;

    const candidate = await Candidate.findOne({ userId });
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate profile not found' });
    }

    // Calculate score
    const finalScore = score !== undefined ? Number(score) : 85;

    candidate.testDetails = {
      testDate: candidate.testDetails?.testDate || new Date().toISOString().split('T')[0],
      testTime: candidate.testDetails?.testTime || '10:00 AM',
      testStatus: finalScore >= 70 ? 'passed' : 'failed',
      testScore: finalScore
    };

    if (finalScore >= 70) {
      candidate.applicationStatus = 'test_passed';
    } else {
      candidate.applicationStatus = 'test_failed';
    }

    await candidate.save();

    return res.status(200).json({
      success: true,
      message: finalScore >= 70 ? 'Test passed! You may now select an interview slot.' : 'Test completed. Score did not meet required threshold.',
      testDetails: candidate.testDetails,
      applicationStatus: candidate.applicationStatus
    });
  } catch (error) {
    console.error('Submit test error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error submitting test: ' + error.message
    });
  }
};

/**
 * @desc    Get candidate by ID (Owner or Admin only)
 * @route   GET /api/candidates/:id
 * @access  Private
 */
const getCandidateById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = (req.user.role || '').toLowerCase();
    const userId = req.user._id;

    const candidate = await Candidate.findById(id).populate('userId', 'name email mobile taluka village');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate application not found'
      });
    }

    const candUserId = candidate.userId ? (candidate.userId._id || candidate.userId) : null;
    const isOwner = candUserId && candUserId.toString() === userId.toString();
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot view another applicant's private application"
      });
    }

    return res.status(200).json({
      success: true,
      candidate
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Candidate application not found' });
    }
    console.error('Get candidate by id error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving candidate'
    });
  }
};

module.exports = {
  createCandidate,
  getMyCandidate,
  getInterviewSlots,
  bookInterviewSlot,
  submitTest,
  getCandidateById
};
