require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

// Database imports - PostgreSQL only
const {
  initPostgres,
  saveConversationPostgres,
  getConversationsPostgres,
  getConversationByIdPostgres,
  getAgentsPostgres,
  getAgentPostgres,
  saveAgentPostgres,
  isPostgresConnected,
} = require('./database/postgres');

const DATA_DIR = path.resolve(__dirname, './data');
const FALLBACK_FILE = path.join(DATA_DIR, 'fallback-conversations.json');

function loadFallbackStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(FALLBACK_FILE)) {
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify({ conversations: [], agents: [DEFAULT_AGENT] }, null, 2));
    }

    const raw = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.conversations)) {
      fallbackStorage.conversations = parsed.conversations;
    }
    if (parsed && Array.isArray(parsed.agents)) {
      fallbackStorage.agents = parsed.agents;
    }
  } catch (error) {
    console.warn('⚠️  No se pudo cargar el almacenamiento de respaldo:', error.message);
  }
}

function saveFallbackStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(fallbackStorage, null, 2));
  } catch (error) {
    console.warn('⚠️  No se pudo guardar el almacenamiento de respaldo:', error.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EVALUATION_MODEL = process.env.OPENAI_EVALUATION_MODEL || 'gpt-4o-mini';
const DEFAULT_AGENT_ID = 'agent_nora';
const DEFAULT_AGENT_VERSION_ID = 'agent_nora_v1';
const DEFAULT_AGENT_PROMPT = process.env.DEFAULT_AGENT_PROMPT || 'Eres Nora, una asistente de viajes de CTM. Responde en espanol con informacion clara, breve, amable y accionable.';
const NODE_ENV = process.env.NODE_ENV || 'development';
const AGENT_ADMIN_KEY = String(process.env.AGENT_ADMIN_KEY || '').trim();
const AGENT_MODELS = new Set(
  (process.env.ALLOWED_AGENT_MODELS || 'gpt-4o-mini,gpt-4o,gpt-4.1-mini,gpt-4.1')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
);
const AI_RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const AI_RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 30);

app.disable('x-powered-by');
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || FRONTEND_URL)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const localDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      // Allow server-to-server calls or tools like curl/postman
      return callback(null, true);
    }

    const isAllowedOrigin = allowedOrigins.includes(origin);
    const isLocalDevOrigin = localDevOrigins.includes(origin);
    const allowLocalDebug = process.env.ALLOW_LOCAL_DEBUG === 'true';

    if (NODE_ENV !== 'production') {
      return callback(null, true);
    }

    if (isAllowedOrigin || (allowLocalDebug && isLocalDevOrigin)) {
      return callback(null, true);
    }

    console.warn(`⚠️ CORS blocked origin: ${origin}`);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-Admin-Key'],
  credentials: true,
};

console.log('🔧 Configuration:');
console.log(`  NODE_ENV: ${NODE_ENV}`);
console.log(`  PORT: ${PORT}`);
console.log(`  FRONTEND_URL: ${FRONTEND_URL}`);
console.log(`  ALLOWED_ORIGINS: ${allowedOrigins.join(', ')}`);
console.log(`  ALLOW_LOCAL_DEBUG: ${process.env.ALLOW_LOCAL_DEBUG === 'true'}`);

// ============================================
// STATIC FILES - Serve Frontend FIRST
// ============================================
const frontendDistPath = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
const frontendAssetsPath = path.join(frontendDistPath, 'assets');

console.log('📁 Frontend dist path:', frontendDistPath);
console.log('📁 Frontend assets path:', frontendAssetsPath);
console.log('📁 Dist exists:', fs.existsSync(frontendDistPath));
console.log('📁 Assets exists:', fs.existsSync(frontendAssetsPath));

if (fs.existsSync(frontendAssetsPath)) {
  console.log('📦 Serving Vite assets from:', frontendAssetsPath);

  app.use('/assets', express.static(frontendAssetsPath, {
    immutable: true,
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }

      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
    },
  }));
} else {
  console.warn('⚠️  Frontend assets folder not found at:', frontendAssetsPath);
}

if (fs.existsSync(frontendDistPath)) {
  console.log('📁 Serving static files from:', frontendDistPath);

  app.use(express.static(frontendDistPath, {
    index: false,
  }));
} else {
  console.warn('⚠️  Frontend dist folder not found at:', frontendDistPath);
}

// Middleware API después de servir frontend/assets
app.use(cors(corsOptions));
app.use(express.json({ limit: '64kb' }));

// OpenAI Client
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY no está configurada');
  process.exit(1);
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_AGENT = {
  id: DEFAULT_AGENT_ID,
  slug: 'nora',
  name: 'Nora',
  description: 'Asistente de viajes y turismo de CTM',
  status: 'published',
  default_language: 'es',
  avatar: 'plane',
  active_version: {
    id: DEFAULT_AGENT_VERSION_ID,
    version: 1,
    system_prompt: DEFAULT_AGENT_PROMPT,
    model: OPENAI_MODEL,
    temperature: 0.4,
    max_tokens: 350,
    tools: [],
    guardrails: {},
  },
};

const fallbackStorage = {
  conversations: [],
  agents: [DEFAULT_AGENT],
};

