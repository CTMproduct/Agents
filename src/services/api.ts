import axios from 'axios';
import type {
  AgentMetrics,
  CaptureConversationPayload,
  CaptureConversationResponse,
  ChatRequestPayload,
  ChatResponse,
  ConversationMetrics,
  PerformanceMetrics,
  HallucinationMetrics,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  /**
   * Obtiene las métricas actuales del agente Nora
   */
  async getMetrics(): Promise<AgentMetrics> {
    try {
      const response = await apiClient.get('/api/metrics');
      return {
        conversations: response.data.conversations || generateMockConversationMetrics(),
        performance: response.data.performance || generateMockPerformanceMetrics(),
        hallucination: response.data.hallucination || generateMockHallucinationMetrics(),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return generateMockMetrics();
    }
  },

  /**
   * Obtiene histórico de conversaciones
   */
  async getConversationHistory(limit: number = 24): Promise<Array<{ timestamp: string; count: number; satisfaction: number }>> {
    try {
      const response = await apiClient.get(`/api/conversations/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return generateMockConversationHistory(limit);
    }
  },

  /**
   * Obtiene histórico de rendimiento
   */
  async getPerformanceHistory(limit: number = 24): Promise<Array<{ timestamp: string; latency: number; errors: number }>> {
    try {
      const response = await apiClient.get(`/api/performance/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching performance history:', error);
      return generateMockPerformanceHistory(limit);
    }
  },

  /**
   * Obtiene histórico de alucinaciones
   */
  async getHallucinationHistory(limit: number = 7): Promise<Array<{ date: string; rate: number; count: number }>> {
    try {
      const response = await apiClient.get(`/api/hallucinations/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching hallucination history:', error);
      return generateMockHallucinationHistory(limit);
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

// Mock data generators for development
function generateMockConversationMetrics(): ConversationMetrics {
  return {
    total: 1250,
    today: 45,
    averageDuration: 4.5,
    averageSatisfaction: 4.2,
    trend: 12.5,
  };
}

function generateMockPerformanceMetrics(): PerformanceMetrics {
  return {
    uptime: 99.8,
    averageLatency: 245,
    errorRate: 0.5,
    requestsPerMinute: 120,
    peakLatency: 890,
  };
}

function generateMockHallucinationMetrics(): HallucinationMetrics {
  return {
    rate: 2.3,
    count: 28,
    factualAccuracy: 97.7,
    byTopic: {
      'Travel Info': 1.2,
      'Flight Details': 3.5,
      'Hotel Booking': 2.1,
      'General Info': 1.8,
    },
  };
}

function generateMockMetrics(): AgentMetrics {
  return {
    conversations: generateMockConversationMetrics(),
    performance: generateMockPerformanceMetrics(),
    hallucination: generateMockHallucinationMetrics(),
    lastUpdated: new Date(),
  };
}

function generateMockConversationHistory(limit: number) {
  return Array.from({ length: limit }, (_, i) => ({
    timestamp: new Date(Date.now() - (limit - i - 1) * 3600000).toLocaleTimeString(),
    count: Math.floor(Math.random() * 50 + 20),
    satisfaction: parseFloat((Math.random() * 0.8 + 3.8).toFixed(1)),
  }));
}

function generateMockPerformanceHistory(limit: number) {
  return Array.from({ length: limit }, (_, i) => ({
    timestamp: new Date(Date.now() - (limit - i - 1) * 3600000).toLocaleTimeString(),
    latency: Math.floor(Math.random() * 400 + 100),
    errors: Math.floor(Math.random() * 5),
  }));
}

function generateMockHallucinationHistory(limit: number) {
  return Array.from({ length: limit }, (_, i) => ({
    date: new Date(Date.now() - (limit - i - 1) * 86400000).toLocaleDateString(),
    rate: parseFloat((Math.random() * 3 + 1).toFixed(2)),
    count: Math.floor(Math.random() * 10 + 2),
  }));
}
