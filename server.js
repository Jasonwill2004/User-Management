require('dotenv').config(); // BUG FIXED: Added environment variable support for JWT secrets
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const secretStatsRoutes = require('./routes/secret-stats');

const app = express();
const PORT = process.env.PORT || 8888; // BUG FIXED: Port configuration from environment variables

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PUZZLE SOLVED: Custom headers for puzzle hints
app.use((req, res, next) => {
  res.set({
    'X-Secret-Challenge': 'find_me_if_you_can_2024', // PUZZLE: Secret header value for Method 2 access
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  next();
});

// BUG FIXED: Route order - More specific routes first to prevent conflicts
app.use('/api/auth', authRoutes);
app.use('/api/users/secret-stats', secretStatsRoutes); // PUZZLE: Secret endpoint must be registered before general users route
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  // Remove console.log for production as per requirements
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  // Keep startup logs for development - these can be removed for final submission
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`� Assessment 1: User Management API running on http://localhost:${PORT}`);
  }
});
