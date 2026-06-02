import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import '../../styles/ConversationsList.css';

interface Conversation {
  _id?: string;
  id?: string;
  asistente_nombre: string;
  pregunta: string;
  respuesta: string;
  usuario_nombre?: string;
  usuario_email?: string;
  score_promedio?: number;
  timestamp?: string;
  createdAt?: string;
}

export const ConversationsList: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'score'>('recent');

  const fetchConversations = async () => {
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
  };

  useEffect(() => {
    fetchConversations();
    // Recargar cada 2 minutos
    const interval = setInterval(fetchConversations, 120000);
    return () => clearInterval(interval);
  }, []);

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
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error al descargar archivo');
      console.error('Export error:', err);
    }
  };

  const filteredConversations = conversations
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
        const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
        const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
        return timeB - timeA;
      } else {
        return (b.score_promedio || 0) - (a.score_promedio || 0);
      }
    });

  return (
    <div className="conversations-list">
      <div className="conversations-list__header">
        <h2>💬 Conversaciones Capturadas</h2>
        <div className="conversations-list__controls">
          <input
            type="text"
            placeholder="🔍 Buscar..."
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
            🔄 Actualizar
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="conversations-list__button conversations-list__button--export"
            title="Descargar como CSV para Excel"
          >
            📊 CSV
          </button>

          <button
            onClick={() => handleExport('json')}
            className="conversations-list__button conversations-list__button--export"
            title="Descargar como JSON"
          >
            📋 JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="conversations-list__error">
          <p>⚠️ {error}</p>
          <button onClick={() => fetchConversations()}>Reintentar</button>
        </div>
      )}

      {loading && (
        <div className="conversations-list__loading">
          <p>⏳ Cargando conversaciones...</p>
        </div>
      )}

      {!loading && filteredConversations.length === 0 && (
        <div className="conversations-list__empty">
          <p>😴 No hay conversaciones</p>
          <small>Las conversaciones capturadas aparecerán aquí</small>
        </div>
      )}

      {!loading && filteredConversations.length > 0 && (
        <div className="conversations-list__container">
          <p className="conversations-list__count">
            📌 Mostrando {filteredConversations.length} de {conversations.length} conversaciones
          </p>

          <div className="conversations-list__table-wrapper">
            <table className="conversations-list__table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Pregunta</th>
                  <th>Respuesta</th>
                  <th>Puntuación</th>
                </tr>
              </thead>
              <tbody>
                {filteredConversations.map((conv, idx) => (
                  <tr key={idx} className="conversations-list__row">
                    <td className="conversations-list__date">
                      {new Date(conv.timestamp || conv.createdAt || 0).toLocaleString('es-ES')}
                    </td>
                    <td className="conversations-list__user">
                      <div className="conversations-list__user-name">{conv.usuario_nombre || 'N/A'}</div>
                      <small>{conv.usuario_email || 'Sin email'}</small>
                    </td>
                    <td className="conversations-list__question">
                      <div className="conversations-list__text-preview">{conv.pregunta}</div>
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
                        ⭐ {(conv.score_promedio || 0).toFixed(1)}
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
