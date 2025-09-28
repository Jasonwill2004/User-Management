const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const userStore = require('../data/users');
const { validateLogin, validateRegistration } = require('../middleware/validation');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { sanitizeInput, loginValidationRules, userValidationRules, validateRequest } = require('../middleware/security');
const { logAuthEvent, logSecurityEvent } = require('../utils/logger');
const passwordResetService = require('../services/passwordReset');
const accountActivationService = require('../services/accountActivation');

const router = express.Router();

// Test version without rate limiting
router.post('/login', sanitizeInput, loginValidationRules(), validateRequest, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = userStore.findUserByEmail(email);
    
    if (!user) {
      logSecurityEvent('FAILED_LOGIN_ATTEMPT', req, { email, reason: 'User not found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      logSecurityEvent('INACTIVE_ACCOUNT_LOGIN', req, { email, userId: user.id });
      return res.status(403).json({ 
        error: 'Account not activated', 
        message: 'Please check your email and activate your account first' 
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      logSecurityEvent('FAILED_LOGIN_ATTEMPT', req, { email, userId: user.id, reason: 'Invalid password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logAuthEvent('LOGIN_SUCCESS', req, user.id, { email });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', sanitizeInput, userValidationRules(), validateRequest, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    const existingUser = userStore.findUserByEmail(email);
    
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
      role: role || 'user',
      isActive: false,
      createdAt: new Date().toISOString()
    };

    userStore.addUser(newUser);

    try {
      const activationResult = await accountActivationService.createActivationRequest(email, newUser.id);
      logAuthEvent('USER_REGISTERED', req, newUser.id, { email, requiresActivation: true });
    } catch (emailError) {
      logSecurityEvent('ACTIVATION_EMAIL_FAILED', req, { email, userId: newUser.id, error: emailError.message });
    }

    res.status(201).json({
      message: 'User created successfully. Please check your email to activate your account.',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/forgot-password', sanitizeInput, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = userStore.findUserByEmail(email);
    
    if (!user) {
      logSecurityEvent('PASSWORD_RESET_ATTEMPT_INVALID_EMAIL', req, { email });
      return res.status(200).json({ 
        message: 'If an account with that email exists, password reset instructions have been sent.' 
      });
    }

    const result = await passwordResetService.createResetRequest(email);
    logAuthEvent('PASSWORD_RESET_REQUESTED', req, user.id, { email });
    
    res.json(result);
  } catch (error) {
    logSecurityEvent('PASSWORD_RESET_ERROR', req, { error: error.message });
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

module.exports = router;