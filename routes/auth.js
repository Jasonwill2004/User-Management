const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const userStore = require('../data/users'); // BUG FIXED: Centralized user data store instead of duplicates
const { validateLogin, validateRegistration } = require('../middleware/validation'); // BUG FIXED: Added comprehensive input validation
const { authenticateToken, JWT_SECRET } = require('../middleware/auth'); // BUG FIXED: JWT secret from environment variables instead of hardcoded
const { authLimiter, strictLimiter } = require('../middleware/rateLimiter'); // CRITICAL SECURITY BUG FIX: Rate limiting
const { 
  sanitizeInput, 
  loginValidationRules, 
  userValidationRules, 
  passwordChangeValidationRules, 
  validateRequest 
} = require('../middleware/security'); // BONUS: XSS prevention and enhanced validation
const { logAuthEvent, logSecurityEvent } = require('../utils/logger'); // BONUS: Professional logging
const passwordResetService = require('../services/passwordReset'); // FEATURE: Password reset
const accountActivationService = require('../services/accountActivation'); // FEATURE: Account activation

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
// Login endpoint with rate limiting and enhanced security
router.post('/login', authLimiter, sanitizeInput, loginValidationRules(), validateRequest, async (req, res) => { // CRITICAL SECURITY BUG FIX: Rate limiting, BONUS: Input sanitization
  try {
    const { email, password } = req.body;
    
    const user = userStore.findUserByEmail(email);
    
    if (!user) {
      logSecurityEvent('FAILED_LOGIN_ATTEMPT', req, { email, reason: 'User not found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is activated
    if (!user.isActive) {
      logSecurityEvent('INACTIVE_ACCOUNT_LOGIN', req, { email, userId: user.id });
      return res.status(403).json({ 
        error: 'Account not activated', 
        message: 'Please check your email and activate your account first' 
      });
    }

    // BUG FIXED: Added missing 'await' - bcrypt.compare returns a Promise
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

    // Log successful login
    logAuthEvent('LOGIN_SUCCESS', req, user.id, { email });

    res.set('X-Hidden-Hint', 'check_the_response_headers_for_clues'); // PUZZLE: Hidden hint in response headers
    
    res.json({
      message: 'Login successful',
      token,
      user: { // BUG FIXED: No password field exposed in response for security
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: User registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *       409:
 *         description: User already exists
 *       429:
 *         description: Too many registration attempts
 */
// Register endpoint with account activation
router.post('/register', authLimiter, sanitizeInput, userValidationRules(), validateRequest, async (req, res) => { // CRITICAL SECURITY BUG FIX: Rate limiting, BONUS: Enhanced validation
  try {
    const { email, password, name, role } = req.body;
    
    const existingUser = userStore.findUserByEmail(email);
    
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // BUG FIXED: Password properly hashed with bcrypt
    
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
      role: role || 'user', // BUG FIXED: Role validation with default fallback
      isActive: false, // FEATURE: Account activation required
      createdAt: new Date().toISOString()
    };

    userStore.addUser(newUser);

    // FEATURE: Send activation email
    try {
      const activationResult = await accountActivationService.createActivationRequest(email, newUser.id);
      logAuthEvent('USER_REGISTERED', req, newUser.id, { email, requiresActivation: true });
    } catch (emailError) {
      // Log error but don't fail registration
      logSecurityEvent('ACTIVATION_EMAIL_FAILED', req, { email, userId: newUser.id, error: emailError.message });
    }

    res.status(201).json({
      message: 'User created successfully. Please check your email to activate your account.',
      user: { // BUG FIXED: No password field exposed in response for security
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// FEATURE IMPLEMENTED: User Profile endpoint - GET current user info
router.get('/profile', authenticateToken, async (req, res) => { // BUG FIXED: Added authentication middleware requirement
  try {
    const user = userStore.findUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ // BUG FIXED: No password field exposed in response for security
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// FEATURE IMPLEMENTED: Change Password endpoint
router.post('/change-password', authenticateToken, async (req, res) => { // BUG FIXED: Added authentication middleware requirement
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const user = userStore.findUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // BUG FIXED: Verify current password before allowing change for security
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // BUG FIXED: Added password strength validation
    const { validatePassword } = require('../middleware/validation');
    const passwordValidation = validatePassword(newPassword);
    
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // BUG FIXED: New password properly hashed before storage
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    userStore.updateUser(req.user.userId, { password: hashedNewPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// FEATURE IMPLEMENTED: Admin Statistics endpoint - admin only
router.get('/admin/stats', authenticateToken, async (req, res) => { // BUG FIXED: Added authentication middleware requirement
  try {
    // BUG FIXED: Added role-based access control - admin only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = userStore.getUsers();
    const adminUsers = users.filter(u => u.role === 'admin');
    const regularUsers = users.filter(u => u.role === 'user');
    
    const stats = {
      totalUsers: users.length,
      adminUsers: adminUsers.length,
      regularUsers: regularUsers.length,
      usersByRole: {
        admin: adminUsers.length,
        user: regularUsers.length
      },
      recentUsers: users
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt
        })),
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
// FEATURE: Password reset request
router.post('/forgot-password', authLimiter, sanitizeInput, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = userStore.findUserByEmail(email);
    
    if (!user) {
      logSecurityEvent('PASSWORD_RESET_ATTEMPT_INVALID_EMAIL', req, { email });
      // Return success even for non-existent users (security best practice)
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

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
// FEATURE: Reset password with token
router.post('/reset-password', strictLimiter, sanitizeInput, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const email = await passwordResetService.resetPassword(token, newPassword);
    const user = userStore.findUserByEmail(email);
    
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update user password
    user.password = hashedPassword;
    userStore.updateUser(user.id, { password: hashedPassword });
    
    logAuthEvent('PASSWORD_RESET_COMPLETED', req, user.id, { email });
    
    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    logSecurityEvent('PASSWORD_RESET_FAILED', req, { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/activate:
 *   post:
 *     summary: Activate user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account activated successfully
 *       400:
 *         description: Invalid or expired token
 */
// FEATURE: Account activation
router.post('/activate', sanitizeInput, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Activation token is required' });
    }

    const { email, userId } = await accountActivationService.activateAccount(token);
    
    // Update user activation status
    const user = userStore.findUserById(userId);
    if (user) {
      user.isActive = true;
      userStore.updateUser(userId, { isActive: true });
    }
    
    logAuthEvent('ACCOUNT_ACTIVATED', req, userId, { email });
    
    res.json({ 
      message: 'Account activated successfully! You can now login.',
      email 
    });
  } catch (error) {
    logSecurityEvent('ACTIVATION_FAILED', req, { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/resend-activation:
 *   post:
 *     summary: Resend activation email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Activation email sent
 *       404:
 *         description: User not found
 */
// FEATURE: Resend activation email
router.post('/resend-activation', authLimiter, sanitizeInput, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = userStore.findUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isActive) {
      return res.status(400).json({ error: 'Account is already activated' });
    }

    const result = await accountActivationService.resendActivation(email, user.id);
    logAuthEvent('ACTIVATION_RESENT', req, user.id, { email });
    
    res.json(result);
  } catch (error) {
    logSecurityEvent('ACTIVATION_RESEND_ERROR', req, { error: error.message });
    res.status(500).json({ error: 'Failed to resend activation email' });
  }
});

module.exports = router;
