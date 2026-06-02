import React from 'react';
import { MetricCard } from '../common/MetricCard';
import { Chart } from '../charts/Chart';
import { BarChartComponent } from '../charts/BarChartComponent';
import { PieChartComponent } from '../charts/PieChartComponent';
import { StatusBar } from '../common/StatusBar';
import { Header } from '../common/Header';
import { ConversationCaptureForm } from './ConversationCaptureForm';
import { useMetrics } from '../../hooks/useMetrics';
import { useConversationHistory, usePerformanceHistory, useHallucinationHistory } from '../../hooks/useChartData';
import { normalizeByTopic } from '../../services/api';
import '../../styles/Dashboard.css';
import { ConversationsList } from './ConversationsList';

export const Dashboard: React.FC = () => {
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    refetch,
    isRealtime,
    setIsRealtime,
  } = useMetrics(30000, true);

  const { data: conversationHistory, loading: convLoading } = useConversationHistory(24);
  const { data: performanceHistory, loading: perfLoading } = usePerformanceHistory(24);
  const { data: hallucinationHistory, loading: hallLoading } = useHallucinationHistory(7);

  if (metricsError) {
    return (
      <div className="dashboard dashboard--error">
        <Header agentName="Nora" />
        <div className="dashboard__error-message">
          <h2>⚠️ Error al cargar el dashboard</h2>
          <p>{metricsError}</p>
          <button onClick={() => refetch()} className="dashboard__retry-button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Header
        agentName="Nora"
        lastUpdated={metrics?.lastUpdated}
        isRealtime={isRealtime}
        onToggleRealtime={setIsRealtime}
        onRefresh={refetch}
      />

      {metricsLoading ? (
        <div className="dashboard__loading">
          <div className="dashboard__spinner">Cargando dashboard...</div>
        </div>
      ) : (
        <main className="dashboard__content">
          {/* SECTION 1: MÉTRICAS DE CONVERSACIÓN */}
          <section className="dashboard__section">
            <h2 className="dashboard__section-title">📞 Métricas de Conversación</h2>
            <div className="dashboard__metrics-grid">
              <MetricCard
                title="Total de Conversaciones"
                value={metrics?.conversations.total || 0}
                icon="💬"
                status="good"
              />
              <MetricCard
                title="Hoy"
                value={metrics?.conversations.today || 0}
                trend={metrics?.conversations.trend}
                icon="📈"
                status={
                  metrics?.conversations.today! > 50
                    ? 'good'
                    : 'warning'
                }
              />
              <MetricCard
                title="Duración Promedio"
                value={metrics?.conversations.averageDuration || 0}
                unit=" min"
                icon="⏱️"
              />
              <MetricCard
                title="Satisfacción Promedio"
                value={
                  metrics?.conversations.averageSatisfaction?.toFixed(1) || 0
                }
                unit=" / 5"
                icon="⭐"
                status={
                  metrics?.conversations.averageSatisfaction! >= 4
                    ? 'good'
                    : 'warning'
                }
              />
            </div>

            <div className="dashboard__chart-container">
              <Chart
                title="Conversaciones por Hora"
                data={conversationHistory}
                dataKey="count"
                dataKey2="satisfaction"
                loading={convLoading}
                color="#3498db"
                color2="#2ecc71"
                yAxisLabel="Conversaciones / Satisfacción"
              />
            </div>

            <div className="dashboard__chart-container">
              <ConversationCaptureForm
                onCaptureSuccess={async () => {
                  // Refrescar métricas después de capturar
                  await refetch();
                }}
              />
            </div>
          </section>

          {/* SECTION 2: RENDIMIENTO TÉCNICO */}
          <section className="dashboard__section">
            <h2 className="dashboard__section-title">⚙️ Rendimiento Técnico</h2>
            <div className="dashboard__metrics-grid">
              <MetricCard
                title="Uptime"
                value={metrics?.performance.uptime?.toFixed(2) || 0}
                unit="%"
                icon="✅"
                status={
                  metrics?.performance.uptime! >= 99
                    ? 'good'
                    : metrics?.performance.uptime! >= 95
                      ? 'warning'
                      : 'critical'
                }
              />
              <MetricCard
                title="Latencia Promedio"
                value={metrics?.performance.averageLatency || 0}
                unit=" ms"
                icon="⚡"
                status={
                  metrics?.performance.averageLatency! < 300
                    ? 'good'
                    : metrics?.performance.averageLatency! < 500
                      ? 'warning'
                      : 'critical'
                }
              />
              <MetricCard
                title="Tasa de Error"
                value={metrics?.performance.errorRate?.toFixed(2) || 0}
                unit="%"
                icon="❌"
                status={
                  metrics?.performance.errorRate! < 1
                    ? 'good'
                    : metrics?.performance.errorRate! < 3
                      ? 'warning'
                      : 'critical'
                }
              />
              <MetricCard
                title="Solicitudes/min"
                value={metrics?.performance.requestsPerMinute || 0}
                icon="📡"
              />
            </div>

            <div className="dashboard__status-section">
              <h3 className="dashboard__subsection-title">Estado del Sistema</h3>
              <div className="dashboard__status-bars">
                <StatusBar
                  label="Disponibilidad"
                  value={metrics?.performance.uptime || 0}
                />
                <StatusBar
                  label="Precisión (100% - Latencia%)"
                  value={100 - ((metrics?.performance.averageLatency || 0) / 10)}
                />
                <StatusBar
                  label="Estabilidad (100% - Error%)"
                  value={100 - (metrics?.performance.errorRate || 0)}
                />
              </div>
            </div>

            <div className="dashboard__chart-container">
              <Chart
                title="Rendimiento a lo Largo del Tiempo"
                data={performanceHistory}
                dataKey="latency"
                dataKey2="errors"
                loading={perfLoading}
                color="#e74c3c"
                color2="#f39c12"
                yAxisLabel="Latencia (ms) / Errores"
              />
            </div>
          </section>

          {/* SECTION 3: ALUCINACIÓN */}
          <section className="dashboard__section">
            <h2 className="dashboard__section-title">🧠 Análisis de Alucinación</h2>
            <div className="dashboard__metrics-grid">
              <MetricCard
                title="Tasa de Alucinación"
                value={metrics?.hallucination.rate?.toFixed(2) || 0}
                unit="%"
                icon="🚨"
                status={
                  metrics?.hallucination.rate! < 1
                    ? 'good'
                    : metrics?.hallucination.rate! < 3
                      ? 'warning'
                      : 'critical'
                }
              />
              <MetricCard
                title="Alucinaciones Detectadas"
                value={metrics?.hallucination.count || 0}
                icon="🔍"
              />
              <MetricCard
                title="Precisión Factual"
                value={metrics?.hallucination.factualAccuracy?.toFixed(2) || 0}
                unit="%"
                icon="✓"
                status={
                  metrics?.hallucination.factualAccuracy! >= 95
                    ? 'good'
                    : 'warning'
                }
              />
            </div>

            <div className="dashboard__chart-row">
              <div className="dashboard__chart-container dashboard__chart-container--half">
                <BarChartComponent
                  title="Alucinaciones por Día"
                  data={hallucinationHistory}
                  dataKey="count"
                  loading={hallLoading}
                  color="#9b59b6"
                  yAxisLabel="Cantidad"
                />
              </div>
              <div className="dashboard__chart-container dashboard__chart-container--half">
                <PieChartComponent
                  title="Alucinaciones por Tema"
                  data={normalizeByTopic(metrics?.hallucination?.byTopic)}
                  dataKey="count"
                  nameKey="topic"
                  colors={['#e74c3c', '#3498db', '#f39c12', '#27ae60']}
                  loading={false}
                />
              </div>
            </div>
          </section>

          {/* SECTION 4: RESUMEN */}
          <section className="dashboard__section dashboard__section--summary">
            <h2 className="dashboard__section-title">📋 Resumen General</h2>
            <div className="dashboard__summary-grid">
              <div className="dashboard__summary-item">
                <h4>Salud General</h4>
                <div className="dashboard__health-score">
                  {Math.round(
                    (metrics?.performance.uptime || 0) * 0.4 +
                      ((100 - (metrics?.performance.errorRate || 0)) * 0.3) +
                      ((100 - (metrics?.hallucination.rate || 0)) * 0.3)
                  )}%
                </div>
              </div>
              <div className="dashboard__summary-item">
                <h4>Conversaciones Activas</h4>
                <div className="dashboard__health-score">
                  {Math.round((metrics?.conversations.today || 0) / 5)}
                </div>
              </div>
              <div className="dashboard__summary-item">
                <h4>Problemas Detectados</h4>
                <div className="dashboard__health-score">
                  {(metrics?.hallucination.count || 0) + (metrics?.performance.errorRate || 0) > 5 ? '🔴' : '🟢'}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: CONVERSACIONES CAPTURADAS */}
          <section className="dashboard__section">
            <h2 className="dashboard__section-title">💬 Conversaciones Capturadas</h2>
            <ConversationsList />
          </section>
        </main>
      )}
    </div>
  );
};
