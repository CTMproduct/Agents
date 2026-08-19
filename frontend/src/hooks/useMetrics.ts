import { useState, useEffect, useCallback, useRef } from 'react';
import type { AgentMetrics } from '../types';
import { apiService } from '../services/api';
import { DEFAULT_METRICS, mergeMetricsWithDefaults } from '../constants/defaults';

interface UseMetricsReturn {
  metrics: AgentMetrics;
  loading: boolean;
  error: string | null;
  hasData: boolean;
  refetch: () => Promise<void>;
  isRealtime: boolean;
  setIsRealtime: (value: boolean) => void;
}

const RETRY_DELAY_MS = 2000;
const MAX_ATTEMPTS = 2;

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';

  if (/network/i.test(message)) {
    return 'No se pudo conectar con el servidor. Puede estar reiniciandose tras un despliegue; se reintentara automaticamente.';
  }

  if (/timeout/i.test(message)) {
    return 'El servidor tardo demasiado en responder. Se reintentara automaticamente.';
  }

  return message || 'Error al obtener las metricas';
}

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const useMetrics = (
  refreshInterval: number = 30000, // 30 seconds default
  enableRealtime: boolean = true
): UseMetricsReturn => {
  const [metrics, setMetrics] = useState<AgentMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const [isRealtime, setIsRealtime] = useState(enableRealtime);
  // Ref ademas del estado para poder consultarlo dentro del bucle de
  // reintentos sin re-crear fetchMetrics en cada render.
  const hasDataRef = useRef(false);

  const fetchMetrics = useCallback(async () => {
    // El spinner solo aplica a la primera carga: en los refrescos
    // automaticos el dashboard debe seguir visible.
    if (!hasDataRef.current) {
      setLoading(true);
    }

    // Un fallo puntual (por ejemplo mientras el backend reinicia tras un
    // deploy) no debe tumbar el dashboard: reintentamos una vez antes de
    // reportar el error y conservamos los ultimos datos buenos.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const data = await apiService.getMetrics();
        setMetrics(mergeMetricsWithDefaults(data));
        hasDataRef.current = true;
        setHasData(true);
        setError(null);
        setLoading(false);
        return;
      } catch (err) {
        if (attempt < MAX_ATTEMPTS) {
          await delay(RETRY_DELAY_MS);
          continue;
        }

        console.error('Failed to fetch metrics:', err);
        setError(describeError(err));
        // Solo caemos a los valores por defecto si nunca llegamos a
        // cargar datos; si ya habia metricas se mantienen en pantalla.
        if (!hasDataRef.current) {
          setMetrics(DEFAULT_METRICS);
        }
      }
    }

    setLoading(false);
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
    hasData,
    refetch: fetchMetrics,
    isRealtime,
    setIsRealtime,
  };
};
