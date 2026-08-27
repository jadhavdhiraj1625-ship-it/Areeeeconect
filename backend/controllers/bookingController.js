const Booking = require('../models/Booking');
const Farm = require('../models/Farm');
const Surveyor = require('../models/Surveyor');
const Payment = require('../models/Payment');
const SurveyReport = require('../models/SurveyReport');
const { calculateBookingCost, findNearestAvailableSurveyor } = require('../utils/dijkstra');

/**
 * Valid state transitions for the booking lifecycle
 */
const VALID_TRANSITIONS = {
  Assigned: ['Accepted', 'Cancelled'],
  Accepted: ['Completed', 'Cancelled'],
  Completed: ['Paid'],
  Paid: [],
  Cancelled: []
};

/**
 * @desc    Create a new survey booking
 * @route   POST /api/bookings
 * @access  Private (Farmer only)
 */
const createBooking = async (req, res) => {
  try {
    const {
      farmId,
      surveyType,
      area,
      appointmentDate,
      appointmentTime,
      preparationInstructions,
      preferredSurveyorId,
      village
    } = req.body;

    const farmerId = req.user._id;
    const farmerTaluka = (req.user.taluka || '').toLowerCase().trim();

    // 1. Verify Farm & Ownership
    let targetVillage = village || 'Thalner';
    let targetTaluka = farmerTaluka || 'thalner';
    let bookingArea = Number(area);

    if (farmId) {
      const farm = await Farm.findById(farmId);
      if (!farm) {
        return res.status(404).json({
          success: false,
          message: 'Specified farm plot not found'
        });
      }

      if (farm.farmerId.toString() !== farmerId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not own the specified farm plot'
        });
      }

      if (!bookingArea || isNaN(bookingArea)) {
        bookingArea = farm.acreage;
      }
      if (farm.village) targetVillage = farm.village;
      if (farm.taluka) targetTaluka = farm.taluka.toLowerCase().trim();
    }

    if (!bookingArea || isNaN(bookingArea) || bookingArea <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid positive acreage is required for booking'
      });
    }

    // 2. Authoritative Backend Cost Calculation (prevents client price tampering)
    const authoritativeCost = calculateBookingCost(bookingArea);

    // 3. Rule 1, 3, 10: Surveyor Assignment Logic (Strict Taluka Matching + Availability + Dijkstra)
    let assignedSurveyor = null;
    let computedDistance = 15;

    if (preferredSurveyorId) {
      assignedSurveyor = await Surveyor.findById(preferredSurveyorId);
      if (!assignedSurveyor) {
        return res.status(404).json({
          success: false,
          message: 'Preferred surveyor not found'
        });
      }

      // Check taluka matching
      if (assignedSurveyor.taluka.toLowerCase().trim() !== targetTaluka) {
        return res.status(400).json({
          success: false,
          message: `Cannot book surveyor: Surveyor is assigned to '${assignedSurveyor.taluka}', but your farm is in '${targetTaluka}'. Surveyors can only accept jobs within their assigned Taluka.`
        });
      }

      // Check availability
      if (assignedSurveyor.status !== 'available') {
        return res.status(400).json({
          success: false,
          message: `Preferred surveyor '${assignedSurveyor.name}' is currently ${assignedSurveyor.status} and cannot take new assignments.`
        });
      }
    }

    if (!assignedSurveyor) {
      // Find available certified surveyors in the SAME Taluka only
      const availableTalukaSurveyors = await Surveyor.find({
        taluka: targetTaluka,
        status: 'available'
      });

      if (!availableTalukaSurveyors || availableTalukaSurveyors.length === 0) {
        return res.status(400).json({
          success: false,
          message: `No available surveyors found in taluka '${targetTaluka}'. Please try again later.`
        });
      }

      const nearestResult = findNearestAvailableSurveyor(targetVillage, availableTalukaSurveyors);
      assignedSurveyor = nearestResult.surveyor;
      computedDistance = nearestResult.distance;
    }

    let surveyorIdRef = null;
    if (assignedSurveyor) {
      surveyorIdRef = assignedSurveyor._id;
      assignedSurveyor.status = 'assigned';
      await assignedSurveyor.save();
    }

    // 4. Create Booking Document
    // 4. Create Booking Document (Initial state is Assigned; appointmentDate & appointmentTime are null until manually set by surveyor)
    const booking = await Booking.create({
      farmerId,
      surveyorId: surveyorIdRef,
      farmId: farmId || null,
      surveyType: surveyType || 'Boundary Tally',
      area: bookingArea,
      cost: authoritativeCost,
      distance: computedDistance,
      status: 'Assigned',
      appointmentDate: null,
      appointmentTime: null,
      preparationInstructions: ''
    });

    return res.status(201).json({
      success: true,
      message: 'Survey booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Create booking error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error creating survey booking: ' + error.message
    });
  }
};

