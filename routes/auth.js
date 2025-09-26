const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');

const router = express.Router();

// In-memory user storage (simulate database)
let users = [
  {
    id: '1',
    email: 'admin@test.com',
    password: '$2a$10$8K1p/a0dCVIRRqL.Qk0mce7LzYVbKuLyZg.3/t.NzXo/1UhqKqYxa', // 'admin123'
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date('2024-01-01').toISOString()
  },
  {
    id: '2',
    email: 'user@test.com', 
    password: '$2a$10$qHT2AjOcNsXJKPc4G8/yte1FOjTxKqYfCYh2KNF9xD8FbhPi0qO8u', // 'user123'
    name: 'Regular User',
    role: 'user',
    createdAt: new Date('2024-01-02').toISOString()
  }
];

const JWT_SECRET = 'your-secret-key-here'; // BUG: Hardcoded secret

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // BUG: Missing input validation
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // BUG: Not awaiting bcrypt.compare
    const validPassword = bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.set('X-Hidden-Hint', 'check_the_response_headers_for_clues');
    
    res.json({
      message: 'Login successful',
      token,
      user: {
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
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // BUG: Incomplete validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // BUG: Not checking if email is valid format
    const existingUser = users.find(u => u.email === email);
    
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // BUG: Password should be validated for strength
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name: name || 'Unknown User',
      role: 'user', // BUG: Should not be hardcoded, should validate role
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    res.status(201).json({
      message: 'User created successfully',
      user: {
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

module.exports = router;
