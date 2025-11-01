const express = require("express");
const cors = require("cors");
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();  // Load environment variables
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
const logger = require('./src/config/logger');
const { sanitizeInput } = require('./src/middleware/security.middleware');

const app = express();

// Security Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(compression()); // Gzip compression

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware (XSS protection only - no rate limiting)
app.use(sanitizeInput); // XSS protection

// Routes
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;