/**
 * @desc    Get bookings (role-filtered for Farmer, Surveyor, or Admin)
 * @route   GET /api/bookings
 * @access  Private (Authenticated)
 */
const getBookings = async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const userId = req.user._id;
    const filter = {};

    if (userRole === 'farmer') {
      filter.farmerId = userId;
    } else if (userRole === 'surveyor') {
      const surveyorProfile = await Surveyor.findOne({ userId });
      if (!surveyorProfile) {
        return res.status(200).json({ success: true, count: 0, bookings: [] });
      }
      filter.surveyorId = surveyorProfile._id;
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
    console.error('Get bookings error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving bookings'
    });
  }
};

/**
 * @desc    Get single booking by ID (Tenant isolated)
 * @route   GET /api/bookings/:id
 * @access  Private (Authenticated)
 */
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = (req.user.role || '').toLowerCase();
    const userId = req.user._id;

    const booking = await Booking.findById(id)
      .populate('farmerId', 'name email mobile taluka village')
      .populate('surveyorId', 'name employeeId baseStation taluka rating')
      .populate('farmId', 'farmName village taluka acreage location');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (userRole === 'farmer') {
      const bFarmerId = booking.farmerId ? (booking.farmerId._id || booking.farmerId) : null;
      if (!bFarmerId || bFarmerId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to view this booking'
        });
      }
    } else if (userRole === 'surveyor') {
      const surveyorProfile = await Surveyor.findOne({ userId });
      const bSurveyorId = booking.surveyorId ? (booking.surveyorId._id || booking.surveyorId) : null;
      if (!surveyorProfile || !bSurveyorId || bSurveyorId.toString() !== surveyorProfile._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not assigned to this survey job'
        });
      }
    }

    return res.status(200).json({
      success: true,
      booking
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    console.error('Get booking by id error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving booking details'
    });
  }
};

