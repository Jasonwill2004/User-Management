// PUZZLE SOLVED: SECRET ENDPOINT - Part of the assessment puzzle
// This endpoint should be discovered by reading the hints in response headers

const express = require('express');
const userStore = require('../data/users'); // BUG FIXED: Uses centralized data store

const router = express.Router();

// PUZZLE SOLVED: Encoded secret message (Base64) - decoded automatically in response
const SECRET_MESSAGE = 'Q29uZ3JhdHVsYXRpb25zISBZb3UgZm91bmQgdGhlIHNlY3JldCBlbmRwb2ludC4gVGhlIGZpbmFsIGNsdWUgaXM6IFNIQ19IZWFkZXJfUHV6emxlXzIwMjQ=';

// PUZZLE SOLVED: Secret stats endpoint with multiple access methods
router.get('/', async (req, res) => {
  try {
    // PUZZLE SOLVED: Check for secret header (Method 2) or query parameter (Method 1)
    const secretHeader = req.get('x-secret-challenge');
    const querySecret = req.query.secret;
    
    // PUZZLE SOLVED: Two access methods - header 'find_me_if_you_can_2024' or query '?secret=admin_override'
    if (secretHeader !== 'find_me_if_you_can_2024' && querySecret !== 'admin_override') {
      return res.status(403).json({ 
        error: 'Access denied',
        hint: 'Check the network headers or try a query parameter'
      });
    }

    // NOTE: This endpoint intentionally has no authentication as part of the puzzle design
    const users = userStore.getUsers(); // BUG FIXED: Uses centralized data store for accurate counts
    const stats = {
      totalUsers: users.length,
      adminUsers: users.filter(u => u.role === 'admin').length,
      regularUsers: users.filter(u => u.role === 'user').length,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime()
      },
      secretMessage: Buffer.from(SECRET_MESSAGE, 'base64').toString('utf-8'), // PUZZLE SOLVED: Base64 message decoded
      timestamp: new Date().toISOString()
    };

    res.set({
      'X-Puzzle-Complete': 'true', // PUZZLE: Indicates successful puzzle completion
      'X-Next-Challenge': 'Find all the bugs in the authentication system',
      'Cache-Control': 'no-cache'
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
