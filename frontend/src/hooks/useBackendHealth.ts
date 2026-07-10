import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

interface UseBackendHealthReturn {
  isHealthy: boolean;
  isChecking: boolean;
  error: string | null;
  retry: () => Promise<void>;
  lastCheck: Date | null;
}

export const useBackendHealth = (): UseBackendHealthReturn => {
  const [isHealthy, setIsHealthy] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setIsChecking(true);
      setError(null);
      const health = await apiService.checkHealth();
      setIsHealthy(health);
      setLastCheck(new Date());
      if (!health) {
        setError('Backend no está respondiendo correctamente');
      }
    } catch (err) {
      setIsHealthy(false);
      const errorMessage = err instanceof Error ? err.message : 'Error checking backend health';
      setError(errorMessage);
      console.error('Backend health check failed:', err);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check health on mount and then every 30 seconds
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void checkHealth();
    }, 0);
    const intervalId = window.setInterval(() => {
      void checkHealth();
    }, 30000);

    return () => {
      window.clearTimeout(timerId);
      window.clearInterval(intervalId);
    };
  }, [checkHealth]);

  return {
    isHealthy,
    isChecking,
    error,
    retry: checkHealth,
    lastCheck,
  };
};
