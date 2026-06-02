const mongoose = require('mongoose');

// =====================================================
// CONVERSATION SCHEMA
// =====================================================
const conversationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      default: () => `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    },
    asistente_nombre: {
      type: String,
      required: true,
      default: 'Nora',
    },
    pregunta: {
      type: String,
      required: true,
    },
    respuesta: {
      type: String,
      required: true,
    },
    usuario_nombre: {
      type: String,
    },
    usuario_email: {
      type: String,
    },
    usuario_id: {
      type: String,
    },
    region: {
      type: String,
    },
    status: {
      type: String,
      default: 'capturada',
      enum: ['capturada', 'procesada', 'archivada'],
    },
    score_promedio: {
      type: Number,
      default: 4.5,
      min: 1,
      max: 5,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// =====================================================
// METRICS SCHEMA (para guardar métricas históricas)
// =====================================================
const metricsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    conversations: {
      total: {
        type: Number,
        default: 0,
      },
      today: {
        type: Number,
        default: 0,
      },
      averageDuration: {
        type: Number,
        default: 0,
      },
      averageSatisfaction: {
        type: Number,
        default: 0,
      },
      trend: {
        type: Number,
        default: 0,
      },
    },
    performance: {
      uptime: {
        type: Number,
        default: 99.8,
      },
      averageLatency: {
        type: Number,
        default: 245,
      },
      errorRate: {
        type: Number,
        default: 0.5,
      },
      requestsPerMinute: {
        type: Number,
        default: 120,
      },
      peakLatency: {
        type: Number,
        default: 890,
      },
    },
    hallucination: {
      rate: {
        type: Number,
        default: 2.3,
      },
      count: {
        type: Number,
        default: 0,
      },
      factualAccuracy: {
        type: Number,
        default: 97.7,
      },
      byTopic: {
        'Travel Info': { type: Number, default: 1.2 },
        'Flight Details': { type: Number, default: 3.5 },
        'Hotel Booking': { type: Number, default: 2.1 },
        'General Info': { type: Number, default: 1.8 },
      },
    },
  },
  { timestamps: true }
);

// =====================================================
// CONVERSATION HISTORY SCHEMA (para graficar)
// =====================================================
const conversationHistorySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    satisfaction: {
      type: Number,
      default: 3.8,
    },
  },
  { timestamps: true }
);

// =====================================================
// PERFORMANCE HISTORY SCHEMA (para graficar)
// =====================================================
const performanceHistorySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    latency: {
      type: Number,
      default: 245,
    },
    errors: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// =====================================================
// HALLUCINATION HISTORY SCHEMA (para graficar)
// =====================================================
const hallucinationHistorySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    rate: {
      type: Number,
      default: 2.3,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// =====================================================
// CREATE MODELS
// =====================================================
const Conversation = mongoose.model('Conversation', conversationSchema);
const Metrics = mongoose.model('Metrics', metricsSchema);
const ConversationHistory = mongoose.model('ConversationHistory', conversationHistorySchema);
const PerformanceHistory = mongoose.model('PerformanceHistory', performanceHistorySchema);
const HallucinationHistory = mongoose.model('HallucinationHistory', hallucinationHistorySchema);

module.exports = {
  Conversation,
  Metrics,
  ConversationHistory,
  PerformanceHistory,
  HallucinationHistory,
};
