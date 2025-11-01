const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const logger = require('../src/config/logger');

async function main() {
  try {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    
    await prisma.user.upsert({
      where: { email: "admin@godam.com" },
      update: {},
      create: {
        name: "Admin",
        email: "admin@godam.com",
        password: hashedPassword,
        role: "ADMIN",
      },
    });
    
    logger.info("✅ Admin user seeded successfully");
  } catch (error) {
    logger.error("❌ Seeding failed:", error);
    throw error;
  }
}

main()
  .then(() => console.log("✅ Seeding completed"))
  .catch(e => console.error("❌ Seeding error:", e))
  .finally(async () => await prisma.$disconnect());