const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const userStore = require('../data/users'); // BUG FIXED: Centralized user data store instead of duplicates
const { validateLogin, validateRegistration } = require('../middleware/validation'); // BUG FIXED: Added comprehensive input validation
const { authenticateToken, JWT_SECRET } = require('../middleware/auth'); // BUG FIXED: JWT secret from environment variables instead of hardcoded

const router = express.Router();

// Login endpoint
router.post('/login', validateLogin, async (req, res) => { // BUG FIXED: Added input validation middleware
  try {
    const { email, password } = req.body;
    
    const user = userStore.findUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // BUG FIXED: Added missing 'await' - bcrypt.compare returns a Promise
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

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

// Register endpoint
router.post('/register', validateRegistration, async (req, res) => { // BUG FIXED: Added comprehensive validation middleware
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
      createdAt: new Date().toISOString()
    };

    userStore.addUser(newUser);

    res.status(201).json({
      message: 'User created successfully',
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

module.exports = router;
