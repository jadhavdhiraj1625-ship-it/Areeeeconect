const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required']
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['farmer', 'surveyor', 'admin', 'candidate'],
      message: '{VALUE} is not a valid role'
    },
    lowercase: true,
    trim: true
  },
  taluka: {
    type: String,
    lowercase: true,
    trim: true,
    default: 'thalner'
  },
  village: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'pending', 'suspended'],
      message: '{VALUE} is not a valid status'
    },
    default: 'active',
    lowercase: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
