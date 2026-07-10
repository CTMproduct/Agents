/* eslint-disable no-console */
import { PrismaClient, AutonomyLevel, AgentCategory, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Catalogo global de Heroes (curado por CTM). Arte/modelos 3D son placeholders
// intercambiables. Cada heroe tiene un arbol lineal PASSIVE -> Q -> W -> E -> R.
const HERO_CATALOG = [
  {
    slug: 'hunter',
    name: 'The Hunter',
    role: 'HUNTER',
    splashUrl: 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.png',
    model3dUrl: 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb',
    passive: 'Detecta señales de intención de compra en cada mensaje del cliente.',
    ultimate: 'Cierra con una propuesta clara y un siguiente paso concreto.',
    skills: [
      { code: 'P', name: 'Instinto de caza', abilitySlot: 'PASSIVE', xpCost: 0, skillMd: 'Identifica en cada mensaje la señal de intención (destino, fechas, presupuesto, urgencia) y priorízala.' },
      { code: 'Q', name: 'Calificación relámpago', abilitySlot: 'Q', xpCost: 100, skillMd: 'Haz máximo 3 preguntas clave para calificar: destino, fechas y número de viajeros. No abrumes.' },
      { code: 'W', name: 'Descubrimiento de dolor', abilitySlot: 'W', xpCost: 150, skillMd: 'Descubre la motivación real del viaje (aniversario, negocio, descanso) para personalizar la oferta.' },
      { code: 'E', name: 'Propuesta de valor', abilitySlot: 'E', xpCost: 200, skillMd: 'Presenta el paquete resaltando 2-3 beneficios concretos. Nunca inventes tarifas: valida con el asesor.' },
      { code: 'R', name: 'Cierre asistido', abilitySlot: 'R', xpCost: 400, skillMd: 'Propón un siguiente paso claro (reservar cupo, agendar llamada) y crea urgencia honesta con disponibilidad real.' },
    ],
  },
  {
    slug: 'guardian',
    name: 'The Guardian',
    role: 'GUARDIAN',
    splashUrl: 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.png',
    model3dUrl: 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb',
    passive: 'Vigila la satisfacción del cliente y anticipa el riesgo de fuga (churn).',
    ultimate: 'Recupera un cliente molesto con una solución concreta y seguimiento.',
    skills: [
      { code: 'P', name: 'Escudo de retención', abilitySlot: 'PASSIVE', xpCost: 0, skillMd: 'Detecta señales de insatisfacción (demoras, quejas, dudas) y trátalas con prioridad.' },
      { code: 'Q', name: 'Escucha activa', abilitySlot: 'Q', xpCost: 100, skillMd: 'Reformula el problema del cliente para confirmar que lo entendiste antes de responder.' },
      { code: 'W', name: 'Contención', abilitySlot: 'W', xpCost: 150, skillMd: 'Reconoce la molestia con empatía y evita prometer lo que no puedes cumplir.' },
      { code: 'E', name: 'Resolución', abilitySlot: 'E', xpCost: 200, skillMd: 'Ofrece una solución concreta con pasos y tiempos. Escala al humano si excede tu alcance.' },
      { code: 'R', name: 'Rescate', abilitySlot: 'R', xpCost: 400, skillMd: 'Ante un cliente a punto de irse, ofrece una alternativa de valor y agenda seguimiento explícito.' },
    ],
  },
];

// Idempotente: crea/actualiza el heroe por slug; crea el arbol solo si no existe.
async function seedHeroes() {
  for (const h of HERO_CATALOG) {
    const hero = await prisma.heroTemplate.upsert({
      where: { slug: h.slug },
      update: { name: h.name, role: h.role, splashUrl: h.splashUrl, model3dUrl: h.model3dUrl, passive: h.passive, ultimate: h.ultimate, active: true },
      create: { slug: h.slug, name: h.name, role: h.role, splashUrl: h.splashUrl, model3dUrl: h.model3dUrl, passive: h.passive, ultimate: h.ultimate },
    });
    if ((await prisma.skillNode.count({ where: { heroId: hero.id } })) > 0) continue;
    const createdIds: string[] = [];
    for (let i = 0; i < h.skills.length; i++) {
      const n = h.skills[i];
      const parentId: string | null = i === 0 ? null : createdIds[i - 1]; // arbol lineal
      const row = await prisma.skillNode.create({
        data: { heroId: hero.id, parentId, code: n.code, name: n.name, abilitySlot: n.abilitySlot, skillMd: n.skillMd, xpCost: n.xpCost },
      });
      createdIds.push(row.id);
    }
  }
  console.log(`Heroes listos: ${HERO_CATALOG.map((h) => h.slug).join(', ')}`);
}

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

  await seedHeroes();

  // Admin de plataforma (tu cuenta): solo se crea si se dan las dos env vars,
  // nunca con una contrasena por defecto adivinable.
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    // El admin de plataforma tambien opera como una empresa propia (CTM es a la
    // vez el operador y un tenant que usa sus agentes). Sin un tenant no podria
    // activar/editar agentes, porque esos recursos son tenant-scoped.
    const adminTenant = await prisma.tenant.upsert({
      where: { slug: 'ctm-en-linea' },
      update: {},
      create: { name: 'CTM En Línea', slug: 'ctm-en-linea' },
    });
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: UserRole.PLATFORM_ADMIN, tenantId: adminTenant.id },
      create: { email: adminEmail, passwordHash, role: UserRole.PLATFORM_ADMIN, tenantId: adminTenant.id },
    });
    console.log(`Admin de plataforma listo: ${adminEmail} (empresa: ${adminTenant.name})`);
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
