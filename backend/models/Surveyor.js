const mongoose = require('mongoose');

const surveyorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID reference is required'],
    unique: true,
    index: true
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Surveyor name is required'],
    trim: true
  },
  baseStation: {
    type: String,
    required: [true, 'Base station node is required'],
    trim: true
  },
  taluka: {
    type: String,
    required: [true, 'Taluka is required'],
    lowercase: true,
    trim: true
  },
  status: {
    type: String,
    enum: {
      values: ['available', 'assigned', 'busy', 'inactive', 'resigned'],
      message: '{VALUE} is not a valid surveyor status'
    },
    default: 'available',
    lowercase: true
  },
  rating: {
    type: Number,
    default: 5.0,
    min: [0, 'Rating cannot be below 0'],
    max: [5, 'Rating cannot exceed 5']
  },
  jobsCompleted: {
    type: Number,
    default: 0,
    min: [0, 'Jobs completed count cannot be negative']
  }
}, {
  timestamps: true
});

// Helper virtual to check if surveyor is currently in active capacity
surveyorSchema.virtual('isActiveCapacity').get(function() {
  return ['available', 'assigned', 'busy'].includes(this.status);
});

module.exports = mongoose.model('Surveyor', surveyorSchema);