loadFallbackStorage();
ensureFallbackDefaultAgent();

// Helper function to save conversation (PostgreSQL only)
async function saveConversation(data) {
  try {
    if (!data.id) {
      data.id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    const isPostgresReady = isPostgresConnected();
    console.log('\n📊 Database Save Status:');
    console.log(`   PostgreSQL connected: ${isPostgresReady}`);
    console.log(`   Conversation ID: ${data.id}`);

    if (isPostgresReady) {
      console.log('📡 Attempting to save to PostgreSQL...');
      const conversation = await saveConversationPostgres(data);
      console.log('✅ Successfully saved to PostgreSQL');
      return conversation;
    } else {
      console.log('⚠️  PostgreSQL not connected, will use memory fallback');
    }
  } catch (error) {
    console.error('\n❌ PostgreSQL save failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error('   Falling back to Memory Storage');
  }

  console.log('💾 Saving to Memory fallback...');
  fallbackStorage.conversations.unshift(data);
  saveFallbackStorage();
  console.log('✅ Saved to Memory fallback');
  return data;
}

// Helper function to get conversations (PostgreSQL only)
async function getConversations(limit = 100) {
  try {
    const isPostgresReady = isPostgresConnected();
    console.log(`\n📖 Getting conversations (limit: ${limit})`);
    console.log(`   PostgreSQL connected: ${isPostgresReady}`);

    if (isPostgresReady) {
      console.log('   Source: PostgreSQL');
      const result = await getConversationsPostgres(limit);
      console.log(`   Retrieved: ${result.length} conversations from PostgreSQL`);
      return result;
    }
  } catch (error) {
    console.error('❌ PostgreSQL query failed:');
    console.error(`   Error: ${error.message}`);
    console.error('   Falling back to Memory Storage');
  }

  console.log('   Source: Memory Storage (Fallback)');
  const result = fallbackStorage.conversations.slice(0, limit);
  console.log(`   Retrieved: ${result.length} conversations from Memory`);
  return result;
}

function slugify(value) {
  return String(value || 'agent')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'agent';
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validateAgentPayload(data = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw httpError(400, 'Los datos del agente no son validos');
  }

  const name = String(data.name || '').trim();
  if (!name) throw httpError(400, 'El nombre del agente es requerido');
  if (name.length > 80) throw httpError(400, 'El nombre no puede superar 80 caracteres');

  const slug = slugify(data.slug || name);
  const description = String(data.description || '').trim();
  if (description.length > 500) throw httpError(400, 'La descripcion no puede superar 500 caracteres');

  const status = String(data.status || 'draft').trim().toLowerCase();
  if (!['draft', 'published', 'paused'].includes(status)) {
    throw httpError(400, 'El estado del agente no es valido');
  }

  const payload = {
    ...data,
    name,
    slug,
    description,
    status,
    default_language: String(data.default_language || 'es').trim().slice(0, 12) || 'es',
    avatar: String(data.avatar || 'bot').trim().slice(0, 40) || 'bot',
  };

  if (hasOwn(data, 'system_prompt')) {
    const prompt = String(data.system_prompt || '').trim();
    if (!prompt) throw httpError(400, 'El prompt del sistema es requerido');
    if (prompt.length > 20_000) throw httpError(400, 'El prompt no puede superar 20000 caracteres');
    payload.system_prompt = prompt;
  }

  if (hasOwn(data, 'model')) {
    const model = String(data.model || '').trim();
    if (!AGENT_MODELS.has(model)) throw httpError(400, 'El modelo seleccionado no esta permitido');
    payload.model = model;
  }

  if (hasOwn(data, 'temperature')) {
    const temperature = Number(data.temperature);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      throw httpError(400, 'La temperatura debe estar entre 0 y 2');
    }
    payload.temperature = temperature;
  }

  if (hasOwn(data, 'max_tokens')) {
    const maxTokens = Number(data.max_tokens);
    if (!Number.isInteger(maxTokens) || maxTokens < 80 || maxTokens > 4000) {
      throw httpError(400, 'Max tokens debe estar entre 80 y 4000');
    }
    payload.max_tokens = maxTokens;
  }

  if (hasOwn(data, 'tools') && !Array.isArray(data.tools)) {
    throw httpError(400, 'Las herramientas del agente deben ser una lista');
  }

  if (
    hasOwn(data, 'guardrails') &&
    (!data.guardrails || typeof data.guardrails !== 'object' || Array.isArray(data.guardrails))
  ) {
    throw httpError(400, 'Las reglas del agente deben ser un objeto');
  }

  return payload;
}

function secureCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hasAgentAdminAccess(req) {
  if (!AGENT_ADMIN_KEY) return NODE_ENV !== 'production';
  return secureCompare(req.get('X-Agent-Admin-Key'), AGENT_ADMIN_KEY);
}

function requireAgentAdmin(req, res, next) {
  if (!AGENT_ADMIN_KEY && NODE_ENV === 'production') {
    return res.status(503).json({
      status: 'error',
      message: 'La administracion de agentes aun no esta configurada',
    });
  }

  if (!hasAgentAdminAccess(req)) {
    return res.status(401).json({ status: 'error', message: 'Clave de administracion incorrecta' });
  }

  return next();
}

function toPublicAgent(agent) {
  if (!agent) return null;
  const activeVersion = agent.active_version || {};
  return {
    id: agent.id,
    slug: agent.slug,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    default_language: agent.default_language,
    avatar: agent.avatar,
    active_version: {
      id: activeVersion.id,
      version: activeVersion.version,
      model: activeVersion.model,
    },
  };
}

function createRateLimiter(windowMs, maxRequests) {
  const clients = new Map();
  const safeWindowMs = Number.isFinite(windowMs) && windowMs >= 1000 ? windowMs : 60_000;
  const safeMax = Number.isFinite(maxRequests) && maxRequests >= 1 ? maxRequests : 30;

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = clients.get(key);
    const entry = !current || now - current.startedAt >= safeWindowMs
      ? { startedAt: now, count: 0 }
      : current;

    entry.count += 1;
    clients.set(key, entry);
    res.setHeader('X-RateLimit-Limit', String(safeMax));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(safeMax - entry.count, 0)));

    if (entry.count > safeMax) {
      res.setHeader('Retry-After', String(Math.ceil((safeWindowMs - (now - entry.startedAt)) / 1000)));
      return res.status(429).json({
        status: 'error',
        message: 'Demasiadas solicitudes. Intenta nuevamente en un momento.',
      });
    }

    if (clients.size > 2000) {
      for (const [clientKey, value] of clients) {
        if (now - value.startedAt >= safeWindowMs) clients.delete(clientKey);
      }
    }

    return next();
  };
}

