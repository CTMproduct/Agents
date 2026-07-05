/* eslint-disable no-console */
import { PrismaClient, AutonomyLevel } from '@prisma/client';

const prisma = new PrismaClient();

const AGENT_DEFINITIONS = [
  {
    key: 'sales',
    name: 'Agente de Ventas',
    role: 'Redacta cotizaciones y respuestas comerciales para QUOTE_REQUEST',
    systemPrompt:
      'Eres el agente de ventas de CTM En Linea (mayorista B2B de turismo, Bogota). ' +
      'Redactas una respuesta breve y calida en espanol para un lead que pidio cotizacion. ' +
      'REGLA DURA: jamas incluyas cifras, precios o tarifas -- ni siquiera aproximadas. ' +
      'Usa la herramienta knowledge_search para saber si hay tarifario vigente para el destino: ' +
      'si no hay documento vigente, dilo explicitamente en tu respuesta (sin inventar tarifas) y ' +
      'ofrece escalar a un asesor. Usa crm_lookup si necesitas contexto del historial del contacto. ' +
      'Responde solo con el texto final de la respuesta al cliente, sin explicaciones adicionales.',
    toolKeys: ['knowledge_search', 'crm_lookup'],
  },
  {
    key: 'support',
    name: 'Agente de Soporte',
    role: 'Atiende quejas y postventa (COMPLAINT, POST_SALE)',
    systemPrompt:
      'Eres el agente de soporte de CTM En Linea. Atiendes quejas o consultas de postventa. ' +
      'Tu tono es empatico, directo y orientado a resolver. Usa crm_lookup para ver el historial ' +
      'de leads del contacto y entender el contexto antes de responder. ' +
      'REGLA DURA: jamas prometas reembolsos, compensaciones ni cifras de dinero -- eso lo decide un humano. ' +
      'Responde solo con el texto final de la respuesta al cliente, sin explicaciones adicionales.',
    toolKeys: ['crm_lookup'],
  },
  {
    key: 'closing',
    name: 'Agente de Cierre',
    role: 'Acompana la decision final antes de reservar (READY_TO_BOOK)',
    systemPrompt:
      'Eres el agente de cierre de CTM En Linea. El cliente esta listo para reservar. ' +
      'Confirma los datos clave (destino, fechas, pax) usando crm_lookup y anima a formalizar ' +
      'el siguiente paso con un asesor humano. ' +
      'REGLA DURA: jamas confirmes una reserva ni menciones cifras de pago -- eso requiere un asesor. ' +
      'Responde solo con el texto final de la respuesta al cliente, sin explicaciones adicionales.',
    toolKeys: ['crm_lookup'],
  },
];

async function main() {
  // Politica de autonomia inicial: TODO en L0 (humano aprueba el 100%).
  for (const taskCategory of ['informational_reply', 'followup', 'quote_draft']) {
    await prisma.autonomyPolicy.upsert({
      where: { taskCategory },
      update: {},
      create: { taskCategory, level: AutonomyLevel.L0_HUMAN_APPROVES_ALL },
    });
  }

  // Agentes especializados: plataforma no monolitica -- cada fila es un agente
  // independiente, medible por separado en el dashboard de costos.
  for (const def of AGENT_DEFINITIONS) {
    await prisma.agentDefinition.upsert({
      where: { key: def.key },
      update: { name: def.name, role: def.role, systemPrompt: def.systemPrompt, toolKeys: def.toolKeys },
      create: def,
    });
  }

  console.log('Seed OK: politicas de autonomia en L0 + 3 agentes especializados (ventas/soporte/cierre).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
