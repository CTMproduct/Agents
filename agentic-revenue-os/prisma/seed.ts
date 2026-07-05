/* eslint-disable no-console */
import { PrismaClient, AutonomyLevel, AgentCategory, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Agentes internos de CTM (CRM propio) -- ver AgentDefinition.
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

// Catalogo del marketplace (las tarjetas que ve cualquier empresa que llegue a la plataforma).
const AGENT_TEMPLATES = [
  {
    key: 'sdr',
    name: 'Calificador de Leads AI (SDR)',
    tagline: 'Califica leads al instante, actualiza el CRM y agenda reuniones.',
    category: AgentCategory.SDR,
    avatarEmoji: '👩‍💼',
    accentColor: '#c4d94a',
    features: ['Califica leads al instante', 'Actualiza el CRM', 'Agenda reuniones'],
    defaultSkillMd:
      '# Rol\nEres un SDR (Sales Development Rep) que califica leads entrantes para esta empresa.\n\n' +
      '# Instrucciones\n- Identifica intencion, presupuesto aproximado y urgencia del lead.\n' +
      '- Redacta una respuesta breve, calida, en el idioma del cliente.\n' +
      '- Nunca inventes precios ni confirmes disponibilidad: eso lo valida un humano.\n' +
      '- Si el lead esta listo para agendar, propone continuar con un asesor humano.',
    defaultToolKeys: ['web_search'],
  },
  {
    key: 'sales_followup',
    name: 'Seguimiento de Ventas AI',
    tagline: 'Hace seguimientos, reactiva leads fríos y actualiza el CRM.',
    category: AgentCategory.SALES_FOLLOWUP,
    avatarEmoji: '🕴️',
    accentColor: '#8fb84a',
    features: ['Hace seguimientos', 'Reactiva leads', 'Actualiza el CRM'],
    defaultSkillMd:
      '# Rol\nEres el agente de seguimiento de ventas de esta empresa.\n\n' +
      '# Instrucciones\n- Retoma la conversacion con un lead que no ha respondido.\n' +
      '- Se breve y directo, sin sonar insistente.\n' +
      '- Nunca prometas descuentos ni cifras sin autorizacion humana.',
    defaultToolKeys: ['web_search'],
  },
  {
    key: 'collections',
    name: 'Especialista de Cobranzas AI',
    tagline: 'Recupera pagos, envía recordatorios y hace seguimiento de saldos.',
    category: AgentCategory.COLLECTIONS,
    avatarEmoji: '🤵',
    accentColor: '#3fae4a',
    features: ['Recupera pagos', 'Envía recordatorios', 'Llama por saldos'],
    defaultSkillMd:
      '# Rol\nEres el agente de cobranzas de esta empresa.\n\n' +
      '# Instrucciones\n- Redacta recordatorios de pago cordiales pero firmes.\n' +
      '- Nunca amenaces, ni confirmes montos exactos, ni ofrezcas condonaciones: eso lo decide un humano.\n' +
      '- Si el cliente disputa el cobro, escala a un humano de inmediato.',
    defaultToolKeys: [],
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

  // Agentes especializados internos de CTM: plataforma no monolitica -- cada
  // fila es un agente independiente, medible por separado en el dashboard de costos.
  for (const def of AGENT_DEFINITIONS) {
    await prisma.agentDefinition.upsert({
      where: { key: def.key },
      update: { name: def.name, role: def.role, systemPrompt: def.systemPrompt, toolKeys: def.toolKeys },
      create: def,
    });
  }

  // Catalogo del marketplace multi-tenant.
  for (const t of AGENT_TEMPLATES) {
    await prisma.agentTemplate.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        tagline: t.tagline,
        category: t.category,
        avatarEmoji: t.avatarEmoji,
        accentColor: t.accentColor,
        features: t.features,
        defaultSkillMd: t.defaultSkillMd,
        defaultToolKeys: t.defaultToolKeys,
      },
      create: t,
    });
  }

  // Admin de plataforma (tu cuenta): solo se crea si se dan las dos env vars,
  // nunca con una contrasena por defecto adivinable.
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: UserRole.PLATFORM_ADMIN },
      create: { email: adminEmail, passwordHash, role: UserRole.PLATFORM_ADMIN },
    });
    console.log(`Admin de plataforma listo: ${adminEmail}`);
  } else {
    console.log('PLATFORM_ADMIN_EMAIL/PLATFORM_ADMIN_PASSWORD no definidos: sin admin de plataforma creado.');
  }

  console.log('Seed OK: autonomia L0 + 3 agentes internos + 3 plantillas de marketplace.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
