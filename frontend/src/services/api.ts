import axios, { AxiosError } from 'axios';
import type {
  Agent,
  AgentMetrics,
  AgentPayload,
  CaptureConversationPayload,
  CaptureConversationResponse,
  ChatRequestPayload,
  ChatResponse,
  ConversationRecord,
} from '../types';
import { prepareConversationData } from '../utils/categoryClassifier';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const ASSISTANT_NAME = import.meta.env.VITE_ASSISTANT_NAME || 'NORA';
const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === 'true';
const AGENT_ADMIN_STORAGE_KEY = 'nora-agent-admin-key';

function getStoredAgentAdminKey(): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(AGENT_ADMIN_STORAGE_KEY) || '';
}

function storeAgentAdminKey(value: string) {
  if (typeof window === 'undefined') return;
  const cleanValue = value.trim();
  if (cleanValue) {
    window.sessionStorage.setItem(AGENT_ADMIN_STORAGE_KEY, cleanValue);
  } else {
    window.sessionStorage.removeItem(AGENT_ADMIN_STORAGE_KEY);
  }
}

type ApiListResponse<T> = {
  status?: string;
  data?: T[];
  count?: number;
};

type ApiEntityResponse<T> = {
  status?: string;
  data?: T;
};

type MetricsApiResponse = Omit<AgentMetrics, 'lastUpdated'> & {
  status?: string;
  lastUpdated?: string | Date;
};

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeArrayResponse(response: unknown): unknown[] {
  if (Array.isArray(response)) return response;
  if (typeof response === 'object' && response !== null && Array.isArray((response as { data?: unknown }).data)) {
    return (response as { data: unknown[] }).data;
  }
  return [];
}

function normalizeByTopic(byTopic: unknown): Array<{ topic: string; count: number }> {
  if (Array.isArray(byTopic)) {
    return byTopic.map((item) => ({
      topic: String((item as { topic?: unknown; name?: unknown })?.topic || (item as { name?: unknown })?.name || ''),
      count: Number((item as { count?: unknown; value?: unknown })?.count || (item as { value?: unknown })?.value || 0),
    }));
  }

  return Object.entries((byTopic || {}) as Record<string, unknown>).map(([topic, count]) => ({
    topic: String(topic),
    count: Number(count) || 0,
  }));
}

const isCTMBackend =
  import.meta.env.VITE_BACKEND_TYPE === 'ctm' ||
  API_BASE_URL.includes('ctm-analyzer-backend');

interface CTMConversacion {
  id: string;
  score_precision: number;
  score_claridad: number;
  score_relevancia: number;
  score_completitud: number;
  score_utilidad: number;
  score_promedio: number;
  timestamp: string;
}

interface CTMMetricsResponse {
  asistente: string;
  total_conversaciones: number;
  score_promedio: number;
  score_precision: number;
  score_claridad: number;
  score_relevancia: number;
  score_completitud: number;
  score_utilidad: number;
  detalles: CTMConversacion[];
}

function mapCTMToAgentMetrics(ctm: CTMMetricsResponse): AgentMetrics {
  const today = new Date().toDateString();
  const detalles = ctm.detalles || [];
  const todayCount = detalles.filter(
    (item) => new Date(item.timestamp).toDateString() === today,
  ).length;
  const precisionRate = (ctm.score_precision || 3) / 5;
  const hallucinationRate = Number(((1 - precisionRate) * 100).toFixed(2));

  return {
    conversations: {
      total: ctm.total_conversaciones,
      today: todayCount,
      averageDuration: 4.5,
      averageSatisfaction: Number((ctm.score_promedio || 0).toFixed(2)),
      trend: 0,
    },
    performance: {
      uptime: 99.8,
      averageLatency: 245,
      errorRate: Number((hallucinationRate / 10).toFixed(2)),
      requestsPerMinute: ctm.total_conversaciones,
      peakLatency: 890,
    },
    hallucination: {
      rate: hallucinationRate,
      count: detalles.filter((item) => item.score_precision < 3).length,
      factualAccuracy: Number((precisionRate * 100).toFixed(2)),
      byTopic: {
        Precision: ctm.score_precision,
        Claridad: ctm.score_claridad,
        Relevancia: ctm.score_relevancia,
        Completitud: ctm.score_completitud,
        Utilidad: ctm.score_utilidad,
      },
    },
    lastUpdated: new Date(),
  };
}

