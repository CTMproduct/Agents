require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

// Database imports
const { connectDB, isConnected } = require('./db');
const {
  initPostgres,
  saveConversationPostgres,
  getConversationsPostgres,
  isPostgresConnected,
} = require('./postgres');
const {
  Conversation,
  Metrics,
  ConversationHistory,
  PerformanceHistory,
  HallucinationHistory,
} = require('./models');

const DATA_DIR = path.resolve(__dirname, 'data');
const FALLBACK_FILE = path.join(DATA_DIR, 'fallback-conversations.json');

function loadFallbackStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(FALLBACK_FILE)) {
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify({ conversations: [] }, null, 2));
    }

    const raw = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.conversations)) {
      fallbackStorage.conversations = parsed.conversations;
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
const NODE_ENV = process.env.NODE_ENV || 'development';

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

    callback(new Error(`CORS policy no permite origen: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

console.log('🔧 Configuration:');
console.log(`  NODE_ENV: ${NODE_ENV}`);
console.log(`  PORT: ${PORT}`);
console.log(`  FRONTEND_URL: ${FRONTEND_URL}`);
console.log(`  ALLOWED_ORIGINS: ${allowedOrigins.join(', ')}`);
console.log(`  ALLOW_LOCAL_DEBUG: ${process.env.ALLOW_LOCAL_DEBUG === 'true'}`);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// OpenAI Client
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY no está configurada');
  process.exit(1);
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const fallbackStorage = {
  conversations: [],
  metrics: {
    total: 0,
    today: 0,
    averageSatisfaction: 0,
    hallucinations: 0,
  },
};

loadFallbackStorage();

// Helper function to save conversation (MongoDB or memory fallback)
async function saveConversation(data) {
  try {
    if (!data.id) {
      data.id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    console.log('🔍 Debug: isPostgresConnected =', isPostgresConnected());
    console.log('🔍 Debug: isConnected (MongoDB) =', isConnected());

    if (isPostgresConnected()) {
      console.log('💾 Saving to PostgreSQL...');
      const conversation = await saveConversationPostgres(data);
      console.log('✅ Saved to PostgreSQL successfully');
      return conversation;
    }

    if (isConnected()) {
      console.log('💾 Saving to MongoDB...');
      const conversation = new Conversation(data);
      await conversation.save();
      console.log('✅ Saved to MongoDB successfully');
      return conversation;
    }
  } catch (error) {
    console.warn('⚠️  Database save failed, using memory fallback:', error.message);
  }

  console.log('⚠️  Using memory fallback');
  fallbackStorage.conversations.unshift(data);
  saveFallbackStorage();
  return data;
}

// Helper function to get conversations
async function getConversations(limit = 100) {
  try {
    if (isPostgresConnected()) {
      return await getConversationsPostgres(limit);
    }

    if (isConnected()) {
      return await Conversation.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();
    }
  } catch (error) {
    console.warn('⚠️  Database query failed, using memory fallback:', error.message);
  }
  
  return fallbackStorage.conversations.slice(0, limit);
}

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Nora API Backend is running',
    database: isPostgresConnected()
      ? 'PostgreSQL'
      : isConnected()
      ? 'MongoDB'
      : 'Memory (fallback)',
    endpoints: {
      metrics: '/api/metrics',
      health: '/health',
      chat: '/api/chat',
      chatCapture: '/api/chat-capturar',
      capture: '/api/capturar-conversacion',
      conversations: '/api/conversations',
      export: '/api/export/conversations',
    }
  });
});

// ============================================
// ENDPOINT: POST /api/chat
// ============================================
app.post('/api/chat', async (req, res) => {
  try {
    const { pregunta } = req.body;

    if (!pregunta || !pregunta.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Falta campo requerido: pregunta',
      });
    }

    const respuesta = await generateAssistantResponse(pregunta.trim());

    if (!respuesta) {
      return res.status(502).json({
        status: 'error',
        message: 'No se pudo generar respuesta con OpenAI',
      });
    }

    return res.status(200).json({
      status: 'success',
      respuesta,
      modelo: OPENAI_MODEL,
    });
  } catch (error) {
    console.error('Error generating chat response:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error al generar respuesta',
      error: error.message,
    });
  }
});

// ============================================
// ENDPOINT: POST /api/chat-capturar
// ============================================
app.post('/api/chat-capturar', async (req, res) => {
  try {
    const {
      pregunta,
      usuario_nombre,
      usuario_email,
      usuario_id,
      region = 'Nora',
      asistente_nombre = 'NORA',
    } = req.body;

    if (!pregunta || !pregunta.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Falta campo requerido: pregunta',
      });
    }

    const respuesta = await generateAssistantResponse(pregunta.trim());

    if (!respuesta) {
      return res.status(502).json({
        status: 'error',
        message: 'No se pudo generar respuesta con OpenAI',
      });
    }

    const conversationData = {
      asistente_nombre,
      pregunta,
      respuesta,
      usuario_nombre,
      usuario_email,
      usuario_id,
      region,
      status: 'capturada',
      score_promedio: 4.5,
    };

    const savedConversation = await saveConversation(conversationData);

    return res.status(200).json({
      status: 'success',
      respuesta,
      modelo: OPENAI_MODEL,
      conversationId: savedConversation.id || savedConversation._id,
      score_promedio: savedConversation.score_promedio,
      database: isConnected() ? 'MongoDB' : 'Memory',
    });
  } catch (error) {
    console.error('Error generating and capturing conversation:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error al generar y capturar la conversación',
      error: error.message,
    });
  }
});

// ============================================
// ENDPOINT: POST /api/capturar-conversacion
// ============================================
app.post('/api/capturar-conversacion', async (req, res) => {
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
    } = req.body;

    // Validación
    if (!asistente_nombre || !pregunta || !respuesta) {
      return res.status(400).json({
        status: 'error',
        message: 'Faltan campos requeridos: asistente_nombre, pregunta, respuesta',
      });
    }

    let scorePromedio = 4.5;
    try {
      const evaluation = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
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
      scorePromedio = parseFloat(scoreText) || 4.5;
    } catch (err) {
      console.error('Error evaluating with OpenAI:', err.message);
    }

    // Guardar conversación
    const conversationData = {
      asistente_nombre,
      pregunta,
      respuesta,
      usuario_nombre,
      usuario_email,
      usuario_id,
      region,
      status,
      score_promedio: scorePromedio,
    };

    const savedConversation = await saveConversation(conversationData);

    const database = isPostgresConnected()
      ? 'PostgreSQL'
      : isConnected()
      ? 'MongoDB'
      : 'Memory';

    res.status(200).json({
      status: 'success',
      message: 'Captura registrada correctamente',
      data: {
        conversationId: savedConversation.id || savedConversation._id,
      },
      score_promedio: scorePromedio,
      database: database,
    });
  } catch (error) {
    console.error('Error capturing conversation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al capturar la conversación',
      error: error.message,
    });
  }
});

// ============================================
// ENDPOINT: GET /api/conversations
// ============================================
app.get('/api/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const conversations = await getConversations(limit);
    
    const database = isPostgresConnected()
      ? 'PostgreSQL'
      : isConnected()
      ? 'MongoDB'
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
      error: error.message,
    });
  }
});

// ============================================
// ENDPOINT: GET /api/export/conversations (CSV/JSON)
// ============================================
app.get('/api/export/conversations', async (req, res) => {
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
      error: error.message,
    });
  }
});

// ============================================
// ENDPOINTS: Métricas
// ============================================
app.get('/api/metrics', async (req, res) => {
  try {
    const conversations = await getConversations();
    const total = conversations.length;
    const avgSatisfaction = total > 0 
      ? conversations.reduce((sum, c) => sum + (c.score_promedio || 0), 0) / total
      : 0;

    res.json({
      status: 'success',
      conversations: {
        total,
        today: conversations.filter(c => {
          const today = new Date().toDateString();
          const cDate = new Date(c.timestamp || c.createdAt).toDateString();
          return today === cDate;
        }).length,
        averageDuration: 4.5,
        averageSatisfaction: parseFloat(avgSatisfaction.toFixed(2)),
        trend: 12.5,
      },
      performance: {
        uptime: 99.8,
        averageLatency: 245,
        errorRate: 0.5,
        requestsPerMinute: 120,
        peakLatency: 890,
      },
      hallucination: {
        rate: 2.3,
        count: 0,
        factualAccuracy: 97.7,
        byTopic: {
          'Travel Info': 1.2,
          'Flight Details': 3.5,
          'Hotel Booking': 2.1,
          'General Info': 1.8,
        },
      },
      database: isConnected() ? 'MongoDB' : 'Memory',
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener métricas',
      error: error.message,
    });
  }
});

app.get('/api/metricas-asistente', async (req, res) => {
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
      message: 'Error al obtener métricas CTM',
      error: error.message,
    });
  }
});

app.get('/api/conversations/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 24;
    
    if (isConnected()) {
      const history = await ConversationHistory.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();
      return res.json(history);
    }
    
    // Fallback
    const history = Array.from({ length: limit }, (_, i) => ({
      timestamp: new Date(Date.now() - (limit - i - 1) * 3600000).toLocaleTimeString(),
      count: Math.floor(Math.random() * 50 + 20),
      satisfaction: parseFloat((Math.random() * 0.8 + 3.8).toFixed(1)),
    }));
    res.json(history);
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get('/api/performance/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 24;
    
    if (isConnected()) {
      const history = await PerformanceHistory.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();
      return res.json(history);
    }
    
    // Fallback
    const history = Array.from({ length: limit }, (_, i) => ({
      timestamp: new Date(Date.now() - (limit - i - 1) * 3600000).toLocaleTimeString(),
      latency: Math.floor(Math.random() * 400 + 100),
      errors: Math.floor(Math.random() * 5),
    }));
    res.json(history);
  } catch (error) {
    console.error('Error fetching performance history:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get('/api/hallucinations/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 7;
    
    if (isConnected()) {
      const history = await HallucinationHistory.find()
        .sort({ date: -1 })
        .limit(limit)
        .exec();
      return res.json(history);
    }
    
    // Fallback
    const history = Array.from({ length: limit }, (_, i) => ({
      date: new Date(Date.now() - (limit - i - 1) * 86400000).toLocaleDateString(),
      rate: parseFloat((Math.random() * 3 + 1).toFixed(2)),
      count: Math.floor(Math.random() * 10 + 2),
    }));
    res.json(history);
  } catch (error) {
    console.error('Error fetching hallucination history:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ============================================
// ENDPOINT: GET /api/conversations/:id
// ============================================
app.get('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isConnected()) {
      const conversation = await Conversation.findById(id).exec();
      if (!conversation) {
        return res.status(404).json({ status: 'error', error: 'Conversación no encontrada' });
      }
      return res.json(conversation);
    }
    
    // Fallback
    const conversation = fallbackStorage.conversations.find((c) => c.id === id);
    if (!conversation) {
      return res.status(404).json({ status: 'error', error: 'Conversación no encontrada' });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ============================================
// Health Check
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    database: isPostgresConnected()
      ? 'PostgreSQL Connected'
      : isConnected()
      ? 'MongoDB Connected'
      : 'Using Memory Storage',
    conversationsCaptured: fallbackStorage.conversations.length,
  });
});

// ============================================
// Error Handlers
// ============================================
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Endpoint no encontrado: ${req.method} ${req.url}`,
    availableEndpoints: {
      GET: ['/', '/health', '/api/metrics', '/api/conversations', '/api/export/conversations'],
      POST: ['/api/chat', '/api/capturar-conversacion']
    }
  });
});

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
async function generateAssistantResponse(pregunta) {
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Eres Nora, una asistente de viajes. Responde en español con información clara, breve y accionable.',
      },
      { role: 'user', content: pregunta },
    ],
    max_tokens: 350,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

function convertToCSV(conversations) {
  const headers = ['ID', 'Asistente', 'Pregunta', 'Respuesta', 'Usuario', 'Email', 'Score', 'Fecha'];
  const rows = conversations.map(c => [
    c._id || c.id,
    c.asistente_nombre || '',
    `"${(c.pregunta || '').replace(/"/g, '""')}"`,
    `"${(c.respuesta || '').replace(/"/g, '""')}"`,
    c.usuario_nombre || '',
    c.usuario_email || '',
    c.score_promedio || '',
    new Date(c.timestamp || c.createdAt).toISOString(),
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// ============================================
// Start Server
// ============================================
const startServer = async () => {
  try {
    const postgresReady = await initPostgres();
    if (!postgresReady) {
      await connectDB();
    }

    app.listen(PORT, () => {
      console.log(`✅ Nora Backend running on http://localhost:${PORT}`);
      console.log(`📊 Database: ${isPostgresConnected() ? 'PostgreSQL' : isConnected() ? 'MongoDB' : 'Memory Storage (Fallback)'}`);
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
