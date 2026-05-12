import axios from 'axios';
import type {
  AgentMetrics,
  CaptureConversationPayload,
  CaptureConversationResponse,
  ChatRequestPayload,
  ChatResponse,
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
        conversations: response.data.conversations,
        performance: response.data.performance,
        hallucination: response.data.hallucination,
        lastUpdated: new Date(response.data.lastUpdated || new Date()),
      };
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw error;
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
      return [];
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
      return [];
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