/**
 * @desc    Update booking lifecycle status (Assigned -> Accepted -> Completed -> Paid)
 * @route   PUT /api/bookings/:id/status
 * @access  Private (Authenticated)
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, appointmentDate, appointmentTime, preparationInstructions, report } = req.body;
    const userRole = (req.user.role || '').toLowerCase();
    const userId = req.user._id;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const currentStatus = booking.status;
    const newStatus = status;

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: 'New status is required'
      });
    }

    // Validate State Machine Transition
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: [${allowedTransitions.join(', ')}]`
      });
    }

    // Role-specific transition authorization
    if (newStatus === 'Accepted') {
      if (userRole !== 'surveyor' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only the assigned surveyor or admin can accept a booking'
        });
      }
      if (appointmentDate) booking.appointmentDate = appointmentDate;
      if (appointmentTime) booking.appointmentTime = appointmentTime;
      if (preparationInstructions) booking.preparationInstructions = preparationInstructions;
    } else if (newStatus === 'Completed') {
      if (userRole !== 'surveyor' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only the assigned surveyor or admin can complete a survey job'
        });
      }
      if (report && typeof report === 'object') {
        booking.report = report;
        // Persist to SurveyReport collection in MongoDB Atlas
        try {
          const lat = Number(report.lat || report.latitude || 21.0);
          const lng = Number(report.lng || report.longitude || 75.0);
          const acreage = Number(report.acreage || report.verifiedAcreage || booking.area);
          await SurveyReport.findOneAndUpdate(
            { bookingId: booking._id },
            {
              bookingId: booking._id,
              surveyorId: booking.surveyorId,
              latitude: !isNaN(lat) ? lat : 21.0,
              longitude: !isNaN(lng) ? lng : 75.0,
              verifiedAcreage: !isNaN(acreage) ? acreage : booking.area,
              observations: report.observations || 'Survey completed and verified on field.',
              mapInformation: {
                mapType: booking.surveyType,
                mapImageUrl: report.mapImage || ''
              }
            },
            { upsert: true, new: true }
          );
        } catch (repErr) {
          console.warn('SurveyReport save warning:', repErr.message);
        }
      }
      // Free the surveyor to available and increment jobs completed
      if (booking.surveyorId) {
        const surv = await Surveyor.findById(booking.surveyorId);
        if (surv) {
          surv.status = 'available';
          surv.jobsCompleted = (surv.jobsCompleted || 0) + 1;
          await surv.save();
        }
      }
    } else if (newStatus === 'Paid') {
      if (userRole !== 'farmer' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Only the booking farmer or admin can mark a booking as Paid'
        });
      }
      if (userRole === 'farmer' && booking.farmerId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only pay for your own booking'
        });
      }
      // Ensure Payment document is created or updated in MongoDB Atlas
      let payment = await Payment.findOne({ bookingId: booking._id });
      if (!payment) {
        const invoiceNumber = `INV-2026-${Date.now().toString().slice(-6)}`;
        const transactionId = `TXN-${Date.now().toString().slice(-8)}`;
        await Payment.create({
          bookingId: booking._id,
          farmerId: booking.farmerId,
          amount: booking.cost,
          invoiceNumber,
          transactionId,
          paymentMethod: req.body.paymentMethod || 'UPI',
          status: 'paid'
        });
      } else if (payment.status !== 'paid') {
        payment.status = 'paid';
        await payment.save();
      }
    } else if (newStatus === 'Cancelled') {
      // Free the assigned surveyor if booking is cancelled
      if (booking.surveyorId) {
        const surv = await Surveyor.findById(booking.surveyorId);
        if (surv && surv.status === 'assigned') {
          surv.status = 'available';
          await surv.save();
        }
      }
    }

    booking.status = newStatus;
    const updatedBooking = await booking.save();

    return res.status(200).json({
      success: true,
      message: `Booking status updated from '${currentStatus}' to '${newStatus}'`,
      booking: updatedBooking
    });
  } catch (error) {
    console.error('Update booking status error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating booking status: ' + error.message
    });
  }
};

/**
 * @desc    Process payment for a completed booking (Farmer only)
 * @route   POST /api/bookings/:id/pay
 * @access  Private (Farmer or Admin)
 */
const payBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    const userId = req.user._id;
    const userRole = (req.user.role || '').toLowerCase();

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Must be in Completed status
    if (booking.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: `Cannot pay for booking with status '${booking.status}'. Booking must be 'Completed' prior to payment.`
      });
    }

    // Verify ownership
    if (userRole !== 'admin' && booking.farmerId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only pay for your own bookings'
      });
    }

    // Authoritative server-side amount
    const amount = booking.cost;
    const invoiceNumber = `INV-2026-${Date.now().toString().slice(-6)}`;
    const transactionId = `TXN-${Date.now().toString().slice(-8)}`;

    let payment = await Payment.findOne({ bookingId: booking._id });
    if (!payment) {
      payment = await Payment.create({
        bookingId: booking._id,
        farmerId: booking.farmerId,
        amount,
        invoiceNumber,
        transactionId,
        paymentMethod: paymentMethod || 'UPI',
        status: 'paid'
      });
    } else {
      payment.status = 'paid';
      payment.paymentMethod = paymentMethod || payment.paymentMethod || 'UPI';
      await payment.save();
    }

    booking.status = 'Paid';
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Payment processed and recorded successfully in MongoDB Atlas',
      payment,
      booking
    });
  } catch (error) {
    console.error('Pay booking error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error processing payment: ' + error.message
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  payBooking
};
