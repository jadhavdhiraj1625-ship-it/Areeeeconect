const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Farmer ID is required'],
    index: true
  },
  surveyorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Surveyor',
    index: true
  },
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    index: true
  },
  surveyType: {
    type: String,
    enum: [
      'Boundary Tally',
      'Boundary Tally & Verification',
      'Farm Subdivision',
      'Layout & Landmark',
      'Precise Layout & Landmark',
      'Land Survey',
      'Standard Survey',
      'Other'
    ],
    default: 'Boundary Tally'
  },
  area: {
    type: Number,
    required: [true, 'Survey area acreage is required'],
    min: [0.01, 'Area must be greater than 0']
  },
  cost: {
    type: Number,
    required: [true, 'Survey cost is required'],
    min: [0, 'Cost cannot be negative']
  },
  distance: {
    type: Number,
    default: 0,
    min: [0, 'Distance cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['Assigned', 'Accepted', 'Completed', 'Paid', 'Cancelled'],
      message: '{VALUE} is not a valid booking status'
    },
    default: 'Assigned'
  },
  appointmentDate: {
    type: String,
    trim: true,
    default: null
  },
  appointmentTime: {
    type: String,
    trim: true,
    default: null
  },
  preparationInstructions: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
