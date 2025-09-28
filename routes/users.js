const express = require('express');
const bcrypt = require('bcryptjs');
const userStore = require('../data/users'); // BUG FIXED: Centralized user data store instead of duplicates
const { authenticateToken, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth'); // BUG FIXED: Added comprehensive authentication middleware
const { validateUserUpdate } = require('../middleware/validation'); // BUG FIXED: Added input validation middleware
const { generalLimiter } = require('../middleware/rateLimiter'); // CRITICAL SECURITY BUG FIX: Rate limiting
const { sanitizeInput, searchValidationRules, validateRequest } = require('../middleware/security'); // BONUS: Input sanitization and validation
const { logApiUsage } = require('../utils/logger'); // BONUS: API usage logging

const router = express.Router();

// DEBUG: Simple test endpoint to check if routes work
router.get('/test', (req, res) => {
  res.json({ message: 'User routes working', users: userStore.getUsers().length });
});

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search users by name or email
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query for name or email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Search results
 *       404:
 *         description: No users found
 */
// FEATURE: Dedicated search endpoint (MUST be before /:userId route)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const searchQuery = req.query.q;
    
    if (!searchQuery || searchQuery.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    let users = userStore.getUsers();
    const query = searchQuery.toLowerCase().trim();
    
    // Search in name and email
    users = users.filter(user => 
      user.name.toLowerCase().includes(query) || 
      user.email.toLowerCase().includes(query)
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedUsers = users.slice(startIndex, endIndex);
    
    // Log API usage
    logApiUsage(req, res, Date.now() - req.startTime);
    
    res.json({
      users: paginatedUsers.map(user => ({
        id: user.id,
        email: user.email, 
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(users.length / limit),
        totalUsers: users.length,
        hasNext: endIndex < users.length,
        hasPrev: page > 1
      },
      searchQuery: searchQuery
    });
  } catch (error) {
    console.error('Search endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get users with search and pagination
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for name or email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedUsers'
 *       401:
 *         description: Unauthorized
 */
// FEATURE: Get users with search functionality and enhanced security
router.get('/', generalLimiter, authenticateToken, sanitizeInput, searchValidationRules(), validateRequest, async (req, res) => { // BUG FIXED: Added authentication requirement, CRITICAL SECURITY BUG FIX: Rate limiting, FEATURE: Search functionality
  try {
    let users = userStore.getUsers();
    
    // FEATURE: User search functionality
    const searchQuery = req.query.q;
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      users = users.filter(user => 
        user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query)
      );
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // FEATURE IMPLEMENTED: Pagination with max limit
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedUsers = users.slice(startIndex, endIndex);
    
    // BONUS: Log API usage
    logApiUsage(req, res, Date.now() - req.startTime);
    
    res.json({
      users: paginatedUsers.map(user => ({
        id: user.id,
        email: user.email, 
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      })), // BUG FIXED: Password field removed from response
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(users.length / limit),
        totalUsers: users.length,
        hasNext: endIndex < users.length,
        hasPrev: page > 1
      },
      searchQuery: searchQuery || null
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
