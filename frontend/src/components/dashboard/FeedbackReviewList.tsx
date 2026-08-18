import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import type { ConversationRecord } from '../../types';
import '../../styles/ConversationsList.css';

function formatConversationDate(value?: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-CO');
}

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  hallucination: '⚠️ Alucinación',
  incomplete: '🟡 Incompleta',
  irrelevant: '❌ No entendió',
  needs_human: '🙋 Pidió humano',
  accurate_helpful: '✅ Correcta',
  other: 'Otro',
};

/**
 * Lista los casos que un hotel marcó como posible alucinación o que se
 * escalaron a una persona (ej. HyperGuest), para revisión humana. A
 * diferencia de ConversationsList (todo el historial), esta vista solo
 * muestra lo que necesita atención.
 */
export const FeedbackReviewList: React.FC = () => {
  const [items, setItems] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlagged = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [hallucinated, escalated] = await Promise.all([
        apiService.getConversations(100, { feedback_category: 'hallucination' }),
        apiService.getConversations(100, { escalated: true }),
      ]);

      const merged = new Map<string, ConversationRecord>();
      [...(hallucinated.data || []), ...(escalated.data || [])].forEach((conv) => {
        const key = conv.id || conv._id || JSON.stringify(conv);
        merged.set(key, conv);
      });

      const list = Array.from(merged.values()).sort((a, b) => {
        const timeA = new Date(a.timestamp || a.created_at || 0).getTime();
        const timeB = new Date(b.timestamp || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los casos marcados');
      console.error('Error fetching flagged conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchFlagged();
    }, 0);
    const interval = window.setInterval(() => {
      void fetchFlagged();
    }, 60000);

    return () => {
      window.clearTimeout(timerId);
      window.clearInterval(interval);
    };
  }, [fetchFlagged]);

  return (
    <div className="conversations-list">
      <div className="conversations-list__header">
        <h2>Casos para revisar (alucinaciones y escalamientos)</h2>
        <div className="conversations-list__controls">
          <button
            onClick={() => fetchFlagged()}
            className="conversations-list__button conversations-list__button--refresh"
            disabled={loading}
          >
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="conversations-list__error">
          <p>{error}</p>
          <button onClick={() => fetchFlagged()}>Reintentar</button>
        </div>
      )}

      {loading && (
        <div className="conversations-list__loading">
          <p>Cargando casos...</p>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="conversations-list__empty">
          <p>Sin casos marcados por los hoteles. 🎉</p>
          <small>Las alucinaciones confirmadas y escalamientos aparecerán aquí</small>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="conversations-list__container">
          <p className="conversations-list__count">{items.length} caso(s) marcado(s)</p>

          <div className="conversations-list__table-wrapper">
            <table className="conversations-list__table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Pregunta</th>
                  <th>Respuesta</th>
                  <th>Feedback</th>
                  <th>Escalado a</th>
                </tr>
              </thead>
              <tbody>
                {items.map((conv, idx) => (
                  <tr key={conv.id || conv._id || idx} className="conversations-list__row">
                    <td className="conversations-list__date">
                      {formatConversationDate(conv.timestamp || conv.created_at)}
                    </td>
                    <td className="conversations-list__user">
                      <div className="conversations-list__user-name">{conv.usuario_nombre || 'Anónimo'}</div>
                      <small>{conv.usuario_email || 'Sin email'}</small>
                    </td>
                    <td className="conversations-list__question">
                      <div className="conversations-list__text-preview">{conv.pregunta}</div>
                    </td>
                    <td className="conversations-list__answer">
                      <div className="conversations-list__text-preview">{conv.respuesta}</div>
                    </td>
                    <td>
                      {conv.feedback_category
                        ? FEEDBACK_CATEGORY_LABELS[conv.feedback_category] || conv.feedback_category
                        : '—'}
                      {conv.feedback_comment && (
                        <div>
                          <small style={{ color: '#999' }}>{conv.feedback_comment}</small>
                        </div>
                      )}
                    </td>
                    <td>{conv.escalated_to_human ? conv.escalation_target || 'Sí' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
