import { useState, useEffect, useCallback } from 'react';
import type { AgentMetrics } from '../types';
import { apiService } from '../services/api';

interface UseMetricsReturn {
  metrics: AgentMetrics;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isRealtime: boolean;
  setIsRealtime: (value: boolean) => void;
}

const DEFAULT_METRICS: AgentMetrics = {
  conversations: {
    total: 0,
    today: 0,
    averageDuration: 0,
    averageSatisfaction: 0,
    trend: 0,
  },
  performance: {
    uptime: 0,
    averageLatency: 0,
    errorRate: 0,
    requestsPerMinute: 0,
    peakLatency: 0,
  },
  hallucination: {
    rate: 0,
    count: 0,
    factualAccuracy: 0,
    byTopic: {},
  },
  lastUpdated: new Date(),
};

export const useMetrics = (
  refreshInterval: number = 30000, // 30 seconds default
  enableRealtime: boolean = true
): UseMetricsReturn => {
  const [metrics, setMetrics] = useState<AgentMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtime, setIsRealtime] = useState(enableRealtime);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getMetrics();
      setMetrics(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error fetching metrics';
      setError(errorMessage);
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch immediately on mount
    fetchMetrics();

    // Set up interval for real-time updates
    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (isRealtime) {
      intervalId = setInterval(fetchMetrics, refreshInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchMetrics, refreshInterval, isRealtime]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
    isRealtime,
    setIsRealtime,
  };
};