const aiRateLimit = createRateLimiter(AI_RATE_LIMIT_WINDOW_MS, AI_RATE_LIMIT_MAX);

function ensureFallbackDefaultAgent() {
  if (!Array.isArray(fallbackStorage.agents)) {
    fallbackStorage.agents = [];
  }

  const existingIndex = fallbackStorage.agents.findIndex(
    (agent) => agent.id === DEFAULT_AGENT_ID || agent.slug === DEFAULT_AGENT.slug,
  );

  if (existingIndex === -1) {
    fallbackStorage.agents.unshift(DEFAULT_AGENT);
  } else {
    fallbackStorage.agents[existingIndex] = {
      ...DEFAULT_AGENT,
      ...fallbackStorage.agents[existingIndex],
      active_version: {
        ...DEFAULT_AGENT.active_version,
        ...(fallbackStorage.agents[existingIndex].active_version || {}),
      },
    };
  }

  saveFallbackStorage();
}

async function getAgents() {
  try {
    if (isPostgresConnected()) {
      return await getAgentsPostgres();
    }
  } catch (error) {
    console.error('Error loading agents from PostgreSQL:', error.message);
  }

  ensureFallbackDefaultAgent();
  return fallbackStorage.agents;
}

async function getAgent(identifier = DEFAULT_AGENT_ID) {
  const key = String(identifier || DEFAULT_AGENT_ID);
  const normalizedKey = key.toLowerCase();

  try {
    if (isPostgresConnected()) {
      const agent = await getAgentPostgres(key);
      if (agent) return agent;
    }
  } catch (error) {
    console.error('Error loading agent from PostgreSQL:', error.message);
  }

  ensureFallbackDefaultAgent();
  return fallbackStorage.agents.find((agent) => {
    return [agent.id, agent.slug, agent.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase() === normalizedKey);
  }) || null;
}

async function saveAgent(data) {
  const payload = validateAgentPayload(data);
  const { name } = payload;

  try {
    if (isPostgresConnected()) {
      return await saveAgentPostgres(payload);
    }
  } catch (error) {
    console.error('Error saving agent to PostgreSQL:', error.message);
    if (error.code === '23505') {
      throw httpError(409, 'Ya existe un agente con ese identificador');
    }
    throw error;
  }

  ensureFallbackDefaultAgent();

  const existingIndex = payload.id
    ? fallbackStorage.agents.findIndex((agent) => agent.id === payload.id)
    : -1;
  const slugOwnerIndex = fallbackStorage.agents.findIndex((agent) => agent.slug === payload.slug);
  if (slugOwnerIndex >= 0 && slugOwnerIndex !== existingIndex) {
    throw httpError(409, 'Ya existe un agente con ese identificador');
  }
  const current = existingIndex >= 0 ? fallbackStorage.agents[existingIndex] : null;
  const currentVersion = current?.active_version || DEFAULT_AGENT.active_version;
  const shouldCreateVersion =
    !current ||
    (payload.system_prompt !== undefined && payload.system_prompt !== currentVersion.system_prompt) ||
    (payload.model !== undefined && payload.model !== currentVersion.model) ||
    (payload.temperature !== undefined && Number(payload.temperature) !== Number(currentVersion.temperature)) ||
    (payload.max_tokens !== undefined && Number(payload.max_tokens) !== Number(currentVersion.max_tokens)) ||
    (payload.tools !== undefined && JSON.stringify(payload.tools) !== JSON.stringify(currentVersion.tools || [])) ||
    (payload.guardrails !== undefined && JSON.stringify(payload.guardrails) !== JSON.stringify(currentVersion.guardrails || {}));

  const id = current?.id || payload.id || `agent_${payload.slug}_${Date.now()}`;
  const activeVersion = shouldCreateVersion
    ? {
        id: `agent_version_${Date.now()}`,
        version: Number(currentVersion.version || 0) + 1,
        system_prompt: payload.system_prompt || currentVersion.system_prompt || DEFAULT_AGENT_PROMPT,
        model: payload.model || currentVersion.model || OPENAI_MODEL,
        temperature: Number(payload.temperature ?? currentVersion.temperature ?? 0.4),
        max_tokens: Number(payload.max_tokens ?? currentVersion.max_tokens ?? 350),
        tools: payload.tools || currentVersion.tools || [],
        guardrails: payload.guardrails || currentVersion.guardrails || {},
        created_at: new Date().toISOString(),
      }
    : currentVersion;

  const agent = {
    ...current,
    id,
    slug: payload.slug,
    name,
    description: payload.description ?? current?.description ?? '',
    status: payload.status || current?.status || 'draft',
    default_language: payload.default_language || current?.default_language || 'es',
    avatar: payload.avatar || current?.avatar || 'bot',
    created_at: current?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active_version: activeVersion,
  };

  if (existingIndex >= 0) {
    fallbackStorage.agents[existingIndex] = agent;
  } else {
    fallbackStorage.agents.unshift(agent);
  }

  saveFallbackStorage();
  return agent;
}

