const express = require("express");
const cors = require("cors");
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();  // Load environment variables

// Import routes
const itemRoutes = require('./src/routes/item.routes');
const laadRoutes = require('./src/routes/laad.routes');
const saleRoutes = require('./src/routes/sale.routes');
const supplierRoutes = require('./src/routes/supplier.routes');
const customerRoutes = require('./src/routes/customer.routes');
const userRoutes = require('./src/routes/user.routes');
const gateRoutes = require('./src/routes/gate.routes');
const financialRoutes = require('./src/routes/financial.routes');
const vehicleRoutes = require('./src/routes/vehicle.routes');
const reportsRoutes = require('./src/routes/reports.routes');

// Import middleware
const logger = require('./src/config/logger');
const { sanitizeInput } = require('./src/middleware/security.middleware');
const { apiLimiter } = require('./src/middleware/rateLimiter.middleware');

const app = express();

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow iframe embedding if needed
}));

// CORS Configuration - SECURE
// Allow all origins (reflect request origin so credentials work across origins)
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page']
}));

// Compression middleware
app.use(compression());

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Additional security: check for suspicious content
    if (buf.length > 10 * 1024 * 1024) { // 10MB
      throw new Error('Request body too large');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100 // Limit number of parameters                   
}));

// Rate limiting - Apply to all routes
app.use('/api/', apiLimiter);

// Security middleware - XSS protection
app.use(sanitizeInput);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// API Routes with versioning
const API_VERSION = '/api/v1';

// Public routes (no authentication required)
app.use(`${API_VERSION}/auth`, userRoutes); // Auth routes (login, register)
app.use('/api/auth', userRoutes); // Backward compatibility for auth

// Protected routes (authentication required)
app.use(`${API_VERSION}/items`, itemRoutes);
app.use(`${API_VERSION}/laads`, laadRoutes);
app.use(`${API_VERSION}/sales`, saleRoutes);
app.use(`${API_VERSION}/suppliers`, supplierRoutes);
app.use(`${API_VERSION}/customers`, customerRoutes);
app.use(`${API_VERSION}/users`, userRoutes);
app.use(`${API_VERSION}/gate`, gateRoutes);
app.use(`${API_VERSION}/financial`, financialRoutes);
app.use(`${API_VERSION}/vehicles`, vehicleRoutes);
app.use(`${API_VERSION}/reports`, reportsRoutes);

// Backward compatibility - redirect old routes to new versioned routes
app.use('/api/items', itemRoutes);
app.use('/api/laads', laadRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/gate', gateRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/reports', reportsRoutes);


// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test API
app.get('/api/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Test API is working',
    timestamp: new Date().toISOString()
  });
});

// Import error handlers
const { errorHandler, notFound } = require('./src/middleware/errorHandler.middleware');

// 404 handler - must be after all routes
app.use(notFound);

// Global error handler - must be last
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;