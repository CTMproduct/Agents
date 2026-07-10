import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

type ConversationHistoryPoint = {
  timestamp: string;
  count: number;
  satisfaction: number;
};

type PerformanceHistoryPoint = {
  timestamp: string;
  latency: number;
  errors: number;
};

type HallucinationHistoryPoint = {
  date: string;
  rate: number;
  count: number;
};

export const useConversationHistory = (limit: number = 24) => {
  const [data, setData] = useState<ConversationHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await apiService.getConversationHistory(limit);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
    const interval = window.setInterval(() => {
      void fetchData();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
};

export const usePerformanceHistory = (limit: number = 24) => {
  const [data, setData] = useState<PerformanceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await apiService.getPerformanceHistory(limit);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
    const interval = window.setInterval(() => {
      void fetchData();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
};

export const useHallucinationHistory = (limit: number = 7) => {
  const [data, setData] = useState<HallucinationHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await apiService.getHallucinationHistory(limit);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
    const interval = window.setInterval(() => {
      void fetchData();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [limit]);

  return { data, loading, error };
};