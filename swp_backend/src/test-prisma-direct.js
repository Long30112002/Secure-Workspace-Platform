// test-prisma-direct.js
const { PrismaClient } = require('@prisma/client');

async function test() {
  console.log('Testing Prisma directly...');
  const prisma = new PrismaClient({
    log: ['info'],
  });
  
  try {
    await prisma.$connect();
    console.log('✅ Connected!');
    
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users`);
    
    await prisma.$disconnect();
    console.log('✅ Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();