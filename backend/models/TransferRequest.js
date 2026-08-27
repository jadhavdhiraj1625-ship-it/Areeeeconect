const mongoose = require('mongoose');

const transferRequestSchema = new mongoose.Schema({
  surveyorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Surveyor',
    required: [true, 'Surveyor reference is required'],
    index: true
  },
  currentTaluka: {
    type: String,
    required: [true, 'Current taluka is required'],
    lowercase: true,
    trim: true
  },
  targetTaluka: {
    type: String,
    required: [true, 'Target destination taluka is required'],
    lowercase: true,
    trim: true
  },
  reason: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected'],
      message: '{VALUE} is not a valid transfer status'
    },
    default: 'pending',
    lowercase: true
  },
  adminNotes: {
    type: String,
    trim: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TransferRequest', transferRequestSchema);
