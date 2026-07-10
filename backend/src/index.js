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
    console.warn('вљ пёЏ  No se pudo cargar el almacenamiento de respaldo:', error.message);
  }
}

function saveFallbackStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(fallbackStorage, null, 2));
  } catch (error) {
    console.warn('вљ пёЏ  No se pudo guardar el almacenamiento de respaldo:', error.message);
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

    console.warn(`вљ пёЏ CORS blocked origin: ${origin}`);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-Admin-Key'],
  credentials: true,
};

console.log('рџ”§ Configuration:');
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

console.log('рџ“Ѓ Frontend dist path:', frontendDistPath);
console.log('рџ“Ѓ Frontend assets path:', frontendAssetsPath);
console.log('рџ“Ѓ Dist exists:', fs.existsSync(frontendDistPath));
console.log('рџ“Ѓ Assets exists:', fs.existsSync(frontendAssetsPath));

if (fs.existsSync(frontendAssetsPath)) {
  console.log('рџ“¦ Serving Vite assets from:', frontendAssetsPath);

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
  console.warn('вљ пёЏ  Frontend assets folder not found at:', frontendAssetsPath);
}

if (fs.existsSync(frontendDistPath)) {
  console.log('рџ“Ѓ Serving static files from:', frontendDistPath);

  app.use(express.static(frontendDistPath, {
    index: false,
  }));
} else {
  console.warn('вљ пёЏ  Frontend dist folder not found at:', frontendDistPath);
}

// Middleware API despuГ©s de servir frontend/assets
app.use(cors(corsOptions));
app.use(express.json({ limit: '64kb' }));

// OpenAI Client
if (!process.env.OPENAI_API_KEY) {
  console.error('вќЊ ERROR: OPENAI_API_KEY no estГЎ configurada');
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
    console.log('\nрџ“Љ Database Save Status:');
    console.log(`   PostgreSQL connected: ${isPostgresReady}`);
    console.log(`   Conversation ID: ${data.id}`);

    if (isPostgresReady) {
      console.log('рџ“Ў Attempting to save to PostgreSQL...');
      const conversation = await saveConversationPostgres(data);
      console.log('вњ… Successfully saved to PostgreSQL');
      return conversation;
    } else {
      console.log('вљ пёЏ  PostgreSQL not connected, will use memory fallback');
    }
  } catch (error) {
    console.error('\nвќЊ PostgreSQL save failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error('   Falling back to Memory Storage');
  }

  console.log('рџ’ѕ Saving to Memory fallback...');
  fallbackStorage.conversations.unshift(data);
  saveFallbackStorage();
  console.log('вњ… Saved to Memory fallback');
  return data;
}

