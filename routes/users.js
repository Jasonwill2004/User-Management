const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// In-memory user storage (simulate database) - should be shared/centralized
let users = [
  {
    id: '1',
    email: 'admin@test.com',
    password: '$2a$10$8K1p/a0dCVIRRqL.Qk0mce7LzYVbKuLyZg.3/t.NzXo/1UhqKqYxa',
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date('2024-01-01').toISOString()
  },
  {
    id: '2',
    email: 'user@test.com',
    password: '$2a$10$qHT2AjOcNsXJKPc4G8/yte1FOjTxKqYfCYh2KNF9xD8FbhPi0qO8u',
    name: 'Regular User', 
    role: 'user',
    createdAt: new Date('2024-01-02').toISOString()
  }
];

const JWT_SECRET = 'your-secret-key-here'; // BUG: Same hardcoded secret

// MISSING FEATURE: Authentication verification
function verifyToken(authHeader) {
  if (!authHeader) {
    throw new Error('No token provided');
  }
  
  const token = authHeader.split(' ')[1];
  return jwt.verify(token, JWT_SECRET);
}

// Get all users
router.get('/', async (req, res) => {
  try {
    // BUG: No authentication middleware/check
    // BUG: Returning sensitive information (passwords)
    // BUG: No pagination
    // BUG: No role-based access control
    
    res.set({
      'X-Total-Users': users.length.toString(),
      'X-Secret-Endpoint': '/api/users/secret-stats' // PUZZLE: Hidden endpoint hint
    });
    
    res.json({
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        password: user.password, // BUG: Exposing passwords
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    // BUG: Not handling parsing errors properly
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // BUG: Still exposing password
    res.json({
      id: user.id,
      email: user.email,
      password: user.password, // BUG: Password should not be returned
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    
    // BUG: No authentication check
    // BUG: No validation of update data
    
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // BUG: Allowing direct password update without hashing
    // BUG: No field validation
    users[userIndex] = { ...users[userIndex], ...updateData };

    res.json({
      message: 'User updated successfully',
      user: {
        id: users[userIndex].id,
        email: users[userIndex].email,
        name: users[userIndex].name,
        role: users[userIndex].role,
        createdAt: users[userIndex].createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // BUG: No authentication check
    // BUG: No admin role verification
    
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // BUG: No check to prevent self-deletion
    users.splice(userIndex, 1);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
