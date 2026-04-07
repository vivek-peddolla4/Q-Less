const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Token configuration (in env or defaults)
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '1d'; // 1 day
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '30d'; // 30 days

// Generate tokens
function generateTokens(userId, role) {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET + '_refresh',
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, specialization, phone } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      specialization,
      phone,
      refreshTokens: []
    });
    await newUser.save();
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    
    // Store refresh token in database if "Remember Me" is checked
    if (rememberMe) {
      const refreshTokenExpiry = new Date();
      refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30 days
      
      user.refreshTokens.push({
        token: refreshToken,
        expiresAt: refreshTokenExpiry
      });
      
      // Clean up expired refresh tokens
      user.refreshTokens = user.refreshTokens.filter(
        rt => rt.expiresAt > new Date()
      );
      
      await user.save();
    }
    
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        specialization: user.specialization,
        phone: user.phone
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Refresh Token Endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET + '_refresh');
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    
    // Find user and verify token exists in DB
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });
    
    // If user had remember me enabled, verify token in DB
    const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken && rt.expiresAt > new Date());
    
    // Generate new access token (and optionally new refresh token)
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.role);
    
    // If using stored refresh tokens, update it
    if (tokenExists) {
      user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
      user.refreshTokens.push({
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      await user.save();
      
      return res.json({
        accessToken,
        refreshToken: newRefreshToken
      });
    }
    
    // For non-remembered logins, just issue new access token
    res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET + '_refresh');
      const user = await User.findById(decoded.userId);
      
      if (user) {
        user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
        await user.save();
      }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Logout error', error: err.message });
  }
});

// Temporary endpoint to view all users (Development only!)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password -refreshTokens');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

module.exports = router;
