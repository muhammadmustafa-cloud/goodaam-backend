const express = require("express");
const cors = require("cors");
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();  // Load environment variables

// Import MongoDB connection
const { connectDB } = require('./src/config/mongodb');

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
const truckArrivalEntryRoutes = require('./src/routes/truckArrivalEntry.routes');
const stockRoutes = require('./src/routes/stock.routes');
// Migration routes removed - MongoDB doesn't need SQL migrations (schema is in Mongoose models)

// Import middleware
const logger = require('./src/config/logger');
const { sanitizeInput } = require('./src/middleware/security.middleware');
const { apiLimiter } = require('./src/middleware/rateLimiter.middleware');

const app = express();

// Fail fast if security-critical envs are missing
if (!process.env.JWT_SECRET) {
  logger.error('❌ JWT_SECRET is not set. Set it in your environment before starting the server.');
  process.exit(1);
}

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security Headers with Helmet (configured to not interfere with CORS)
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
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
}));

// CORS Configuration - SECURE & PRODUCTION READY
const allowedOrigins = (() => {
  // Comma-separated list in env
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  }
  // Single explicit frontend URL fallback
  if (process.env.FRONTEND_URL) return [process.env.FRONTEND_URL];
  // Sensible defaults for local dev only
  return ['http://localhost:3000'];
})();

// Check if we're in production (Render sets NODE_ENV=production by default)
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const hasExplicitOrigins = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL;

// Always allow Vercel origin in production
const vercelOrigin = 'https://godam-frontend.vercel.app';

// CORS configuration with explicit handling
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Always allow Vercel frontend in production
    if (origin === vercelOrigin) {
      logger.info(`✅ Allowing CORS from Vercel: ${origin}`);
      return callback(null, true);
    }
    
    // In production without explicit origins, allow all HTTPS origins
    // This is a fallback - it's better to set ALLOWED_ORIGINS or FRONTEND_URL env vars
    if (isProduction && !hasExplicitOrigins) {
      // Only allow HTTPS origins in production (security best practice)
      if (origin.startsWith('https://')) {
        logger.info(`✅ Allowing CORS from: ${origin} (production mode, no explicit origins set)`);
        return callback(null, true);
      }
      logger.warn(`❌ CORS blocked non-HTTPS origin in production: ${origin}`);
      return callback(new Error('Not allowed by CORS - HTTPS required in production'));
    }
    
    // Check explicit allowed origins
    if (allowedOrigins.includes(origin)) {
      logger.info(`✅ Allowing CORS from: ${origin}`);
      return callback(null, true);
    }
    
    // Log blocked origin for debugging
    logger.warn(`❌ CORS blocked origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours - cache preflight requests
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
app.use(`${API_VERSION}/truck-arrival-entries`, truckArrivalEntryRoutes);
app.use(`${API_VERSION}/stock`, stockRoutes);

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
app.use('/api/truck-arrival-entries', truckArrivalEntryRoutes);
app.use('/api/stock', stockRoutes);
// Migration routes removed - MongoDB doesn't need SQL migrations


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

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;