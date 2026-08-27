const mongoose = require('mongoose');

const surveyReportSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking ID is required'],
    unique: true,
    index: true
  },
  surveyorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Surveyor',
    required: [true, 'Surveyor ID is required'],
    index: true
  },
  latitude: {
    type: Number,
    required: [true, 'GPS Latitude is required'],
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90']
  },
  longitude: {
    type: Number,
    required: [true, 'GPS Longitude is required'],
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180']
  },
  verifiedAcreage: {
    type: Number,
    required: [true, 'Verified acreage is required'],
    min: [0.01, 'Verified acreage must be a positive number']
  },
  observations: {
    type: String,
    trim: true
  },
  mapInformation: {
    mapType: {
      type: String,
      trim: true
    },
    cadastralPlotRef: {
      type: String,
      trim: true
    },
    boundaryCoordinates: [{
      lat: Number,
      lng: Number,
      marker: String
    }],
    mapImageUrl: {
      type: String,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SurveyReport', surveyReportSchema);