// Helper function to get conversations (PostgreSQL only)
async function getConversations(limit = 100) {
  try {
    const isPostgresReady = isPostgresConnected();
    console.log(`\nрџ“– Getting conversations (limit: ${limit})`);
    console.log(`   PostgreSQL connected: ${isPostgresReady}`);

    if (isPostgresReady) {
      console.log('   Source: PostgreSQL');
      const result = await getConversationsPostgres(limit);
      console.log(`   Retrieved: ${result.length} conversations from PostgreSQL`);
      return result;
    }
  } catch (error) {
    console.error('вќЊ PostgreSQL query failed:');
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
    (agent) => agent.id === DEFAULT_AGENT_ID || agent.slug =лЌц¶‰ћЛkєwµзH	ТЭ[›ЫЪЪ[™ЙО€€	СЩ[™\[[™›ЙО€€NВ‚€Y€
Э[€
HВ€ЫЫќ™\њШ][ЫњЛ™›Ь‘XXЪ
ИO€В€ЫЫњЭ^H	ШЛњ™YЭ[ќH	ЙЯH	ШЛњ™\ЬY\ЭH	ЙЯXќУЭЩ\ђШ\ЩJ
NВ€Y€
^љ[ЫY\К	ЭќY[ЙКH^љ[ЫY\К	Ш]љ[Ы‰КH^љ[ЫY\К	ШY\›Ы[™XIКH^љ[ЫY\К	ЭXЪЩ]	КH^љ[ЫY\К	ШY\›ЬY\ќ	КH^љ[ЫY\К	Щ\ШШ[IКJHВ€ћUЬXЦЙС›YЪ]Z[ЙЧJКОВ€H[ЩHY€
^љ[ЫY\К	ЪЭ[	КH^љ[ЫY\К	ЪЬЬYZ™IКH^љ[ЫY\К	Ш[Ъ[ZY[ќЙКH^љ[ЫY\К	Ь™\Щ\ќIКH^љ[ЫY\К	ЪXљ]XЪ[Ы‰КJHВ€ћUЬXЦЙТЭ[›ЫЪЪ[™ЙЧJКОВ€H[ЩHY€
^љ[ЫY\К	ЭљXZ™IКH^љ[ЫY\К	Э\љ\ЫIКH^љ[ЫY\К	Щ\Э[›ЙКH^љ[ЫY\К	Ъ][™\\љIКH^љ[ЫY\К	ЬZ\ЙКH^љ[ЫY\К	ШЪ]YY	КJHВ€ћUЬXЦЙХ]™[[™›ЙЧJКОВ€H[ЩHВ€ћUЬXЦЙСЩ[™\[[™›ЙЧJКОВ€B€JNВ€H[ЩHВ€ЛИ[XЪИ\Э0и]XЫИЪH›И^HЫЫќ™\њШXЪ[Ы™\И™YЪ\ЭY\В€ћUЬXЦЙХ]™[[™›ЙЧHHNВ€ћUЬXЦЙС›YЪ]Z[ЙЧHHLЋВ€ћUЬXЦЙТЭ[›ЫЪЪ[™ЙЧHHВ€ћUЬXЦЙСЩ[™\[[™›ЙЧHHВ€B‚€ЛИШ[Э[\€ќY]\Иpк]љXШ\ИЬЪ[Ы[\В€ЫЫњЭћPШ]YЫЬљXU\ЭX\љ[ИHЯNВ€ЫЫњЭћSЬљYЩ[”Z\ИHЯNВ€ЫЫњЭћT™YЭ[ќP\ЩHHЯNВ‚€Y€
Э[€
HВ€ЫЫќ™\њШ][ЫњЛ™›Ь‘XXЪ
ИO€В€ЛИЬ€Ш]YЫЬ°лXHH\ЭX\љ[В€ЫЫњЭШ]YЫЬљXHHЛШ]YЫЬљXH	У›И\ЬXЪYљXШYЙОВ€ћPШ]YЫЬљXU\ЭX\љ[ЦШШ]YЫЬљXWHH
ћPШ]YЫЬљXU\ЭX\љ[ЦШШ]YЫЬљXWH
H
ИNВ‚€ЛИЬ€ЬљYЩ[€[pл\В€ЫЫњЭZ\ИHЛ›ЬљYЩ[—ЬZ\И	У›И\ЬXЪYљXШYЙОВ€ћSЬљYЩ[”Z\ЦЬZ\ЧHH
ћSЬљYЩ[”Z\ЦЬZ\ЧH
H
ИNВ‚€ЛИЬ€™YЭ[ќH\ЩH
ЪH^\ЭJB€Y€
Лњ™YЭ[ќWШ\ЩJHВ€ћT™YЭ[ќP\ЩVШЛњ™YЭ[ќWШ\ЩWHH
ћT™YЭ[ќP\ЩVШЛњ™YЭ[ќWШ\ЩWH
H
ИNВ€B€JNВ€B‚€™\ЛљњЫЫЉВ€Э]\О€	ЬЭXШЩ\ЬЙЛ€ЫЫќ™\њШ][ЫњО€В€Э[€Щ^N€ЫЫќ™\њШ][ЫњЛ™љ[\ЉИO€В€ЫЫњЭЩ^HH™]И]J
KќС]TЭљ[™К
NВ€ЫЫњЭ]С]HHЛќ[Y\Э[\ЛЬ™X]Y]В€ЫЫњЭС]HH]С]HИ™]И]J]С]JKќС]TЭљ[™К
H€™]И]J
KќС]TЭљ[™К
NВ€™]\›€Щ^HOOHС]NВ€JK›[™Э€]™\YЩQ\][ЫЋ€ЌK€]™\YЩTШ]\ЩXЭ[ЫЋ€\њЩQ›Ш]
]™ФШ]\ЩXЭ[Ы‹ќСљ^Y
ЉJK€™[™€L‹ЌK€K€\™›Ь›X[ЩN€В€\[YN€NKЋ€]™\YЩS][ЮN€ЌK€\њ›Ь”]N€\њЩQ›Ш]

[XЪ[][Ы”]HИL
KќСљ^Y
ЉJKЛИ\ШHH\њ›Ь€ЫЬњ™[XЪ[ЫYHЫЫ€[XЪ[XЪ[Ы™\В€™\]Y\ЭФ\“Z[ќ]N€LЊ€XZУ][ЮN€L€K€[XЪ[][ЫЋ€В€]N€[XЪ[][Ы”]K€ЫЭ[ќ€[XЪ[][ЫђЫЭ[ќ€XЭX[XШЭ\XЮK€ћUЬXЛ€K€ЛИќY]\Иpк]љXШ\ИЬЪ[Ы[\В€\ЭX\љ[ЬУY]љXШ\О€В€ћPШ]YЫЬљXU\ЭX\љ[Л€ћSЬљYЩ[”Z\Л€K€™YЭ[ќ\УY]љXШ\О€В€ћT™YЭ[ќP\ЩN€Шљ™XЭљЩ^\КћT™YЭ[ќP\ЩJK›[™Э€ИћT™YЭ[ќP\ЩH€ќ[€K€]X\ЩN€\ФЬЭЬ™\РЫЫ›™XЭY

B€И	ФЬЭЬ™TФS	В€€	УY[[ЬћIЛ€\Э\]Y€™]И]J
K€JNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]Ъ[™ИY]љXЬО‰Л\њ›ЬЉNВ€™\ЛњЭ]\КL
KљњЫЫЉВ€Э]\О€	Щ\њ›Ь‰Л€Y\ЬШYЩN€	С\њ›Ь€[Шќ[™\€Y]љXШ\ЙЛ€JNВ€BџJNВ‚\™Щ]
	ЛШ\KЫY]љXШ\ЛX\Ъ\Э[ќIЛ™\]Z\™PYЩ[ќYZ[‹\Ю[И
™\K™\КHO€В€ћHВ€ЫЫњЭ\Ъ\Э[ќHH™\Kњ]Y\ћK\Ъ\Э[ќH	У“ФђIОВ€ЫЫњЭ™YЪ[Ы€H™\Kњ]Y\ћKњ™YЪ[Ы€ќ[В€ЫЫњЭЫЫќ™\њШ][ЫњИH]ШZ]Щ]ЫЫќ™\њШ][ЫњКL
NВ€ЫЫњЭЭ[HЫЫќ™\њШ][ЫњЛ›[™ЭВ€ЫЫњЭ[љ\]YU\Щ\њИH™]ИЩ]
€ЫЫќ™\њШ][ЫњВ€›X\

КHO€Лќ\ЭX\љ[ЧЪYЛќ\ЭX\љ[ЧЩ[XZ[Лќ\ЭX\љ[ЧЫ›ЫXњ™H	ЙКB€™љ[\Љ›ЫЫX[ЉK€
NВ€ЫЫњЭ]™ФШЫЬ™HHЭ[€€ИЫЫќ™\њШ][ЫњЛњ™YXЩJ
Э[KКHO€Э[H
И
ЛњШЫЬ™WЬ›ЫYY[ИКK
HИЭ[€€ОВ‚€™\ЛљњЫЫЉВ€\Ъ\Э[ќK€™YЪ[Ы‹€Э[ШЫЫќ™\њШXЪ[Ы™\О€Э[€Э[Э\ЭX\љ[ЬО€[љ\]YU\Щ\њЛњЪ^™K€ШЫЬ™WЬ›ЫYY[О€\њЩQ›Ш]
]™ФШЫЬ™KќСљ^Y
ЉJK€ШЫЬ™WЬ™XЪ\Ъ[ЫЋ€\њЩQ›Ш]
]™ФШЫЬ™KќСљ^Y
ЉJK€ШЫЬ™WШЫ\љYY€\њЩQ›Ш]
]™ФШЫЬ™KќСљ^Y
ЉJK€ШЫЬ™WЬ™[][ЪXN€\њЩQ›Ш]
]™ФШЫЬ™KќСљ^Y
ЉJK€ШЫЬ™WШЫЫ\]]Y€\њЩQ›Ш]
]™ФШЫЬ™KќСљ^Y
ЉJK€ШЫЬ™WЭ][YY€\њЩQ›Ш]
]™ФШЫЬ™KќСљ^Y
ЉJK€][\О€ЫЫќ™\њШ][ЫњЛ›X\

КHO€
В€Y€Л—ЪYЛљYќ[€\Ъ\Э[ќWЫ›ЫXњ™N€Л\Ъ\Э[ќWЫ›ЫXњ™H\Ъ\Э[ќK€™YЪ[ЫЋ€Лњ™YЪ[Ы€™YЪ[Ы‹€\ЭX\љ[ЧЫ›ЫXњ™N€Лќ\ЭX\љ[ЧЫ›ЫXњ™H	Х\ЭX\љ[И[°мЫљ[[ЙЛ€\ЭX\љ[ЧЩ[XZ[€Лќ\ЭX\љ[ЧЩ[XZ[ќ[€\ЭX\љ[ЧЪY€Лќ\ЭX\љ[ЧЪYќ[€™YЭ[ќN€Лњ™YЭ[ќH	ЙЛ€™\ЬY\ЭN€Лњ™\ЬY\ЭH	ЙЛ€ШЫЬ™WЬ™XЪ\Ъ[ЫЋ€ЛњШЫЬ™WЬ›ЫYY[ИЛ€ШЫЬ™WШЫ\љYY€ЛњШЫЬ™WЬ›ЫYY[ИЛ€ШЫЬ™WЬ™[][ЪXN€ЛњШЫЬ™WЬ›ЫYY[ИЛ€ШЫЬ™WШЫЫ\]]Y€ЛњШЫЬ™WЬ›ЫYY[ИЛ€ШЫЬ™WЭ][YY€ЛњШЫЬ™WЬ›ЫYY[ИЛ€ШЫЬ™WЬ›ЫYY[О€ЛњШЫЬ™WЬ›ЫYY[ИЛ€ќ\ЭYљXШXЪ[ЫЋ€	С][XXЪpмЫ€]]Ыpи]XШH›И\ЬЫљX›IЛ€[Y\Э[\€Лќ[Y\Э[\ЛЬ™X]Y]™]И]J
KќТTУФЭљ[™К
K€Ь™X]YШ]€Лќ[Y\Э[\ЛЬ™X]Y]™]И]J
KќТTУФЭљ[™К
K€\]YШ]€Лќ\]Y]Лќ[Y\Э[\ЛЬ™X]Y]™]И]J
KќТTУФЭљ[™К
K€JJK€JNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]Ъ[™ИХHY]љXЬО‰Л\њ›ЬЉNВ€™\ЛњЭ]\КL
KљњЫЫЉВ€Э]\О€	Щ\њ›Ь‰Л€Y\ЬШYЩN€	С\њ›Ь€[Шќ[™\€Y]љXШ\ИХIЛ€JNВ€BџJNВ‚\™Щ]
	ЛШ\KШЫЫќ™\њШ][ЫњЛЪ\ЭЬћIЛ™\]Z\™PYЩ[ќYZ[‹\Ю[И
™\K™\КHO€В€ћHВ€ЫЫњЭ[Z]H\њЩR[ќ
™\Kњ]Y\ћK›[Z]
HЌВ€ЫЫњЭЫЫќ™\њШ][ЫњИH]ШZ]Щ]ЫЫќ™\њШ][ЫњКL
NВ€ЫЫњЭ\ЭЬћHH\њ^K™њ›ЫJИ[™Э€[Z]K
ЛJHO€В€ЫЫњЭЭ\ќH™]И]J]K››ЭК
HH
[Z]HHHJH
€НЊ
NВ€Э\ќњЩ]Z[ќ]\К
NВ€ЫЫњЭ[™H™]И]JЭ\ќ™Щ][YJ
H
ИНЊ
NВ€ЫЫњЭ][\ИHЫЫќ™\њШ][ЫњЛ™љ[\Љ
КHO€В€ЫЫњЭ]ИHЛќ[Y\Э[\ЛЬ™X]YШ]ЛЬ™X]Y]В€ЫЫњЭ]HH]ИИ™]И]J]КH€ќ[В€™]\›€]H	‰€Z\УSЉ]K™Щ][YJ
JH	‰€]HЏHЭ\ќ	‰€]H[™В€JNВ€ЫЫњЭШЫЬ™HH][\Л›[™Э€И][\Лњ™YXЩJ
Э[KКHO€Э[H
И
ќ[X™\ЉЛњШЫЬ™WЬ›ЫYY[КH
K
HИ][\Л›[™Э€€В€™]\›€В€[Y\Э[\€Э\ќќУШШ[U[YTЭљ[™К	Щ\ЙЛИЭ\Ћ€	М‹YYЪ]	ЛZ[ќ]N€	М‹YYЪ]	ИJK€ЫЭ[ќ€][\Л›[™Э€Ш]\ЩXЭ[ЫЋ€\њЩQ›Ш]
ШЫЬ™KќСљ^Y
JJK€NВ€JNВ€™\ЛљњЫЫЉ\ЭЬћJNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]Ъ[™ИЫЫќ™\њШ][Ы€\ЭЬћN‰Л\њ›ЬЉNВ€™\ЛњЭ]\КL
KљњЫЫЉИЭ]\О€	Щ\њ›Ь‰ЛY\ЬШYЩN€	С\њ›Ь€[Шќ[™\€[\ЭЬљX[	ИJNВ€BџJNВ‚\™Щ]
	ЛШ\KЬ\™›Ь›X[ЩKЪ\ЭЬћIЛ™\]Z\™PYЩ[ќYZ[‹\Ю[И
™\K™\КHO€В€ћHВ€ЫЫњЭ[Z]H\њЩR[ќ
™\Kњ]Y\ћK›[Z]
HЌВ€ЫЫњЭЫЫќ™\њШ][ЫњИH]ШZ]Щ]ЫЫќ™\њШ][ЫњКL
NВ€ЫЫњЭ\ЭЬћHH\њ^K™њ›ЫJИ[™Э€[Z]K
ЛJHO€В€ЫЫњЭЭ\ќH™]И]J]K››ЭК
HH
[Z]HHHJH
€НЊ
NВ€Э\ќњЩ]Z[ќ]\К
NВ€ЫЫњЭ[™H™]И]JЭ\ќ™Щ][YJ
H
ИНЊ
NВ€ЫЫњЭ][\ИHЫЫќ™\њШ][ЫњЛ™љ[\Љ
КHO€В€ЫЫњЭ]ИHЛќ[Y\Э[\ЛЬ™X]YШ]ЛЬ™X]Y]В€ЫЫњЭ]HH]ИИ™]И]J]КH€ќ[В€™]\›€]H	‰€Z\УSЉ]K™Щ][YJ
JH	‰€]HЏHЭ\ќ	‰€]H[™В€JNВ€ЫЫњЭ][ЮR][\ИH][\Л›X\

КHO€ќ[X™\ЉЛ›][ЮWЫ\И
JK™љ[\Љ
ЉHO€€€
NВ€ЫЫњЭ][ЮHH][ЮR][\Л›[™Э€И][ЮR][\Лњ™YXЩJ
Э[KЉHO€Э[H
И‹
HИ][ЮR][\Л›[™Э€€В€™]\›€В€[Y\Э[\€Э\ќќУШШ[U[YTЭљ[™К	Щ\ЙЛИЭ\Ћ€	М‹YYЪ]	ЛZ[ќ]N€	М‹YYЪ]	ИJK€][ЮN€X]њ›Э[™
][ЮJK€\њ›ЬњО€€NВ€JNВ€™\ЛљњЫЫЉ\ЭЬћJNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]Ъ[™И\™›Ь›X[ЩH\ЭЬћN‰Л\њ›ЬЉNВ€™\ЛњЭ]\КL
KљњЫЫЉИЭ]\О€	Щ\њ›Ь‰ЛY\ЬШYЩN€	С\њ›Ь€[Шќ[™\€[\ЭЬљX[H™[™[ZY[ќЙИJNВ€BџJNВ‚\™Щ]
	ЛШ\KЪ[XЪ[][ЫњЛЪ\ЭЬћIЛ™\]Z\™PYЩ[ќYZ[‹\Ю[И
™\K™\КHO€В€ћHВ€ЫЫњЭ[Z]H\њЩR[ќ
™\Kњ]Y\ћK›[Z]
HОВ€ЫЫњЭЫЫќ™\њШ][ЫњИH]ШZ]Щ]ЫЫќ™\њШ][ЫњКL
NВ€ЫЫњЭ\ЭЬћHH\њ^K™њ›ЫJИ[™Э€[Z]K
ЛJHO€В€ЫЫњЭ^HH™]И]J]K››ЭК
HH
[Z]HHHJH
€Ќ
NВ€ЫЫњЭ][\ИHЫЫќ™\њШ][ЫњЛ™љ[\Љ
КHO€В€ЫЫњЭ]ИHЛќ[Y\Э[\ЛЬ™X]YШ]ЛЬ™X]Y]В€ЫЫњЭ]HH]ИИ™]И]J]КH€ќ[В€™]\›€]H	‰€Z\УSЉ]K™Щ][YJ
JH	‰€]KќС]TЭљ[™К
HOOH^KќС]TЭљ[™К
NВ€JNВ€ЫЫњЭЭФ]X[]HH][\Л™љ[\Љ
КHO€
ќ[X™\ЉЛњШЫЬ™WЬ›ЫYY[КHJHHКNВ€™]\›€В€]N€^KќУШШ[Q]TЭљ[™К	Щ\ЙКK€]N€][\Л›[™ЭИ\њЩQ›Ш]


ЭФ]X[]K›[™ЭИ][\Л›[™Э
H
€L
KќСљ^Y
ЉJH€€ЫЭ[ќ€ЭФ]X[]K›[™Э€NВ€JNВ€™\ЛљњЫЫЉ\ЭЬћJNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]Ъ[™И[XЪ[][Ы€\ЭЬћN‰Л\њ›ЬЉNВ€™\ЛњЭ]\КL
KљњЫЫЉИЭ]\О€	Щ\њ›Ь‰ЛY\ЬШYЩN€	С\њ›Ь€[Шќ[™\€[\ЭЬљX[HШ[YY	ИJNВ€BџJNВ‚‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB‹ЛИS‘ТS•€СUШ\KШЫЫќ™\њШ][ЫњЛОљY‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB\™Щ]
	ЛШ\KШЫЫќ™\њШ][ЫњЛОљY	Л™\]Z\™PYЩ[ќYZ[‹\Ю[И
™\K™\КHO€В€ћHВ€ЫЫњЭИYHH™\Kњ\[\ОВ€]ЫЫќ™\њШ][Ы€Hќ[В‚€Y€
\ФЬЭЬ™\РЫЫ›™XЭY

JHВ€ЫЫќ™\њШ][Ы€H]ШZ]Щ]ЫЫќ™\њШ][ЫђћRYЬЭЬ™\КY
NВ€B‚€Y€
XЫЫќ™\њШ][ЫЉHВ€ЫЫќ™\њШ][Ы€H[XЪФЭЬYЩKЫЫќ™\њШ][ЫњЛ™љ[™

КHO€ЛљYOOHYЛ—ЪYOOHY
Hќ[В€B‚€Y€
XЫЫќ™\њШ][ЫЉHВ€™]\›€™\ЛњЭ]\К
KљњЫЫЉИЭ]\О€	Щ\њ›Ь‰Л\њ›ЬЋ€	РЫЫќ™\њШXЪ[Ы€›И[ЫЫќYIИJNВ€B‚€™\ЛљњЫЫЉЫЫќ™\њШ][ЫЉNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]Ъ[™ИЫЫќ™\њШ][ЫЋ‰Л\њ›ЬЉNВ€™\ЛњЭ]\КL
KљњЫЫЉИЭ]\О€	Щ\њ›Ь‰ЛY\ЬШYЩN€	С\њ›Ь€[Шќ[™\€HЫЫќ™\њШXЪ[Ы‰ИJNВ€BџJNВ‚‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB‹ЛИX[ЪXЪВ‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB\™Щ]
	ЛЪX[	Л
™\K™\КHO€В€™\ЛњЭ]\КЊ
KљњЫЫЉВ€Э]\О€	ЫЪЙЛ€[Y\Э[\€™]И]J
KќТTУФЭљ[™К
K€]X\ЩN€\ФЬЭЬ™\РЫЫ›™XЭY

B€И	ФЬЭЬ™TФSЫЫ›™XЭY	В€€	Х\Ъ[™ИY[[ЬћHЭЬYЩIЛ€ЫЫќ™\њШ][ЫњРШ\\™Y€[XЪФЭЬYЩKЫЫќ™\њШ][ЫњЛ›[™Э€JNВџJNВ‚‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB‹ЛИФH[XЪИHЩ\ќ™H[™^љ[›Ь€њ›Ыќ[™›Э]\В‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB\™Щ]
	К‰Л
™\K™\КHO€В€ЛИЫ‰ЭЩ\ќ™H[™^љ[›Ь€TH›Э]\ИЬ€X[ЪXЪВ€Y€
€™\Kњ]њЭ\ќХЪ]
	ЛШ\IКH€™\Kњ]OOH	ЛЪX[	И€™\Kњ]њЭ\ќХЪ]
	ЛШ\ЬЩ]ЙКB€
HВ€™\ЛњЭ]\К
KљњЫЫЉВ€Э]\О€	Щ\њ›Ь‰Л€Y\ЬШYЩN€[™Ъ[ќ›И[ЫЫќYО€	Ь™\K›Y]ЩH	Ь™\Kњ]X€]Z[X›Q[™Ъ[ќО€В€СU€ЙЛЪX[	Л	ЛШ\KЫY]љXЬЙЛ	ЛШ\KШЫЫќ™\њШ][ЫњЙЛ	ЛШ\KЩ^ЬќШЫЫќ™\њШ][ЫњЙЧK€ФХ€ЙЛШ\KШЪ]	Л	ЛШ\KШШ\\\‹XЫЫќ™\њШXЪ[Ы‰ЧB€B€JNВ€™]\›ЋВ€B‚€ЛИЩ\ќ™H[™^љ[›Ь€[Э\€›Э]\И
њ›Ыќ[™ФJB€ЫЫњЭ[™^]H]љ›Ъ[Љњ›Ыќ[™\Э]	Ъ[™^љ[	КNВ€Y€
њЛ™^\ЭФЮ[К[™^]
JHВ€™\ЛњЩ[™љ[J[™^]
\њЉHO€В€Y€
\њЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€Щ\ќљ[™И[™^љ[‰Л\њЉNВ€™\ЛњЭ]\КL
KљњЫЫЉИЭ]\О€	Щ\њ›Ь‰ЛY\ЬШYЩN€	Т[ќ\›[Щ\ќ™\€\њ›Ь‰ИJNВ€B€JNВ€H[ЩHВ€™\ЛњЭ]\К
KљњЫЫЉВ€Э]\О€	Щ\њ›Ь‰Л€Y\ЬШYЩN€	Сњ›Ыќ[™›Э›Э[™€X\ЩH[њЭ\™Hњ›Ыќ[™\ИќZ[‰Л€]Z[О€^XЭY\Э]€	Ъ[™^]X€JNВ€BџJNВ‚‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB‹ЛИ\њ›Ь€[™\њВ‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB‚\ќ\ЩJ
\њ‹™\K™\Л™^
HO€В€ЫЫњЫЫK™\њ›ЬЉ	ш§c[љ[™Y\њ›ЬЋ‰Л\њЉNВ€™\ЛњЭ]\КL
KљњЫЫЉВ€Э]\О€	Щ\њ›Ь‰Л€Y\ЬШYЩN€	С\њ›Ь€[ќ\››И[Щ\ќљYЬ‰Л€\њ›ЬЋ€“СWСS•€OOH	Щ]™[ЬY[ќ	ИИ\њ‹›Y\ЬШYЩH€	Т[ќ\›[Щ\ќ™\€\њ›Ь‰В€JNВџJNВ‚‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB‹ЛИ[\€ќ[Э[ЫњВ‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB\Ю[Иќ[Э[Ы€Щ[™\]P\ЬЪ\Э[ќ™\ЬЫњЩJ™YЭ[ќKYЩ[ќHQђUSРQСS•
HВ€ЫЫњЭXЭ]™U™\њЪ[Ы€HYЩ[ќЛXЭ]™WЭ™\њЪ[Ы€QђUSРQСS•XЭ]™WЭ™\њЪ[ЫЋВ€ЫЫњЭЭ\ќY]H]K››ЭК
NВ€ЫЫњЭЫЫ\][Ы€H]ШZ]Ь[ZKЪ]ЫЫ\][ЫњЛЬ™X]JВ€[Щ[€XЭ]™U™\њЪ[Ы‹›[Щ[ФSђRWУSСS€[\\]\™N€ќ[X™\ЉXЭ]™U™\њЪ[Ы‹ќ[\\]\™HПИЌ
K€X^ЭЪЩ[њО€ќ[X™\ЉXЭ]™U™\њЪ[Ы‹›X^ЭЪЩ[њИНL
K€Y\ЬШYЩ\О€В€В€›ЫN€	ЬЮ\Э[IЛ€ЫЫќ[ќ€XЭ]™U™\њЪ[Ы‹њЮ\Э[WЬ›Ы\QђUSРQСS•Ф“УT€K€И›ЫN€	Э\Щ\‰ЛЫЫќ[ќ€™YЭ[ќHK€K€JNВ‚€™]\›€В€™\ЬY\ЭN€ЫЫ\][Ы‹ЪЪXЩ\ЦМOЛ›Y\ЬШYЩOЛЫЫќ[ќЛќљ[J
H	ЙЛ€›ЭљY\Ћ€	ЫЬ[ZIЛ€[Щ[€XЭ]™U™\њЪ[Ы‹›[Щ[ФSђRWУSСS€][ЮWЫ\О€]K››ЭК
HHЭ\ќY]€ЪЩ[њЧЪ[њ]€ЫЫ\][Ы‹ќ\ШYЩOЛњ›Ы\ЭЪЩ[њИ€ЪЩ[њЧЫЭ]]€ЫЫ\][Ы‹ќ\ШYЩOЛЫЫ\][Ы—ЭЪЩ[њИ€ЫЬЭЭ\Щ€€NВџB™ќ[Э[Ы€ЫЫќ™\ќРФХЉЫЫќ™\њШ][ЫњКHВ€ЫЫњЭXY\њИHЙТQ	Л	Р\Ъ\Э[ќIЛ	Ф™YЭ[ќIЛ	Ф™\ЬY\ЭIЛ	Х\ЭX\љ[ЙЛ	С[XZ[	Л	ФШЫЬ™IЛ	С™XЪIЧNВ€ЫЫњЭ›ЭЬИHЫЫќ™\њШ][ЫњЛ›X\
ИO€В€ЫЫњЭ]С]HHЛќ[Y\Э[\ЛЬ™X]Y]В€]]TЭЋВ€ћHВ€ЫЫњЭH]С]HИ™]И]J]С]JH€™]И]J
NВ€]TЭ€H\УSЉ™Щ][YJ
JHИ™]И]J
KќТTУФЭљ[™К
H€ќТTУФЭљ[™К
NВ€HШ]Ъ
JHВ€]TЭ€H™]И]J
KќТTУФЭљ[™К
NВ€B€™]\›€В€Л—ЪYЛљY€Л\Ъ\Э[ќWЫ›ЫXњ™H	ЙЛ€‰КЛњ™YЭ[ќH	ЙКKњ™\XЩJИ‹ЩЛ	И€‰К_H€‰КЛњ™\ЬY\ЭH	ЙКKњ™\XЩJИ‹ЩЛ	И€‰К_H€Лќ\ЭX\љ[ЧЫ›ЫXњ™H	ЙЛ€Лќ\ЭX\љ[ЧЩ[XZ[	ЙЛ€ЛњШЫЬ™WЬ›ЫYY[И	ЙЛ€]TЭ‹€NВ€JNВ‚€™]\›€ЪXY\њЛ‹‹њ›ЭЬЧK›X\
›ЭИO€›ЭЛљ›Ъ[Љ	Л	КJKљ›Ъ[Љ	Ч‰КNВџB‚‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOB‹ЛИЭ\ќЩ\ќ™\‚‹ЛИOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOBЫЫњЭЭ\ќЩ\ќ™\€H\Ю[И

HO€В€ћHВ€ЛИ[љ]X[^™HЬЭЬ™TФS
™\]Z\™Y
B€ЫЫњЭЬЭЬ™\Ф™XYHH]ШZ][љ]ЬЭЬ™\К
NВ€Y€
\ЬЭЬ™\Ф™XYJHВ€ЫЫњЫЫKќШ\›Љ	ш¦Ё;о#ИЬЭЬ™TФS›Э]Z[X›KЪ[\ЩHY[[ЬћH[XЪЙКNВ€B‚€\›\Э[ЉФ•

HO€В€ЫЫњЫЫK›ЩК8§!H›ЬHXЪЩ[™ќ[›љ[™ИЫ€‹ЛЫШШ[ЬЭ‰ФФ•X
NВ€ЫЫњЫЫK›ЩК<'дв€]X\ЩN€	Ъ\ФЬЭЬ™\РЫЫ›™XЭY

HИ	ФЬЭЬ™TФS8§!IИ€	УY[[ЬћHЭЬYЩH
[XЪКH8¦Ё;о#ЙЯX
NВ€ЫЫњЫЫK›ЩК<'й%€ФХШ\KШЪ]HЩ[™\]HФ™\ЬЫњЩX
NВ€ЫЫњЫЫK›ЩК<'дзHФХШ\KШШ\\\‹XЫЫќ™\њШXЪ[Ы€HШ\\™HЫЫќ™\њШ][ЫњШ
NВ€ЫЫњЫЫK›ЩК<'дв€СUШ\KЫY]љXЬИHЩ]Y]љXЬШ
NВ€ЫЫњЫЫK›ЩК<'дЇ€СUШ\KШЫЫќ™\њШ][ЫњИH\Э[ЫЫќ™\њШ][ЫњШ
NВ€ЫЫњЫЫK›ЩК<'дйHСUШ\KЩ^ЬќШЫЫќ™\њШ][ЫњИH^Ьќ\И”УУ‹РФХ
NВ€ЫЫњЫЫK›ЩК<'гйHСUЪX[HX[ЪXЪШ
NВ€JNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С][\њ›Ь€Э\ќ[™ИЩ\ќ™\Ћ‰Л\њ›ЬЉNВ€›ШЩ\ЬЛ™^]
JNВ€BџNВ‚њЭ\ќЩ\ќ™\Љ
NВ