const mongoose = require('mongoose');

const interviewSlotSchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD
    required: [true, 'Interview date is required'],
    index: true
  },
  time: {
    type: String, // e.g. "10:00 AM", "02:00 PM"
    required: [true, 'Interview time slot is required']
  },
  maxCapacity: {
    type: Number,
    default: 1,
    min: [1, 'Slot capacity must be at least 1']
  },
  bookedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  meetingLink: {
    type: String,
    default: 'https://meet.google.com/agr-interview-room'
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Helper virtual to check if full
interviewSlotSchema.virtual('isFull').get(function() {
  return this.bookedCount >= this.maxCapacity;
});

module.exports = mongoose.model('InterviewSlot', interviewSlotSchema);
