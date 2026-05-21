import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('=== AGENTS ===');
    const agents = await prisma.agent.findMany();
    console.log(JSON.stringify(agents, null, 2));

    console.log('=== BASELINES ===');
    const baselines = await prisma.agentBaseline.findMany();
    console.log(JSON.stringify(baselines.map(b => ({ id: b.id, agentId: b.agentId, snapshotAt: b.snapshotAt })), null, 2));

    console.log('=== ENDPOINT CHANGES / THREATS ===');
    const changes = await prisma.endpointChange.findMany();
    console.log(JSON.stringify(changes, null, 2));
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
