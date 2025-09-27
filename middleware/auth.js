const jwt = require('jsonwebtoken');
const userStore = require('../data/users');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'; // BUG FIXED: JWT secret from environment variables instead of hardcoded

// BUG FIXED: Authentication middleware - validates JWT tokens and user existence
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // BUG FIXED: Properly extract Bearer token

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      
      // BUG FIXED: Verify user still exists in database for security
      const user = userStore.findUserById(decoded.userId);
      if (!user) {
        return res.status(403).json({ error: 'User no longer exists' });
      }

      req.user = decoded;
      next();
    });
  } catch (error) {
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// BUG FIXED: Admin-only middleware for role-based access control
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// BUG FIXED: Self or admin middleware - users can only modify own data unless admin
const requireSelfOrAdmin = (req, res, next) => {
  const targetUserId = req.params.userId || req.params.id;
  
  if (req.user && (req.user.userId === targetUserId || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: can only modify own profile or need admin access' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin, 
  requireSelfOrAdmin,
  JWT_SECRET
};