function getAgentIdentifierFromPayload(payload = {}) {
  return payload.agent_id || payload.agent_slug || payload.agent || payload.asistente_nombre || DEFAULT_AGENT_ID;
}

async function resolveAgentFromPayload(payload = {}) {
  const agent = await getAgent(getAgentIdentifierFromPayload(payload));
  if (!agent) throw httpError(404, 'Agente no encontrado');
  return agent;
}

// ============================================
// ENDPOINTS: Agentes
// ============================================
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await getAgents();
    res.json({
      status: 'success',
      count: agents.length,
      data: hasAgentAdminAccess(req) ? agents : agents.map(toPublicAgent),
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener agentes' });
  }
});

app.post('/api/agents/admin/verify', requireAgentAdmin, (req, res) => {
  res.json({ status: 'success', configured: Boolean(AGENT_ADMIN_KEY) });
});

app.post('/api/agents', requireAgentAdmin, async (req, res) => {
  try {
    const agent = await saveAgent(req.body);
    res.status(201).json({ status: 'success', data: agent });
  } catch (error) {
    console.error('Error creating agent:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      status: 'error',
      message: statusCode >= 500 ? 'Error al crear agente' : error.message,
    });
  }
});

app.get('/api/agents/:id', async (req, res) => {
  try {
    const agent = await getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ status: 'error', message: 'Agente no encontrado' });
    }
    res.json({ status: 'success', data: hasAgentAdminAccess(req) ? agent : toPublicAgent(agent) });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener agente' });
  }
});

app.patch('/api/agents/:id', requireAgentAdmin, async (req, res) => {
  try {
    const current = await getAgent(req.params.id);
    if (!current) {
      return res.status(404).json({ status: 'error', message: 'Agente no encontrado' });
    }

    const payload = {
      id: current.id,
      name: req.body.name ?? current.name,
      slug: req.body.slug ?? current.slug,
      description: req.body.description ?? current.description,
      status: req.body.status ?? current.status,
      default_language: req.body.default_language ?? current.default_language,
      avatar: req.body.avatar ?? current.avatar,
    };

    for (const key of ['system_prompt', 'model', 'temperature', 'max_tokens', 'tools', 'guardrails']) {
      if (hasOwn(req.body, key)) payload[key] = req.body[key];
    }

    const agent = await saveAgent(payload);
    res.json({ status: 'success', data: agent });
  } catch (error) {
    console.error('Error updating agent:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      status: 'error',
      message: statusCode >= 500 ? 'Error al actualizar agente' : error.message,
    });
  }
});

