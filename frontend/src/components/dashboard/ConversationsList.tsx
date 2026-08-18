import React, { useCallback, useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { ConversationRecord } from '../../types';
import '../../styles/ConversationsList.css';

function formatConversationDate(value?: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString('es-CO');
}

export const ConversationsList: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'score'>('recent');
  // El export (CSV/JSON) requiere la clave de administracion; solo lo
  // ofrecemos si ya hay una sesion de Agentes activa en este navegador.
  const canExport = Boolean(apiService.getAgentAdminKey());

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiService.getConversations(100);

      if (data?.status === 'success') {
        setConversations(data.data || []);
      } else {
        setError('No se pudieron cargar las conversaciones');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conversaciones');
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchConversations();
    }, 0);
    const interval = window.setInterval(() => {
      void fetchConversations();
    }, 120000);

    return () => {
      window.clearTimeout(timerId);
      window.clearInterval(interval);
    };
  }, [fetchConversations]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const blob = await apiService.exportConversations(format);
      if (!blob) {
        throw new Error('Error al descargar');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversaciones.${format === 'csv' ? 'csv' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    } catch (err) {
      setError('Error al descargar archivo');
      console.error('Export error:', err);
    }
  };

  // Safely ensure conversations is an array
  const safeConversations = Array.isArray(conversations) ? conversations : [];

  const filteredConversations = safeConversations
    .filter(c => {
      const searchTerm = filter.toLowerCase();
      return (
        (c.pregunta || '').toLowerCase().includes(searchTerm) ||
        (c.respuesta || '').toLowerCase().includes(searchTerm) ||
        (c.usuario_nombre || '').toLowerCase().includes(searchTerm) ||
        (c.usuario_email || '').toLowerCase().includes(searchTerm)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        const timeA = new Date(a.timestamp || a.created_at || a.createdAt || 0).getTime();
        const timeB = new Date(b.timestamp || b.created_at || b.createdAt || 0).getTime();
        return timeB - timeA;
      } else {
        return (b.score_promedio || 0) - (a.score_promedio || 0);
      }
    });

  return (
    <div className="conversations-list">
      <div className="conversations-list__header">
        <h2>Conversaciones</h2>
        <div className="conversations-list__controls">
          <input
            type="text"
            placeholder="Buscar por pregunta, respuesta o usuario"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="conversations-list__search"
          />
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'score')}
            className="conversations-list__sort"
          >
            <option value="recent">Recientes</option>
            <option value="score">Mayor Puntuación</option>
          </select>

          <button
            onClick={() => fetchConversations()}
            className="conversations-list__button conversations-list__button--refresh"
            disabled={loading}
          >
            Actualizar
          </button>

          {canExport ? (
            <>
              <button
                onClick={() => handleExport('csv')}
                className="conversations-list__button conversations-list__button--export"
                title="Descargar como CSV para Excel"
              >
                Descargar CSV
              </button>

              <button
                onClick={() => handleExport('json')}
                className="conversations-list__button conversations-list__button--export"
                title="Descargar como JSON"
              >
                Descargar JSON
              </button>
            </>
          ) : (
            <span className="conversations-list__export-hint" title="Inicia sesion en la pestaña Agentes para exportar">
              Exportar requiere clave de administracion
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="conversations-list__error">
          <p>{error}</p>
          <button onClick={() => fetchConversations()}>Reintentar</button>
        </div>
      )}

      {loading && (
        <div className="conversations-list__loading">
          <p>Cargando conversaciones...</p>
        </div>
      )}

      {!loading && filteredConversations.length === 0 && (
        <div className="conversations-list__empty">
          <p>No hay conversaciones</p>
          <small>Las conversaciones capturadas aparecerán aquí</small>
        </div>
      )}

      {!loading && filteredConversations.length > 0 && (
        <div className="conversations-list__container">
          <p className="conversations-list__count">
            Mostrando {filteredConversations.length} de {conversations.length} conversaciones
          </p>

          <div className="conversations-list__table-wrapper">
            <table className="conversations-list__table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Categoría</th>
                  <th>País</th>
                  <th>Pregunta</th>
                  <th>Respuesta</th>
                  <th>Puntuación</th>
                </tr>
              </thead>
              <tbody>
                {filteredConversations.map((conv, idx) => (
                  <tr key={conv.id || conv._id || `${conv.timestamp || 'conversation'}-${idx}`} className="conversations-list__row">
                    <td className="conversations-list__date">
                      {formatConversationDate(conv.timestamp || conv.created_at || conv.createdAt)}
                    </td>
                    <td className="conversations-list__user">
                      <div className="conversations-list__user-name">{conv.usuario_nombre || 'Anónimo'}</div>
                      <small>{conv.usuario_email || 'Sin email'}</small>
                    </td>
                    <td className="conversations-list__categoria">
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: conv.categoria === 'Hotel' ? '#e8f4f8' :
                                        conv.categoria === 'Agencia de viajes' ? '#f0e8f8' : '#f8f8f8',
                        color: conv.categoria === 'Hotel' ? '#0066cc' :
                               conv.categoria === 'Agencia de viajes' ? '#6600cc' : '#666'
                      }}>
                        {conv.categoria || 'No especificado'}
                      </span>
                    </td>
                    <td className="conversations-list__pais">
                      <small>{conv.origen_pais || 'No especificado'}</small>
                    </td>
                    <td className="conversations-list__question">
                      <div className="conversations-list__text-preview">{conv.pregunta}</div>
                      {conv.pregunta_base && (
                        <small style={{ color: '#999', marginTop: '4px', display: 'block' }}>
                          Base: {conv.pregunta_base}
                        </small>
                      )}
                    </td>
                    <td className="conversations-list__answer">
                      <div className="conversations-list__text-preview">{conv.respuesta}</div>
                    </td>
                    <td className="conversations-list__score">
                      <div className={`conversations-list__score-badge conversations-list__score-badge--${
                        (conv.score_promedio || 0) >= 4 ? 'high' :
                        (conv.score_promedio || 0) >= 3 ? 'medium' :
                        'low'
                      }`}>
                        {(conv.score_promedio || 0).toFixed(1)}
                      </div>
                    </td>
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
