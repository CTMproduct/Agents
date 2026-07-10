import { useState, useEffect, useCallback } from 'react';
import type { AgentMetrics } from '../types';
import { apiService } from '../services/api';
import { DEFAULT_METRICS, mergeMetricsWithDefaults } from '../constants/defaults';

interface UseMetricsReturn {
  metrics: AgentMetrics;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isRealtime: boolean;
  setIsRealtime: (value: boolean) => void;
}

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
      // Merge with defaults to ensure all properties exist
      const mergedMetrics = mergeMetricsWithDefaults(data);
      setMetrics(mergedMetrics);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error fetching metrics';
      setError(errorMessage);
      console.error('Failed to fetch metrics:', err);
      // Show defaults if fetch fails
      setMetrics(DEFAULT_METRICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchMetrics();
    }, 0);

    let intervalId: ReturnType<typeof window.setInterval> | undefined;
    if (isRealtime) {
      intervalId = window.setInterval(() => {
        void fetchMetrics();
      }, refreshInterval);
    }

    return () => {
      window.clearTimeout(timerId);
      if (intervalId) {
        window.clearInterval(intervalId);
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