app.post('/api/agents/:id/test', requireAgentAdmin, aiRateLimit, async (req, res) => {
  try {
    const { pregunta } = req.body;
    if (!pregunta || !String(pregunta).trim()) {
      return res.status(400).json({ status: 'error', message: 'Falta campo requerido: pregunta' });
    }

    const agent = await getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ status: 'error', message: 'Agente no encontrado' });
    }

    const generated = await generateAssistantResponse(String(pregunta).trim(), agent);
    if (!generated.respuesta) {
      return res.status(502).json({ status: 'error', message: 'No se pudo generar respuesta con OpenAI' });
    }

    res.json({
      status: 'success',
      respuesta: generated.respuesta,
      modelo: generated.model,
      agent: toPublicAgent(agent),
      telemetry: generated,
    });
  } catch (error) {
    console.error('Error testing agent:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      status: 'error',
      message: statusCode >= 500 ? 'Error al probar agente' : error.message,
    });
  }
});
// API status route
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Nora API Backend is running',
    agentAdminConfigured: Boolean(AGENT_ADMIN_KEY),
    database: isPostgresConnected()
      ? 'PostgreSQL ✅'
      : 'Memory (fallback) ⚠️',
    endpoints: {
      agents: '/api/agents',
      metrics: '/api/metrics',
      health: '/health',
      chat: '/api/chat',
      chatCapture: '/api/chat-capturar',
      capture: '/api/capturar-conversacion',
      conversations: '/api/conversations',
      export: '/api/export/conversations',
      frontend: '/',
    }
  });
});
// ============================================
// ENDPOINT: POST /api/chat
// ============================================
app.post('/api/chat', aiRateLimit, async (req, res) => {
  try {
    const { pregunta } = req.body;

    if (typeof pregunta !== 'string' || !pregunta.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Falta campo requerido: pregunta',
      });
    }

    const agent = await resolveAgentFromPayload(req.body);
    const generated = await generateAssistantResponse(pregunta.trim(), agent);

    if (!generated.respuesta) {
      return res.status(502).json({
        status: 'error',
        message: 'No se pudo generar respuesta con OpenAI',
      });
    }

    return res.status(200).json({
      status: 'success',
      respuesta: generated.respuesta,
      modelo: generated.model,
      agent: toPublicAgent(agent),
      telemetry: generated,
    });
  } catch (error) {
    console.error('Error generating chat response:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: statusCode >= 500 ? 'Error al generar respuesta' : error.message,
    });
  }
});
// ============================================
// ENDPOINT: POST /api/chat-capturar
// ============================================
app.post('/api/chat-capturar', aiRateLimit, async (req, res) => {
  try {
    const {
      pregunta,
      usuario_nombre,
      usuario_email,
      usuario_id,
      region = 'Nora',
      asistente_nombre = 'NORA',
      categoria,
      origen_pais,
      pregunta_base,
      fuente = 'DASHBOARD',
      tipo_interaccion = 'respuesta_gpt',
    } = req.body;

    if (typeof pregunta !== 'string' || !pregunta.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Falta campo requerido: pregunta',
      });
    }

    const agent = await resolveAgentFromPayload(req.body);
    const generated = await generateAssistantResponse(pregunta.trim(), agent);

    if (!generated.respuesta) {
      return res.status(502).json({
        status: 'error',
        message: 'No se pudo generar respuesta con OpenAI',
      });
    }

    const conversationData = {
      agent_id: agent.id,
      agent_version_id: agent.active_version?.id,
      asistente_nombre: agent.name || asistente_nombre,
      pregunta,
      respuesta: generated.respuesta,
      usuario_nombre,
      usuario_email,
      usuario_id,
      region,
      status: 'capturada',
      score_promedio: 4.5,
      categoria: categoria || 'No especificado',
      origen_pais: origen_pais || 'No especificado',
      pregunta_base: pregunta_base || null,
      fuente,
      tipo_interaccion,
      provider: generated.provider,
      model: generated.model,
      latency_ms: generated.latency_ms,
      tokens_input: generated.tokens_input,
      tokens_output: generated.tokens_output,
      cost_usd: generated.cost_usd,
    };

    const savedConversation = await saveConversation(conversationData);

    return res.status(200).json({
      status: 'success',
      respuesta: generated.respuesta,
      modelo: generated.model,
      agent: toPublicAgent(agent),
      conversationId: savedConversation.id || savedConversation._id,
      score_promedio: savedConversation.score_promedio,
      database: isPostgresConnected() ? 'PostgreSQL' : 'Memory',
    });
  } catch (error) {
    console.error('Error generating and capturing conversation:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: statusCode >= 500 ? 'Error al generar y capturar la conversacion' : error.message,
    });
  }
});

// ============================================
// ENDPOINT: POST /api/capturar-conversacion
// ============================================
app.post('/api/capturar-conversacion', aiRateLimit, async (req, res) => {
  try {
    const {
      asistente_nombre,
      pregunta,
      respuesta,
      usuario_nombre,
      usuario_email,
      usuario_id,
      region,
      status = 'capturada',
      // Nuevos campos opcionales
      categoria,
      origen_pais,
      pregunta_base,
      fuente,
      tipo_interaccion,
    } = req.body;

    // Validacion
    if (
      typeof pregunta !== 'string' ||
      !pregunta.trim() ||
      typeof respuesta !== 'string' ||
      !respuesta.trim()
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Faltan campos requeridos: pregunta, respuesta',
      });
    }

    const agent = await resolveAgentFromPayload(req.body);

    let scorePromedio = 4.5;
    try {
      const evaluation = await openai.chat.completions.create({
        model: EVALUATION_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Eres un evaluador de calidad. Evalúa en escala 1-5. Responde solo con un número.',
          },
          {
            role: 'user',
            content: `Pregunta: ${pregunta}\n\nRespuesta: ${respuesta}\n\nCalifica:`,
          },
        ],
        max_tokens: 10,
      });

      const scoreText = evaluation.choices[0].message.content.trim();
      scorePromedio = Math.min(Math.max(parseFloat(scoreText) || 4.5, 1), 5);
    } catch (err) {
      console.error('Error evaluating with OpenAI:', err.message);
    }

    // Guardar conversacion con campos opcionales
    const conversationData = {
      agent_id: agent.id,
      agent_version_id: agent.active_version?.id,
      asistente_nombre: agent.name || asistente_nombre || 'NORA',
      pregunta,
      respuesta,
      usuario_nombre,
      usuario_email,
      usuario_id,
      region,
      status,
      score_promedio: scorePromedio,
      // Campos opcionales con defaults
      categoria: categoria || 'No especificado',
      origen_pais: origen_pais || 'No especificado',
      pregunta_base: pregunta_base || null,
      fuente: fuente || 'GPT_ACTION',
      tipo_interaccion: tipo_interaccion || 'respuesta_gpt',
      provider: 'openai',
      model: agent.active_version?.model || OPENAI_MODEL,
    };

    const savedConversation = await saveConversation(conversationData);

    const database = isPostgresConnected()
      ? 'PostgreSQL'
      : 'Memory';

    res.status(200).json({
      status: 'success',
      message: 'Captura registrada correctamente',
      data: {
        conversationId: savedConversation.id || savedConversation._id,
      },
      score_promedio: scorePromedio,
      agent: toPublicAgent(agent),
      database: database,
    });
  } catch (error) {
    console.error('Error capturing conversation:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      status: 'error',
      message: statusCode >= 500 ? 'Error al capturar la conversacion' : error.message,
    });
  }
});

