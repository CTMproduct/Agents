require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Middleware
app.use(
  cors({
    origin: FRONTEND_URL,
  }),
);
app.use(express.json());

// OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Storage (en memoria para desarrollo; usar BD en producción)
const conversations = [];
const metrics = {
  total: 0,
  today: 0,
  averageSatisfaction: 0,
  hallucinations: 0,
};

async function generateAssistantResponse(pregunta) {
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Eres Nora, una asistente de viajes. Responde en espanol con informacion clara, breve y accionable.',
      },
      { role: 'user', content: pregunta },
    ],
    max_tokens: 350,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

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

    // Validación básica
    if (!asistente_nombre || !pregunta || !respuesta) {
      return res.status(400).json({
        status: 'error',
        message: 'Faltan campos requeridos: asistente_nombre, pregunta, respuesta',
      });
    }

    // Procesar con OpenAI (opcional: evaluar hallucinations, satisfacción, etc.)
    let scorePromedio = 4.5; // default
    try {
      // Llamar a OpenAI para evaluar la respuesta
      const evaluation = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'Eres un evaluador de calidad. Evalúa la respuesta del asistente en una escala de 1-5 donde 1 es muy mala y 5 es excelente. Responde solo con un número.',
          },
          {
            role: 'user',
            content: `Pregunta: ${pregunta}\n\nRespuesta: ${respuesta}\n\nCalifica esta respuesta:`,
          },
        ],
        max_tokens: 10,
      });

      const scoreText = evaluation.choices[0].message.content.trim();
      scorePromedio = parseFloat(scoreText) || 4.5;
    } catch (err) {
      console.error('Error evaluating with OpenAI:', err.message);
      // Continuar sin OpenAI si falla
    }

    // Guardar conversación
    const conversation = {
      id: `conv_${Date.now()}`,
      timestamp: new Date().toISOString(),
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

    conversations.push(conversation);

    // Actualizar métricas
    metrics.total++;
    metrics.today++;
    metrics.averageSatisfaction =
      (metrics.averageSatisfaction * (metrics.total - 1) + scorePromedio) /
      metrics.total;

    // Respuesta exitosa
    res.status(200).json({
      status: 'success',
      message: 'Captura registrada correctamente',
      mensaje: 'Captura registrada correctamente',
      data: {
        conversationId: conversation.id,
      },
      score_promedio: scorePromedio,
      usuario_email,
      asistente: asistente_nombre,
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
// ENDPOINTS: Métricas y Historiales
// ============================================

app.get('/api/metrics', (req, res) => {
  res.json({
    conversations: {
      total: metrics.total,
      today: metrics.today,
      averageDuration: 4.5,
      averageSatisfaction: metrics.averageSatisfaction,
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
      count: metrics.hallucinations,
      factualAccuracy: 97.7,
      byTopic: {
        'Travel Info': 1.2,
        'Flight Details': 3.5,
        'Hotel Booking': 2.1,
        'General Info': 1.8,
      },
    },
    lastUpdated: new Date(),
  });
});

app.get('/api/conversations/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 24;
  const history = Array.from({ length: limit }, (_, i) => ({
    timestamp: new Date(Date.now() - (limit - i - 1) * 3600000).toLocaleTimeString(),
    count: Math.floor(Math.random() * 50 + 20),
    satisfaction: parseFloat((Math.random() * 0.8 + 3.8).toFixed(1)),
  }));
  res.json(history);
});

app.get('/api/performance/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 24;
  const history = Array.from({ length: limit }, (_, i) => ({
    timestamp: new Date(Date.now() - (limit - i - 1) * 3600000).toLocaleTimeString(),
    latency: Math.floor(Math.random() * 400 + 100),
    errors: Math.floor(Math.random() * 5),
  }));
  res.json(history);
});

app.get('/api/hallucinations/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 7;
  const history = Array.from({ length: limit }, (_, i) => ({
    date: new Date(Date.now() - (limit - i - 1) * 86400000).toLocaleDateString(),
    rate: parseFloat((Math.random() * 3 + 1).toFixed(2)),
    count: Math.floor(Math.random() * 10 + 2),
  }));
  res.json(history);
});

app.get('/api/conversations/:id', (req, res) => {
  const { id } = req.params;
  const conversation = conversations.find((c) => c.id === id);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  res.json({
    ...conversation,
    duration: 5,
    messages: 15,
    topic: 'Travel Info',
    summary: 'Cliente preguntó sobre vuelos a Paris...',
  });
});

// ============================================
// Health Check
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    conversationsCaptured: metrics.total,
  });
});

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
  console.log(`✅ Nora Backend running on http://localhost:${PORT}`);
  console.log(`🤖 POST /api/chat - Generate GPT response`);
  console.log(`📝 POST /api/capturar-conversacion - Capture conversations`);
  console.log(`📊 GET /api/metrics - Get metrics`);
  console.log(`🏥 GET /health - Health check`);
});
