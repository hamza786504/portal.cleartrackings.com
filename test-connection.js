// Test Prisma database connection
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

async function testConnection() {
  try {
    const prisma = new PrismaClient({
      adapter: new PrismaMariaDb(process.env.DATABASE_URL),
      log: ['query']
    });

    // Try a simple query to test connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database connection successful!');
    console.log('Query result:', result);

    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error.message);
    return false;
  }
}

testConnection();