// ============================================
// ENDPOINT: GET /api/conversations
// ============================================
app.get('/api/conversations', requireAgentAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const conversations = await getConversations(limit);

    const database = isPostgresConnected()
      ? 'PostgreSQL'
      : 'Memory';

    res.json({
      status: 'success',
      count: conversations.length,
      data: conversations,
      database: database,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener conversaciones',
    });
  }
});

// ============================================
// ENDPOINT: GET /api/export/conversations (CSV/JSON)
// ============================================
app.get('/api/export/conversations', requireAgentAdmin, async (req, res) => {
  try {
    const format = req.query.format || 'json'; // 'json' o 'csv'
    const conversations = await getConversations(1000);

    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(conversations);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=conversations.csv');
      res.send(csv);
    } else {
      // JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=conversations.json');
      res.json({
        status: 'success',
        exportedAt: new Date(),
        count: conversations.length,
        data: conversations,
      });
    }
  } catch (error) {
    console.error('Error exporting conversations:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al exportar conversaciones',
    });
  }
});

// ============================================
// ENDPOINTS: Métricas
// ============================================
app.get('/api/metrics', requireAgentAdmin, async (req, res) => {
  try {
    const conversations = await getConversations();
    const total = conversations.length;
    const avgSatisfaction = total > 0
      ? conversations.reduce((sum, c) => sum + (c.score_promedio || 0), 0) / total
      : 0;

    // Calcular métricas de alucinación de forma dinámica
    // Consideramos alucinación o respuesta de baja calidad cuando el score_promedio es <= 3.0
    const hallucinatedConversations = conversations.filter(c => (c.score_promedio || 5) <= 3.0);
    const hallucinationCount = hallucinatedConversations.length;
    const hallucinationRate = total > 0
      ? parseFloat(((hallucinationCount / total) * 100).toFixed(2))
      : 2.3; // Fallback estático solo si no hay datos
    const factualAccuracy = parseFloat((100 - hallucinationRate).toFixed(2));

    // Clasificación dinámica de temas basados en palabras clave de la conversación
    const byTopic = {
      'Travel Info': 0,
      'Flight Details': 0,
      'Hotel Booking': 0,
      'General Info': 0
    };

    if (total > 0) {
      conversations.forEach(c => {
        const text = `${c.pregunta || ''} ${c.respuesta || ''}`.toLowerCase();
        if (text.includes('vuelo') || text.includes('avion') || text.includes('aerolinea') || text.includes('ticket') || text.includes('aeropuert') || text.includes('escala')) {
          byTopic['Flight Details']++;
        } else if (text.includes('hotel') || text.includes('hospedaje') || text.includes('alojamiento') || text.includes('reserva') || text.includes('habitacion')) {
          byTopic['Hotel Booking']++;
        } else if (text.includes('viaje') || text.includes('turism') || text.includes('destino') || text.includes('itinerari') || text.includes('pais') || text.includes('ciudad')) {
          byTopic['Travel Info']++;
        } else {
          byTopic['General Info']++;
        }
      });
    } else {
      // Fallback estático si no hay conversaciones registradas
      byTopic['Travel Info'] = 5;
      byTopic['Flight Details'] = 12;
      byTopic['Hotel Booking'] = 8;
      byTopic['General Info'] = 4;
    }

    // Calcular nuevas métricas opcionales
    const byCategoriaUsuario = {};
    const byOrigenPais = {};
    const byPreguntaBase = {};

    if (total > 0) {
      conversations.forEach(c => {
        // Por categoría de usuario
        const categoria = c.categoria || 'No especificado';
        byCategoriaUsuario[categoria] = (byCategoriaUsuario[categoria] || 0) + 1;

        // Por origen del país
        const pais = c.origen_pais || 'No especificado';
        byOrigenPais[pais] = (byOrigenPais[pais] || 0) + 1;

        // Por pregunta base (si existe)
        if (c.pregunta_base) {
          byPreguntaBase[c.pregunta_base] = (byPreguntaBase[c.pregunta_base] || 0) + 1;
        }
      });
    }

    res.json({
      status: 'success',
      conversations: {
        total,
        today: conversations.filter(c => {
          const today = new Date().toDateString();
          const rawDate = c.timestamp || c.createdAt;
          const cDate = rawDate ? new Date(rawDate).toDateString() : new Date().toDateString();
          return today === cDate;
        }).length,
        averageDuration: 4.5,
        averageSatisfaction: parseFloat(avgSatisfaction.toFixed(2)),
        trend: 12.5,
      },
      performance: {
        uptime: 99.8,
        averageLatency: 245,
        errorRate: parseFloat((hallucinationRate / 10).toFixed(2)), // Tasa de error correlacionada con alucinaciones
        requestsPerMinute: 120,
        peakLatency: 890,
      },
      hallucination: {
        rate: hallucinationRate,
        count: hallucinationCount,
        factualAccuracy,
        byTopic,
      },
      // Nuevas métricas opcionales
      usuariosMetricas: {
        byCategoriaUsuario,
        byOrigenPais,
      },
      preguntasMetricas: {
        byPreguntaBase: Object.keys(byPreguntaBase).length > 0 ? byPreguntaBase : null,
      },
      database: isPostgresConnected()
        ? 'PostgreSQL'
        : 'Memory',
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener metricas',
    });
  }
});

