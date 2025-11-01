const { PrismaClient } = require('@prisma/client');

/**
 * Prisma Client with connection pooling optimization
 */
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Graceful shutdown handler
 */
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;


