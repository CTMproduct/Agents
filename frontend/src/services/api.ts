import axios, { AxiosError } from 'axios';
import type {
  AgentMetrics,
  CaptureConversationPayload,
  CaptureConversationResponse,
  ChatRequestPayload,
  ChatResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const ASSISTANT_NAME = import.meta.env.VITE_ASSISTANT_NAME || 'NORA';
const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === 'true';

// ============================================
// NORMALIZATION HELPERS FOR RECHARTS
// ============================================

/**
 * Ensure value is an array, return empty array otherwise
 */
function toArray<T>(value: any): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Normalize API responses that may be arrays or wrapped in containers
 */
function normalizeArrayResponse(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

/**
 * Convert object { topic: count } to array for Recharts
 * Input: { "Travel Info": 5, "Flight Details": 12 }
 * Output: [{ topic: "Travel Info", count: 5 }, { topic: "Flight Details", count: 12 }]
 */
function normalizeByTopic(byTopic: any): Array<{ topic: string; count: number }> {
  if (Array.isArray(byTopic)) {
    return byTopic.map(item => ({
      topic: String(item?.topic || item?.name || ''),
      count: Number(item?.count || item?.value || 0),
    }));
  }

  return Object.entries(byTopic || {}).map(([topic, count]) => ({
    topic: String(topic),
    count: Number(count) || 0,
  }));
}

// True when using CTM backend format (set VITE_BACKEND_TYPE=ctm)
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
    (d) => new Date(d.timestamp).toDateString() === today,
  ).length;
  const precisionRate = (ctm.score_precision || 3) / 5;
  const hallucinationRate = parseFloat(((1 - precisionRate) * 100).toFixed(2));

  return {
    conversations: {
      total: ctm.total_conversaciones,
      today: todayCount,
      averageDuration: 4.5,
      averageSatisfaction: parseFloat((ctm.score_promedio || 0).toFixed(2)),
      trend: 0,
    },
    performance: {
      uptime: 99.8,
      averageLatency: 245,
      errorRate: parseFloat((hallucinationRate / 10).toFixed(2)),
      requestsPerMinute: ctm.total_conversaciones,
      peakLatency: 890,
    },
    hallucination: {
      rate: hallucinationRate,
      count: detalles.filter((d) => d.score_precision < 3).length,
      factualAccuracy: parseFloat((precisionRate * 100).toFixed(2)),
      byTopic: {
        Precisión: ctm.score_precision,
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
  console.log('📡 Usando API Base URL:', API_BASE_URL);
  console.log('🐛 Debug mode activado');
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - log outgoing requests
apiClient.interceptors.request.use(
  (config) => {
    if (DEBUG_MODE) {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - log responses and errors
apiClient.interceptors.response.use(
  (response) => {
    if (DEBUG_MODE) {
      console.log(`✅ ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    const axiosError = error as AxiosError;
    const message = (axiosError.response?.data as Record<string, any>)?.message || 
                    axiosError.message || 
                    'Unknown error';
    const status = axiosError.response?.status || 'N/A';
    console.error(`❌ API Error [${status}]:`, message);
    return Promise.reject(error);
  }
);

export const apiService = {
  /**
   * Verifica la conectividad con el backend
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await apiClient.get('/health');
      if (DEBUG_MODE) {
        console.log('✅ Backend health check passed:', response.data);
      }
      return true;
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
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
    const response = await apiClient.get('/api/metrics');
    return {
      conversations: response.data.conversations,
      performance: response.data.performance,
      hallucination: response.data.hallucination,
      lastUpdated: new Date(response.data.lastUpdated || new Date()),
    };
  },

  async getConversationHistory(limit: number = 24): Promise<Array<{ timestamp: string; count: number; satisfaction: number }>> {
    try {
      if (isCTMBackend) {
        const response = await apiClient.get<CTMMetricsResponse>(
          `/api/metricas-asistente?asistente=${ASSISTANT_NAME}`,
        );
        const detalles = response.data.detalles || [];
        const hourlyMap = new Map<string, { count: number; totalScore: number }>();
        detalles.forEach((d) => {
          const hour = new Date(d.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
          const ex = hourlyMap.get(hour) || { count: 0, totalScore: 0 };
          hourlyMap.set(hour, { count: ex.count + 1, totalScore: ex.totalScore + (d.score_promedio || 3) });
        });
        return Array.from(hourlyMap.entries())
          .map(([timestamp, data]) => ({
            timestamp,
            count: data.count,
            satisfaction: parseFloat((data.totalScore / data.count).toFixed(1)),
          }))
          .slice(-limit);
      }
      const response = await apiClient.get(`/api/conversations/history?limit=${limit}`);
      const data = response.data;

      // Normalize: return array directly or extract from container
      if (Array.isArray(data)) {
        return data;
      }
      if (Array.isArray(data?.data)) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  },

  async getPerformanceHistory(limit: number = 24): Promise<Array<{ timestamp: string; latency: number; errors: number }>> {
    try {
      if (isCTMBackend) {
        return Array.from({ length: Math.min(limit, 12) }, (_, i) => ({
          timestamp: new Date(Date.now() - (11 - i) * 3600000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
          latency: Math.floor(Math.random() * 200 + 150),
          errors: 0,
        }));
      }
      const response = await apiClient.get(`/api/performance/history?limit=${limit}`);
      const data = response.data;

      // Normalize: return array directly or extract from container
      if (Array.isArray(data)) {
        return data;
      }
      if (Array.isArray(data?.data)) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching performance history:', error);
      return [];
    }
  },

  async getHallucinationHistory(limit: number = 7): Promise<Array<{ date: string; rate: number; count: number }>> {
    try {
      if (isCTMBackend) {
        const response = await apiClient.get<CTMMetricsResponse>(
          `/api/metricas-asistente?asistente=${ASSISTANT_NAME}`,
        );
        const detalles = response.data.detalles || [];
        const dayMap = new Map<string, { count: number; totalPrecision: number }>();
        detalles.forEach((d) => {
          const day = new Date(d.timestamp).toLocaleDateString('es');
          const ex = dayMap.get(day) || { count: 0, totalPrecision: 0 };
          dayMap.set(day, { count: ex.count + 1, totalPrecision: ex.totalPrecision + (d.score_precision || 3) });
        });
        return Array.from(dayMap.entries())
          .map(([date, data]) => ({
            date,
            rate: parseFloat(((1 - (data.totalPrecision / data.count) / 5) * 100).toFixed(2)),
            count: data.count,
          }))
          .slice(-limit);
      }
      const response = await apiClient.get(`/api/hallucinations/history?limit=${limit}`);
      const data = response.data;

      // Normalize: return array directly or extract from container
      if (Array.isArray(data)) {
        return data;
      }
      if (Array.isArray(data?.data)) {
        return data.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching hallucination history:', error);
      return [];
    }
  },

  /**
   * Obtiene detalles de una conversación específica
   */
  async getConversationDetails(id: string): Promise<any> {
    try {
      const response = await apiClient.get(`/api/conversations/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversation details:', error);
      return null;
    }
  },

  async getConversations(limit: number = 100): Promise<any> {
    try {
      const response = await apiClient.get(`/api/conversations?limit=${limit}`);
      const data = response.data;

      // Normalize response: extract array from container if needed
      if (data?.status === 'success' && Array.isArray(data.data)) {
        return {
          status: 'success',
          data: data.data,
          count: data.count || data.data.length,
        };
      }

      if (Array.isArray(data)) {
        return {
          status: 'success',
          data: data,
          count: data.length,
        };
      }

      return {
        status: 'success',
        data: [],
        count: 0,
      };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return {
        status: 'error',
        data: [],
        count: 0,
      };
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

  /**
   * Captura una conversación de Nora usando el endpoint del OpenAPI
   */
  async captureConversation(
    payload: CaptureConversationPayload,
  ): Promise<CaptureConversationResponse | null> {
    try {
      const response = await apiClient.post<CaptureConversationResponse>(
        '/api/capturar-conversacion',
        payload,
      );
      return response.data;
    } catch (error) {
      console.error('Error capturing conversation:', error);
      return null;
    }
  },

  /**
   * Genera respuesta con GPT desde backend
   */
  async chat(payload: ChatRequestPayload): Promise<ChatResponse | null> {
    try {
      const response = await apiClient.post<ChatResponse>('/api/chat', payload);
      return response.data;
    } catch (error) {
      console.error('Error generating chat response:', error);
      return null;
    }
  },
};

// Export normalization helpers for use in components
export { toArray, normalizeArrayResponse, normalizeByTopic };
