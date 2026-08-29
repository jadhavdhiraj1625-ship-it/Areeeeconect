const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Surveyor = require('../models/Surveyor');

/**
 * Helper to generate signed JWT
 */
const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET || 'agriconnect_secure_jwt_secret_key_2026_fallback';
  return jwt.sign(
    { userId, role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @desc    Register a new user (farmer or candidate)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, mobile, password, role, taluka, village } = req.body;

    // 0. Ensure MongoDB Atlas connection is healthy
    if (require('mongoose').connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'MongoDB Atlas database is currently disconnected. Please restart server.'
      });
    }

    // 1. Validate required fields
    if (!name || !email || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, mobile, and password'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedMobile = String(mobile).trim();
    const assignedRole = (role || 'farmer').toLowerCase().trim();
    const cleanTaluka = (taluka || 'thalner').toLowerCase().trim();
    const cleanVillage = (village || '').trim();

    // 2. Validate role - surveyor cannot self-register directly
    if (!['farmer', 'candidate'].includes(assignedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration role. Surveyors must be recruited through candidate portal or added by Admin.'
      });
    }

    // 3. Check for existing user with same mobile or email
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { mobile: normalizedMobile }
      ]
    });

    if (existingUser) {
      const isMobile = existingUser.mobile === normalizedMobile;
      return res.status(409).json({
        success: false,
        message: isMobile 
          ? `User with mobile number ${normalizedMobile} already exists. Please sign in instead.`
          : `User with email ${normalizedEmail} already exists. Please sign in or use another email.`
      });
    }

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Create user record with taluka and village directly into MongoDB Atlas
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      passwordHash,
      role: assignedRole,
      taluka: cleanTaluka,
      village: cleanVillage,
      status: 'active'
    });

    console.log(`✅ [MongoDB Atlas: Areeconnect_database.users] User saved: ${user.name} | Mobile: ${user.mobile} | Email: ${user.email} | Role: ${user.role} | Taluka: ${user.taluka}`);

    // 6. Generate JWT token
    const token = generateToken(user._id, user.role);

    // 7. Return sanitized response (NEVER return passwordHash)
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        taluka: user.taluka,
        village: user.village,
        status: user.status
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email or mobile number is already registered'
      });
    }

    console.error('Registration error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, username, mobile, identifier, password, role: requestedRole } = req.body;

    const loginId = String(email || username || mobile || identifier || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide login identifier and password'
      });
    }

    // Ensure MongoDB connection is healthy
    if (require('mongoose').connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database is currently unavailable or connecting. Please try again shortly.'
      });
    }

    // Find user by email or mobile
    let user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase() },
        { mobile: loginId }
      ]
    });

    // If not found by mobile/email, check by Surveyor Employee ID (e.g. AGR-2026-001)
    if (!user) {
      const surveyor = await Surveyor.findOne({
        employeeId: new RegExp('^' + loginId + '$', 'i')
      });
      if (surveyor && surveyor.userId) {
        user = await User.findById(surveyor.userId);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email, mobile, employee ID, or password'
      });
    }

    // Check account status
    if (user.status === 'suspended' || user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact administrator.`
      });
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Rule 10 Enforcement: If logging into Surveyor dashboard, user.role MUST be 'surveyor'
    const normRequested = String(requestedRole || '').toLowerCase().trim();
    if (normRequested === 'surveyor' && user.role !== 'surveyor' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Surveyor dashboard access is not permitted for candidate accounts until recruitment qualification is complete.'
      });
    }

    // Generate JWT token with authoritative database role
    const token = generateToken(user._id, user.role);

    // If surveyor, fetch employee ID
    let employeeId = null;
    if (user.role === 'surveyor') {
      const surveyorProfile = await Surveyor.findOne({ userId: user._id });
      if (surveyorProfile) {
        employeeId = surveyorProfile.employeeId;
      }
    }

    // Return safe user info (NEVER return passwordHash)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        taluka: user.taluka || 'thalner',
        village: user.village || '',
        employeeId,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error.name, error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again later.'
    });
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Protected by JWT)
 */
const getMe = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let employeeId = null;
    let surveyorProfile = null;
    if (user.role === 'surveyor') {
      surveyorProfile = await Surveyor.findOne({ userId: user._id });
      if (surveyorProfile) {
        employeeId = surveyorProfile.employeeId;
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        taluka: user.taluka || (surveyorProfile ? surveyorProfile.taluka : 'thalner'),
        village: user.village || '',
        employeeId,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('GetMe error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving user profile'
    });
  }
};

module.exports = {
  register,
  login,
  getMe
};
