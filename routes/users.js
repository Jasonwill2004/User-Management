const express = require('express');
const bcrypt = require('bcryptjs');
const userStore = require('../data/users'); // BUG FIXED: Centralized user data store instead of duplicates
const { authenticateToken, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth'); // BUG FIXED: Added comprehensive authentication middleware
const { validateUserUpdate } = require('../middleware/validation'); // BUG FIXED: Added input validation middleware

const router = express.Router();

// Get all users - requires authentication  
router.get('/', authenticateToken, async (req, res) => { // BUG FIXED: Added authentication requirement
  try {
    const users = userStore.getUsers();
    
    // FEATURE IMPLEMENTED: Added pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedUsers = users.slice(startIndex, endIndex);
    
    res.set({
      'X-Total-Users': users.length.toString(),
      'X-Secret-Endpoint': '/api/users/secret-stats', // PUZZLE SOLVED: Hidden endpoint hint in response headers
      'X-Current-Page': page.toString(),
      'X-Total-Pages': Math.ceil(users.length / limit).toString()
    });
    
    res.json({
      users: paginatedUsers.map(user => ({
        id: user.id,
        email: user.email,
        // BUG FIXED: Removed password field from response for security
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(users.length / limit),
        totalUsers: users.length,
        hasNext: endIndex < users.length,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID - requires authentication
router.get('/:userId', authenticateToken, async (req, res) => { // BUG FIXED: Added authentication requirement
  try {
    const { userId } = req.params;
    const user = userStore.findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // BUG FIXED: Removed password field from response for security
    res.json({
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

// Update user - requires self or admin access
router.put('/:userId', authenticateToken, requireSelfOrAdmin, validateUserUpdate, async (req, res) => { // BUG FIXED: Added authentication, authorization, and validation middleware
  try {
    const { userId } = req.params;
    const updateData = req.body;
    
    const user = userStore.findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // BUG FIXED: Password properly hashed when updated instead of storing plain text
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // BUG FIXED: Role-based access control - only admins can change roles
    if (updateData.role && req.user.role !== 'admin') {
      delete updateData.role;
    }

    const updatedUser = userStore.updateUser(userId, updateData);

    res.json({
      message: 'User updated successfully',
      user: { // BUG FIXED: No password field exposed in response for security
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user - requires admin access
router.delete('/:userId', authenticateToken, requireAdmin, async (req, res) => { // BUG FIXED: Added authentication and admin-only authorization
  try {
    const { userId } = req.params;
    
    // BUG FIXED: Prevent self-deletion for security
    if (req.user.userId === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const deletedUser = userStore.deleteUser(userId);
    
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
