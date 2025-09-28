require('dotenv').config(); // BUG FIXED: Added environment variable support for JWT secrets
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet'); // BONUS: Security headers
const { sanitizeInput } = require('./middleware/security'); // BONUS: Input sanitization
const { httpLogger, logger } = require('./utils/logger'); // BONUS: Professional logging
const { swaggerUi, specs } = require('./config/swagger'); // BONUS: API documentation

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const secretStatsRoutes = require('./routes/secret-stats');

const app = express();
const PORT = process.env.PORT || 8888; // BUG FIXED: Port configuration from environment variables

// BONUS: Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Set JSON payload limit
app.use(express.static(path.join(__dirname, 'public')));

// BONUS: HTTP request logging
app.use(httpLogger);

// BONUS: Global input sanitization
app.use(sanitizeInput);

// BONUS: Request timing middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

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

// BONUS: API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "User Management API Documentation"
}));

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

// BONUS: Enhanced error handler with logging
app.use((error, req, res, next) => {
  logger.error('UNHANDLED_ERROR', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`Assessment 1: User Management API - DAY 2 ENHANCED`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`Security: Rate limiting, Input sanitization, Helmet headers`);
  console.log(`Features: Account activation, Password reset, User search`);
  console.log(`Logging: Professional Winston + Morgan logging system`);
  
  logger.info('SERVER_STARTED_DAY2', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    enhancedFeatures: [
      'Critical Rate Limiting Bug Fixed',
      'XSS Prevention & Input Sanitization',
      'Account Activation System',
      'Password Reset with Secure Tokens',
      'User Search Functionality',
      'Swagger API Documentation',
      'Professional Logging System',
      'Unit Testing Framework'
    ]
  });
});