app.get('/api/metricas-asistente', requireAgentAdmin, async (req, res) => {
  try {
    const asistente = req.query.asistente || 'NORA';
    const region = req.query.region || null;
    const conversations = await getConversations(1000);
    const total = conversations.length;
    const uniqueUsers = new Set(
      conversations
        .map((c) => c.usuario_id || c.usuario_email || c.usuario_nombre || '')
        .filter(Boolean),
    );
    const avgScore = total > 0
      ? conversations.reduce((sum, c) => sum + (c.score_promedio || 3), 0) / total
      : 3;

    res.json({
      asistente,
      region,
      total_conversaciones: total,
      total_usuarios: uniqueUsers.size,
      score_promedio: parseFloat(avgScore.toFixed(2)),
      score_precision: parseFloat(avgScore.toFixed(2)),
      score_claridad: parseFloat(avgScore.toFixed(2)),
      score_relevancia: parseFloat(avgScore.toFixed(2)),
      score_completitud: parseFloat(avgScore.toFixed(2)),
      score_utilidad: parseFloat(avgScore.toFixed(2)),
      detalles: conversations.map((c) => ({
        id: c._id || c.id || null,
        asistente_nombre: c.asistente_nombre || asistente,
        region: c.region || region,
        usuario_nombre: c.usuario_nombre || 'Usuario Anónimo',
        usuario_email: c.usuario_email || null,
        usuario_id: c.usuario_id || null,
        pregunta: c.pregunta || '',
        respuesta: c.respuesta || '',
        score_precision: c.score_promedio || 3,
        score_claridad: c.score_promedio || 3,
        score_relevancia: c.score_promedio || 3,
        score_completitud: c.score_promedio || 3,
        score_utilidad: c.score_promedio || 3,
        score_promedio: c.score_promedio || 3,
        justificacion: 'Evaluación automática no disponible',
        timestamp: c.timestamp || c.createdAt || new Date().toISOString(),
        created_at: c.timestamp || c.createdAt || new Date().toISOString(),
        updated_at: c.updatedAt || c.timestamp || c.createdAt || new Date().toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching CTM metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener metricas CTM',
    });
  }
});

app.get('/api/conversations/history', requireAgentAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 24;
    const conversations = await getConversations(1000);
    const history = Array.from({ length: limit }, (_, i) => {
      const start = new Date(Date.now() - (limit - i - 1) * 3600000);
      start.setMinutes(0, 0, 0);
      const end = new Date(start.getTime() + 3600000);
      const items = conversations.filter((c) => {
        const raw = c.timestamp || c.created_at || c.createdAt;
        const date = raw ? new Date(raw) : null;
        return date && !isNaN(date.getTime()) && date >= start && date < end;
      });
      const score = items.length
        ? items.reduce((sum, c) => sum + (Number(c.score_promedio) || 0), 0) / items.length
        : 0;
      return {
        timestamp: start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
        count: items.length,
        satisfaction: parseFloat(score.toFixed(1)),
      };
    });
    res.json(history);
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener el historial' });
  }
});

app.get('/api/performance/history', requireAgentAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 24;
    const conversations = await getConversations(1000);
    const history = Array.from({ length: limit }, (_, i) => {
      const start = new Date(Date.now() - (limit - i - 1) * 3600000);
      start.setMinutes(0, 0, 0);
      const end = new Date(start.getTime() + 3600000);
      const items = conversations.filter((c) => {
        const raw = c.timestamp || c.created_at || c.createdAt;
        const date = raw ? new Date(raw) : null;
        return date && !isNaN(date.getTime()) && date >= start && date < end;
      });
      const latencyItems = items.map((c) => Number(c.latency_ms || 0)).filter((n) => n > 0);
      const latency = latencyItems.length
        ? latencyItems.reduce((sum, n) => sum + n, 0) / latencyItems.length
        : 0;
      return {
        timestamp: start.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
        latency: Math.round(latency),
        errors: 0,
      };
    });
    res.json(history);
  } catch (error) {
    console.error('Error fetching performance history:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener el historial de rendimiento' });
  }
});

