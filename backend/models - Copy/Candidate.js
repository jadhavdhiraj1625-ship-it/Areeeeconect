const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true,
    index: true
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  district: {
    type: String,
    trim: true
  },
  preferredTaluka: {
    type: String,
    required: [true, 'Preferred taluka is required'],
    lowercase: true,
    trim: true
  },
  qualification: {
    type: String,
    required: [true, 'Qualification is required'],
    trim: true
  },
  experienceYears: {
    type: Number,
    required: [true, 'Experience in years is required'],
    min: [0, 'Experience years cannot be negative'],
    default: 0
  },
  licenseId: {
    type: String,
    trim: true
  },
  applicationStatus: {
    type: String,
    enum: {
      values: [
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
      ],
      message: '{VALUE} is not a valid candidate application status'
    },
    default: 'applied',
    lowercase: true
  },
  testDetails: {
    testDate: { type: String, default: '' },
    testTime: { type: String, default: '' },
    testStatus: {
      type: String,
      enum: ['pending', 'scheduled', 'completed', 'passed', 'failed'],
      default: 'pending'
    },
    testScore: { type: Number, default: null }
  },
  interviewSchedule: {
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSlot' },
    date: { type: String, default: '' },
    time: { type: String, default: '' },
    meetingLink: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'completed', 'passed', 'failed'],
      default: 'pending'
    }
  },
  interviewScore: {
    type: Number,
    min: [0, 'Score cannot be below 0'],
    max: [100, 'Score cannot exceed 100'],
    default: null
  },
  backgroundCheck: {
    status: {
      type: String,
      enum: ['pending', 'passed', 'failed'],
      default: 'pending'
    },
    verifiedAt: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    }
  },
  qualifiedAt: {
    type: Date,
    default: null
  },
  employeeId: {
    type: String,
    sparse: true,
    trim: true
  },
  documents: [{
    documentType: {
      type: String,
      trim: true
    },
    fileName: {
      type: String,
      trim: true
    },
    fileUrl: {
      type: String,
      trim: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Candidate', candidateSchema);
