export interface ConversationMetrics {
  total: number;
  today: number;
  averageDuration: number;
  averageSatisfaction: number;
  trend: number;
}

export interface PerformanceMetrics {
  uptime: number;
  averageLatency: number;
  errorRate: number;
  requestsPerMinute: number;
  peakLatency: number;
}

export interface HallucinationMetrics {
  rate: number;
  count: number;
  factualAccuracy: number;
  byTopic: Record<string, number>;
}

// Alucinacion basada en feedback humano explicito de los hoteles (distinta de
// `HallucinationMetrics`, que se calcula con el score de IA autoevaluado).
export interface FeedbackHallucinationMetrics {
  rate: number;
  count: number;
  reviewedCount: number;
  positiveRate: number;
}

export interface EscalationMetrics {
  rate: number;
  count: number;
  byTarget: Record<string, number>;
}

export interface AgentMetrics {
  conversations: ConversationMetrics;
  performance: PerformanceMetrics;
  hallucination: HallucinationMetrics;
  feedbackHallucination?: FeedbackHallucinationMetrics;
  escalation?: EscalationMetrics;
  usuariosMetricas?: {
    byCategoriaUsuario?: Record<string, number>;
    byOrigenPais?: Record<string, number>;
  };
  preguntasMetricas?: {
    byPreguntaBase?: Record<string, number> | null;
  };
  database?: string;
  lastUpdated: Date;
}

export interface AgentVersion {
  id?: string;
  version: number;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tools?: unknown[];
  guardrails?: Record<string, unknown>;
  created_at?: string;
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'draft' | 'published' | 'paused' | string;
  default_language: string;
  avatar?: string;
  created_at?: string;
  updated_at?: string;
  active_version: AgentVersion;
}

export interface AgentSummary extends Omit<Agent, 'active_version'> {
  active_version: Pick<AgentVersion, 'id' | 'version' | 'model'>;
}

export interface AgentPayload {
  id?: string;
  slug?: string;
  name: string;
  description?: string;
  status?: string;
  default_language?: string;
  avatar?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  guardrails?: Record<string, unknown>;
}

export interface CaptureConversationPayload {
  agent_id?: string;
  agent_slug?: string;
  asistente_nombre?: string;
  pregunta: string;
  respuesta: string;
  usuario_nombre?: string;
  usuario_email?: string;
  usuario_id?: string;
  region?: string;
  categoria?: string;
  origen_pais?: string;
  pregunta_base?: string;
  fuente?: string;
  tipo_interaccion?: string;
}

export interface CaptureConversationResponse {
  status: string;
  score_promedio?: number;
  usuario_email?: string;
  asistente?: string;
  mensaje?: string;
  message?: string;
  agent?: AgentSummary;
  data?: {
    conversationId?: string;
  };
}

export interface ChatRequestPayload {
  pregunta: string;
  agent_id?: string;
  agent_slug?: string;
  usuario_nombre?: string;
  usuario_email?: string;
  usuario_id?: string;
  region?: string;
}

export interface ChatResponse {
  status: string;
  respuesta: string;
  modelo?: string;
  message?: string;
  agent?: AgentSummary;
}

export interface ConversationRecord {
  _id?: string;
  id?: string;
  agent_id?: string;
  agent_version_id?: string;
  asistente_nombre: string;
  pregunta: string;
  respuesta: string;
  usuario_nombre?: string;
  usuario_email?: string;
  usuario_id?: string;
  score_promedio?: number;
  timestamp?: string;
  createdAt?: string;
  created_at?: string;
  updated_at?: string;
  categoria?: string;
  origen_pais?: string;
  pregunta_base?: string;
  fuente?: string;
  tipo_interaccion?: string;
  model?: string;
  latency_ms?: number;
  feedback_rating?: 'positive' | 'negative' | 'neutral' | string;
  feedback_category?: string;
  feedback_comment?: string;
  feedback_received_at?: string;
  escalated_to_human?: boolean;
  escalation_target?: string;
  escalation_reason?: string;
}

export type FeedbackRating = 'positive' | 'negative' | 'neutral';
export type FeedbackCategory =
  | 'accurate_helpful'
  | 'hallucination'
  | 'incomplete'
  | 'irrelevant'
  | 'needs_human'
  | 'other';

export interface ConversationFeedbackPayload {
  feedback_rating?: FeedbackRating;
  feedback_category?: FeedbackCategory;
  feedback_comment?: string;
  escalated_to_human?: boolean;
  escalation_target?: string;
  escalation_reason?: string;
}

export interface ConversationFilters {
  feedback_category?: string;
  escalated?: boolean;
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface ConversationData extends ChartDataPoint {
  satisfaction: number;
  duration: number;
}

export interface PerformanceData extends ChartDataPoint {
  latency: number;
  errors: number;
}