if (DEBUG_MODE) {
  console.log('[API] Base URL:', API_BASE_URL || 'same-origin');
  console.log('[API] Debug mode active');
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (DEBUG_MODE) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }

    const adminKey = getStoredAgentAdminKey();
    if (adminKey && !config.headers.get('X-Agent-Admin-Key')) {
      config.headers.set('X-Agent-Admin-Key', adminKey);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => {
    if (DEBUG_MODE) {
      console.log(`[API] ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    const axiosError = error as AxiosError;
    const data = axiosError.response?.data as { message?: string } | undefined;
    const message = data?.message || axiosError.message || 'Unknown error';
    const status = axiosError.response?.status || 'N/A';
    console.error(`[API] Error [${status}]:`, message);
    return Promise.reject(error);
  },
);

export const apiService = {
  getAgentAdminKey(): string {
    return getStoredAgentAdminKey();
  },

  setAgentAdminKey(value: string) {
    storeAgentAdminKey(value);
  },

  clearAgentAdminKey() {
    storeAgentAdminKey('');
  },

  async verifyAgentAdminKey(value: string): Promise<boolean> {
    const cleanValue = value.trim();
    if (!cleanValue) return false;

    try {
      await apiClient.post(
        '/api/agents/admin/verify',
        {},
        { headers: { 'X-Agent-Admin-Key': cleanValue } },
      );
      storeAgentAdminKey(cleanValue);
      return true;
    } catch (error) {
      console.error('Error verifying agent access:', error);
      return false;
    }
  },

  async checkHealth(): Promise<boolean> {
    try {
      await apiClient.get('/health');
      return true;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  },

  async getMetrics(): Promise<AgentMetrics> {
    if (isCTMBackend) {
      const response = await apiClient.get<CTMMetricsResponse>(
        `/api/metricas-asistente?asistente=${ASSISTANT_NAME}`,
      );
      return mapCTMToAgentMetrics(response.data);
    }

    const response = await apiClient.get<MetricsApiResponse>('/api/metrics');
    return {
      conversations: response.data.conversations,
      performance: response.data.performance,
      hallucination: response.data.hallucination,
      usuariosMetricas: response.data.usuariosMetricas,
      preguntasMetricas: response.data.preguntasMetricas,
      database: response.data.database,
      lastUpdated: new Date(response.data.lastUpdated || new Date()),
    };
  },

  async getConversationHistory(limit = 24): Promise<Array<{ timestamp: string; count: number; satisfaction: number }>> {
    try {
      if (isCTMBackend) {
        const response = await apiClient.get<CTMMetricsResponse>(
          `/api/metricas-asistente?asistente=${ASSISTANT_NAME}`,
        );
        const hourlyMap = new Map<string, { count: number; totalScore: number }>();
        response.data.detalles.forEach((item) => {
          const hour = new Date(item.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
          const existing = hourlyMap.get(hour) || { count: 0, totalScore: 0 };
          hourlyMap.set(hour, { count: existing.count + 1, totalScore: existing.totalScore + (item.score_promedio || 3) });
        });
        return Array.from(hourlyMap.entries())
          .map(([timestamp, data]) => ({
            timestamp,
            count: data.count,
            satisfaction: Number((data.totalScore / data.count).toFixed(1)),
          }))
          .slice(-limit);
      }

      const response = await apiClient.get(`/api/conversations/history?limit=${limit}`);
      return normalizeArrayResponse(response.data) as Array<{ timestamp: string; count: number; satisfaction: number }>;
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  },

  async getPerformanceHistory(limit = 24): Promise<Array<{ timestamp: string; latency: number; errors: number }>> {
    try {
      if (isCTMBackend) {
        const response = await apiClient.get<CTMMetricsResponse>(
          `/api/metricas-asistente?asistente=${ASSISTANT_NAME}`,
        );
        return response.data.detalles.slice(-limit).map((item) => ({
          timestamp: new Date(item.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
          latency: 0,
          errors: item.score_precision < 3 ? 1 : 0,
        }));
      }

      const response = await apiClient.get(`/api/performance/history?limit=${limit}`);
      return normalizeArrayResponse(response.data) as Array<{ timestamp: string; latency: number; errors: number }>;
    } catch (error) {
      console.error('Error fetching performance history:', error);
      return [];
    }
  },

  async getHallucinationHistory(limit = 7): Promise<Array<{ date: string; rate: number; count: number }>> {
    try {
      if (isCTMBackend) {
        const response = await apiClient.get<CTMMetricsResponse>(
          `/api/metricas-asistente?asistente=${ASSISTANT_NAME}`,
        );
        const dayMap = new Map<string, { count: number; totalPrecision: number }>();
        response.data.detalles.forEach((item) => {
          const day = new Date(item.timestamp).toLocaleDateString('es');
          const existing = dayMap.get(day) || { count: 0, totalPrecision: 0 };
          dayMap.set(day, { count: existing.count + 1, totalPrecision: existing.totalPrecision + (item.score_precision || 3) });
        });
        return Array.from(dayMap.entries())
          .map(([date, data]) => ({
            date,
            rate: Number(((1 - (data.totalPrecision / data.count) / 5) * 100).toFixed(2)),
            count: data.count,
          }))
          .slice(-limit);
      }

      const response = await apiClient.get(`/api/hallucinations/history?limit=${limit}`);
      return normalizeArrayResponse(response.data) as Array<{ date: string; rate: number; count: number }>;
    } catch (error) {
      console.error('Error fetching hallucination history:', error);
      return [];
    }
  },

  async getAgents(): Promise<Agent[]> {
    try {
      const response = await apiClient.get<ApiListResponse<Agent>>('/api/agents');
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  },

  async createAgent(payload: AgentPayload): Promise<Agent | null> {
    try {
      const response = await apiClient.post<ApiEntityResponse<Agent>>('/api/agents', payload);
      return response.data.data || null;
    } catch (error) {
      console.error('Error creating agent:', error);
      return null;
    }
  },

  async updateAgent(id: string, payload: AgentPayload): Promise<Agent | null> {
    try {
      const response = await apiClient.patch<ApiEntityResponse<Agent>>(`/api/agents/${id}`, payload);
      return response.data.data || null;
    } catch (error) {
      console.error('Error updating agent:', error);
      return null;
    }
  },

  async testAgent(id: string, pregunta: string): Promise<ChatResponse | null> {
    try {
      const response = await apiClient.post<ChatResponse>(`/api/agents/${id}/test`, { pregunta });
      return response.data;
    } catch (error) {
      console.error('Error testing agent:', error);
      return null;
    }
  },

  async getConversationDetails(id: string): Promise<ConversationRecord | null> {
    try {
      const response = await apiClient.get<ConversationRecord>(`/api/conversations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversation details:', error);
      return null;
    }
  },

  async getConversations(limit = 100): Promise<{ status: string; data: ConversationRecord[]; count: number }> {
    try {
      const response = await apiClient.get<ApiListResponse<ConversationRecord> | ConversationRecord[]>(`/api/conversations?limit=${limit}`);
      const data = response.data;

      if (Array.isArray(data)) {
        return { status: 'success', data, count: data.length };
      }

      return {
        status: data.status || 'success',
        data: data.data || [],
        count: data.count || data.data?.length || 0,
      };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return { status: 'error', data: [], count: 0 };
    }
  },

  async exportConversations(format: 'csv' | 'json'): Promise<Blob | null> {
    try {
      const response = await apiClient.get(`/api/export/conversations?format=${format}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting conversations:', error);
      return null;
    }
  },

  async chat(payload: ChatRequestPayload): Promise<ChatResponse | null> {
    try {
      const response = await apiClient.post<ChatResponse>('/api/chat', payload);
      return response.data;
    } catch (error) {
      console.error('Error generating chat response:', error);
      return null;
    }
  },

  async captureConversation(data: CaptureConversationPayload): Promise<CaptureConversationResponse | null> {
    try {
      const payload = prepareConversationData(data) as CaptureConversationPayload;
      const response = await apiClient.post<CaptureConversationResponse>('/api/capturar-conversacion', payload);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        console.error('Error capturing conversation:', error.response?.status || error.message);
      } else {
        console.error('Error capturing conversation:', error);
      }
      return null;
    }
  },
};

export { toArray, normalizeArrayResponse, normalizeByTopic };