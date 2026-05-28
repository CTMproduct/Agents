export interface ConversationMetrics {
  total: number;
  today: number;
  averageDuration: number;
  averageSatisfaction: number;
  trend: number; // percentage change
}

export interface PerformanceMetrics {
  uptime: number; // percentage
  averageLatency: number; // ms
  errorRate: number; // percentage
  requestsPerMinute: number;
  peakLatency: number; // ms
}

export interface HallucinationMetrics {
  rate: number; // percentage
  count: number;
  factualAccuracy: number; // percentage
  byTopic: Record<string, number>;
}

export interface AgentMetrics {
  conversations: ConversationMetrics;
  performance: PerformanceMetrics;
  hallucination: HallucinationMetrics;
  lastUpdated: Date;
}

export interface CaptureConversationPayload {
  asistente_nombre: 'NORA';
  pregunta: string;
  respuesta: string;
  usuario_nombre?: string;
  usuario_email?: string;
  usuario_id?: string;
  region: 'Nora';
}

export interface CaptureConversationResponse {
  status: string;
  score_promedio?: number;
  usuario_email?: string;
  asistente?: string;
  mensaje?: string;
  message?: string;
  data?: {
    conversationId?: string;
  };
}

export interface ChatRequestPayload {
  pregunta: string;
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
