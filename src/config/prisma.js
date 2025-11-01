const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');   // 👈 bring in our fancy logger

const prisma = new PrismaClient();

// Handle DB Connection Events
prisma.$connect()
  .then(() => {
    logger.info('✅ Connected to PostgreSQL via Prisma');
  })
  .catch((err) => {
    logger.error('❌ DB Connection Error', {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1); // In prod, exit so PM2/Docker restarts app safely
  });



module.exports = prisma;