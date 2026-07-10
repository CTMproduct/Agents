import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiService } from '../../services/api';
import type { Agent, CaptureConversationPayload, CaptureConversationResponse } from '../../types';
import '../../styles/ConversationCaptureForm.css';

interface ConversationCaptureFormProps {
  onCaptureSuccess?: () => Promise<void>;
}

export const ConversationCaptureForm = ({ onCaptureSuccess }: ConversationCaptureFormProps) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<CaptureConversationResponse | null>(null);

  useEffect(() => {
    let active = true;

    apiService.getAgents().then((data) => {
      if (!active) return;
      setAgents(data);
      if (data[0]?.id) {
        setSelectedAgentId((current) => current || data[0].id);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) || null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setResponseData(null);

    const preguntaValue = pregunta.trim();
    let respuestaValue = respuesta.trim();

    try {
      if (!respuestaValue) {
        const chatResponse = await apiService.chat({
          pregunta: preguntaValue,
          agent_id: selectedAgentId || undefined,
          usuario_nombre: usuarioNombre.trim() || undefined,
          usuario_email: usuarioEmail.trim() || undefined,
          usuario_id: usuarioId.trim() || undefined,
          region: 'Nora',
        });

        if (!chatResponse?.respuesta) {
          setError('No se pudo generar respuesta automatica con GPT.');
          return;
        }

        respuestaValue = chatResponse.respuesta.trim();
        setRespuesta(respuestaValue);
      }

      const payload: CaptureConversationPayload = {
        agent_id: selectedAgentId || undefined,
        asistente_nombre: selectedAgent?.name || 'NORA',
        pregunta: preguntaValue,
        respuesta: respuestaValue,
        usuario_nombre: usuarioNombre.trim() || undefined,
        usuario_email: usuarioEmail.trim() || undefined,
        usuario_id: usuarioId.trim() || undefined,
        region: 'Nora',
      };

      const response = await apiService.captureConversation(payload);
      if (!response) {
        setError('No se pudo enviar la conversacion. Revisa la conexion al backend.');
      } else {
        setResponseData(response);
        setMessage(response.mensaje || response.message || 'Conversacion enviada correctamente.');

        setPregunta('');
        setRespuesta('');
        setUsuarioNombre('');
        setUsuarioEmail('');
        setUsuarioId('');

        if (onCaptureSuccess) {
          await onCaptureSuccess();
        }
      }
    } catch (caught) {
      const errorMsg = caught instanceof Error ? caught.message : 'Error desconocido';
      setError(`Error al enviar: ${errorMsg}`);
      console.error('Error capturando conversacion:', caught);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="capture-form">
      <div className="capture-form__header">
        <div>
          <h3>Enviar conversacion</h3>
          <p>Genera o registra una respuesta usando el agente seleccionado.</p>
        </div>
      </div>

      <form className="capture-form__form" onSubmit={handleSubmit}>
        <div className="capture-form__grid">
          <label className="capture-form__field">
            <span>Agente</span>
            <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
              {agents.length === 0 ? (
                <option value="">NORA</option>
              ) : (
                agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.status})
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="capture-form__field">
            <span>ID de usuario</span>
            <input
              type="text"
              value={usuarioId}
              onChange={(event) => setUsuarioId(event.target.value)}
              placeholder="user-123"
            />
          </label>

          <label className="capture-form__field capture-form__field--wide">
            <span>Pregunta</span>
            <textarea
              value={pregunta}
              onChange={(event) => setPregunta(event.target.value)}
              rows={3}
              placeholder="Necesito ayuda con mi reserva"
              required
            />
          </label>

          <label className="capture-form__field capture-form__field--wide">
            <span>Respuesta</span>
            <textarea
              value={respuesta}
              onChange={(event) => setRespuesta(event.target.value)}
              rows={3}
              placeholder="Dejalo vacio para generar respuesta automatica con GPT."
            />
          </label>

          <label className="capture-form__field">
            <span>Nombre de usuario</span>
            <input
              type="text"
              value={usuarioNombre}
              onChange={(event) => setUsuarioNombre(event.target.value)}
              placeholder="Natalia Gomez"
            />
          </label>

          <label className="capture-form__field">
            <span>Email de usuario</span>
            <input
              type="email"
              value={usuarioEmail}
              onChange={(event) => setUsuarioEmail(event.target.value)}
              placeholder="natagomez@gmail.com"
            />
          </label>
        </div>

        <div className="capture-form__actions">
          <button type="submit" disabled={loading} className="capture-form__button">
            {loading ? 'Procesando...' : 'Enviar conversacion'}
          </button>
        </div>

        {message && <div className="capture-form__notice capture-form__notice--success">{message}</div>}
        {error && <div className="capture-form__notice capture-form__notice--error">{error}</div>}
        {responseData && (
          <div className="capture-form__response">
            <strong>Conversacion registrada</strong>
            <p>
              Agente: {responseData.agent?.name || selectedAgent?.name || 'Nora'}
              {typeof responseData.score_promedio === 'number'
                ? ` · Calidad: ${responseData.score_promedio.toFixed(1)} / 5`
                : ''}
            </p>
          </div>
        )}
      </form>
    </div>
  );
};