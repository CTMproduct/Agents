/* eslint-disable no-console */
import { PrismaClient, AutonomyLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Politica de autonomia inicial: TODO en L0 (humano aprueba el 100%).
  for (const taskCategory of ['informational_reply', 'followup', 'quote_draft']) {
    await prisma.autonomyPolicy.upsert({
      where: { taskCategory },
      update: {},
      create: { taskCategory, level: AutonomyLevel.L0_HUMAN_APPROVES_ALL },
    });
  }
  console.log('Seed OK: politicas de autonomia en L0.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