app.get('/api/hallucinations/history', requireAgentAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 7;
    const conversations = await getConversations(1000);
    const history = Array.from({ length: limit }, (_, i) => {
      const day = new Date(Date.now() - (limit - i - 1) * 86400000);
      const items = conversations.filter((c) => {
        const raw = c.timestamp || c.created_at || c.createdAt;
        const date = raw ? new Date(raw) : null;
        return date && !isNaN(date.getTime()) && date.toDateString() === day.toDateString();
      });
      const lowQuality = items.filter((c) => (Number(c.score_promedio) || 5) <= 3);
      return {
        date: day.toLocaleDateString('es'),
        rate: items.length ? parseFloat(((lowQuality.length / items.length) * 100).toFixed(2)) : 0,
        count: lowQuality.length,
      };
    });
    res.json(history);
  } catch (error) {
    console.error('Error fetching hallucination history:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener el historial de calidad' });
  }
});

// ============================================
// ENDPOINT: GET /api/conversations/:id
// ============================================
app.get('/api/conversations/:id', requireAgentAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let conversation = null;

    if (isPostgresConnected()) {
      conversation = await getConversationByIdPostgres(id);
    }

    if (!conversation) {
      conversation = fallbackStorage.conversations.find((c) => c.id === id || c._id === id) || null;
    }

    if (!conversation) {
      return res.status(404).json({ status: 'error', error: 'Conversacion no encontrada' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener la conversacion' });
  }
});

// ============================================
// Health Check
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: isPostgresConnected()
      ? 'PostgreSQL Connected'
      : 'Using Memory Storage',
    conversationsCaptured: fallbackStorage.conversations.length,
  });
});

// ============================================
// SPA Fallback - Serve index.html for frontend routes
// ============================================
app.get('*', (req, res) => {
  // Don't serve index.html for API routes or health check
  if (
    req.path.startsWith('/api') ||
    req.path === '/health' ||
    req.path.startsWith('/assets')
  ) {
    res.status(404).json({
      status: 'error',
      message: `Endpoint no encontrado: ${req.method} ${req.path}`,
      availableEndpoints: {
        GET: ['/health', '/api/metrics', '/api/conversations', '/api/export/conversations'],
        POST: ['/api/chat', '/api/capturar-conversacion']
      }
    });
    return;
  }

  // Serve index.html for all other routes (frontend SPA)
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
      }
    });
  } else {
    res.status(404).json({
      status: 'error',
      message: 'Frontend not found. Please ensure frontend is built.',
      details: `Expected dist at: ${indexPath}`
    });
  }
});

// ============================================
// Error Handlers
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    error: NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// ============================================
// Helper Functions
// ============================================
async function generateAssistantResponse(pregunta, agent = DEFAULT_AGENT) {
  const activeVersion = agent?.active_version || DEFAULT_AGENT.active_version;
  const startedAt = Date.now();
  const completion = await openai.chat.completions.create({
    model: activeVersion.model || OPENAI_MODEL,
    temperature: Number(activeVersion.temperature ?? 0.4),
    max_tokens: Number(activeVersion.max_tokens || 350),
    messages: [
      {
        role: 'system',
        content: activeVersion.system_prompt || DEFAULT_AGENT_PROMPT,
      },
      { role: 'user', content: pregunta },
    ],
  });

  return {
    respuesta: completion.choices[0]?.message?.content?.trim() || '',
    provider: 'openai',
    model: activeVersion.model || OPENAI_MODEL,
    latency_ms: Date.now() - startedAt,
    tokens_input: completion.usage?.prompt_tokens || 0,
    tokens_output: completion.usage?.completion_tokens || 0,
    cost_usd: 0,
  };
}
function convertToCSV(conversations) {
  const headers = ['ID', 'Asistente', 'Pregunta', 'Respuesta', 'Usuario', 'Email', 'Score', 'Fecha'];
  const rows = conversations.map(c => {
    const rawDate = c.timestamp || c.createdAt;
    let dateStr;
    try {
      const d = rawDate ? new Date(rawDate) : new Date();
      dateStr = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch (e) {
      dateStr = new Date().toISOString();
    }
    return [
      c._id || c.id,
      c.asistente_nombre || '',
      `"${(c.pregunta || '').replace(/"/g, '""')}"`,
      `"${(c.respuesta || '').replace(/"/g, '""')}"`,
      c.usuario_nombre || '',
      c.usuario_email || '',
      c.score_promedio || '',
      dateStr,
    ];
  });

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// ============================================
// Start Server
// ============================================
const startServer = async () => {
  try {
    // Initialize PostgreSQL (required)
    const postgresReady = await initPostgres();
    if (!postgresReady) {
      console.warn('⚠️  PostgreSQL not available, will use memory fallback');
    }

    app.listen(PORT, () => {
      console.log(`✅ Nora Backend running on http://localhost:${PORT}`);
      console.log(`📊 Database: ${isPostgresConnected() ? 'PostgreSQL ✅' : 'Memory Storage (Fallback) ⚠️'}`);
      console.log(`🤖 POST /api/chat - Generate GPT response`);
      console.log(`📝 POST /api/capturar-conversacion - Capture conversations`);
      console.log(`📊 GET /api/metrics - Get metrics`);
      console.log(`💾 GET /api/conversations - List all conversations`);
      console.log(`📥 GET /api/export/conversations - Export as JSON/CSV`);
      console.log(`🏥 GET /health - Health check`);
    });
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
};

startServer();
