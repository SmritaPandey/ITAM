import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Clearing all EndpointChange, AgentBaseline, and Agent records...');
    await prisma.endpointChange.deleteMany();
    await prisma.agentBaseline.deleteMany();
    await prisma.agent.deleteMany();
    console.log('✅ Database cleared successfully.');
  } catch (err) {
    console.error('Error clearing database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
