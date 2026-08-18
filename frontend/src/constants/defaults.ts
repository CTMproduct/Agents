import type { AgentMetrics } from '../types';

export const DEFAULT_METRICS: AgentMetrics = {
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
  feedbackHallucination: {
    rate: 0,
    count: 0,
    reviewedCount: 0,
    positiveRate: 0,
  },
  escalation: {
    rate: 0,
    count: 0,
    byTarget: {},
  },
  lastUpdated: new Date(),
};

type MetricsInput = Partial<Omit<AgentMetrics, 'lastUpdated'>> & {
  lastUpdated?: string | Date;
};

/**
 * Merge API response with defaults to avoid undefined errors
 */
export function mergeMetricsWithDefaults(data?: MetricsInput | null): AgentMetrics {
  if (!data) return DEFAULT_METRICS;

  return {
    conversations: {
      ...DEFAULT_METRICS.conversations,
      ...(data?.conversations || {}),
    },
    performance: {
      ...DEFAULT_METRICS.performance,
      ...(data?.performance || {}),
    },
    hallucination: {
      ...DEFAULT_METRICS.hallucination,
      ...(data?.hallucination || {}),
      byTopic: {
        ...DEFAULT_METRICS.hallucination.byTopic,
        ...(data?.hallucination?.byTopic || {}),
      },
    },
    feedbackHallucination: {
      ...DEFAULT_METRICS.feedbackHallucination!,
      ...(data?.feedbackHallucination || {}),
    },
    escalation: {
      ...DEFAULT_METRICS.escalation!,
      ...(data?.escalation || {}),
      byTarget: {
        ...DEFAULT_METRICS.escalation!.byTarget,
        ...(data?.escalation?.byTarget || {}),
      },
    },
    usuariosMetricas: data?.usuariosMetricas,
    preguntasMetricas: data?.preguntasMetricas,
    database: data?.database,
    lastUpdated: data?.lastUpdated ? new Date(data.lastUpdated) : new Date(),
  };
}
