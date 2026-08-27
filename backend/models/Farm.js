const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Farmer ID reference is required'],
    index: true
  },
  farmName: {
    type: String,
    required: [true, 'Farm plot name is required'],
    trim: true
  },
  village: {
    type: String,
    required: [true, 'Village is required'],
    trim: true
  },
  taluka: {
    type: String,
    lowercase: true,
    trim: true,
    default: 'thalner'
  },
  location: {
    address: {
      type: String,
      trim: true
    },
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    }
  },
  acreage: {
    type: Number,
    required: [true, 'Acreage is required'],
    min: [0.01, 'Acreage must be a positive number greater than 0']
  },
  contactNumber: {
    type: String,
    trim: true
  },
  surveyType: {
    type: String,
    required: [true, 'Survey type is required'],
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
  estimatedCost: {
    type: Number,
    min: [0, 'Estimated cost cannot be negative'],
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Farm', farmSchema);
