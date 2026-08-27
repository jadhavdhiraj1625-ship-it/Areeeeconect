const mongoose = require('mongoose');

const talukaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Taluka name is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true
  },
  node: {
    type: String,
    required: [true, 'Road network graph node is required'],
    trim: true
  },
  maxCapacity: {
    type: Number,
    default: 3,
    min: [1, 'Capacity must be at least 1']
  },
  coordinates: {
    lat: { type: Number, default: 21.0 },
    lng: { type: Number, default: 75.0 }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Taluka', talukaSchema);
