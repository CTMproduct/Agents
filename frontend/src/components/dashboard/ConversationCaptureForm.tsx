import React, { useState } from 'react';
import { apiService } from '../../services/api';
import type { CaptureConversationPayload, CaptureConversationResponse } from '../../types';
import '../../styles/ConversationCaptureForm.css';

interface ConversationCaptureFormProps {
  onCaptureSuccess?: () => Promise<void>;
}

export const ConversationCaptureForm: React.FC<ConversationCaptureFormProps> = ({
  onCaptureSuccess
}) => {
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<CaptureConversationResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
          usuario_nombre: usuarioNombre.trim() || undefined,
          usuario_email: usuarioEmail.trim() || undefined,
          usuario_id: usuarioId.trim() || undefined,
          region: 'Nora',
        });

        if (!chatResponse?.respuesta) {
          setError('No se pudo generar respuesta automática con GPT.');
          return;
        }

        respuestaValue = chatResponse.respuesta.trim();
        setRespuesta(respuestaValue);
      }

      const payload: CaptureConversationPayload = {
        asistente_nombre: 'NORA',
        pregunta: preguntaValue,
        respuesta: respuestaValue,
        usuario_nombre: usuarioNombre.trim() || undefined,
        usuario_email: usuarioEmail.trim() || undefined,
        usuario_id: usuarioId.trim() || undefined,
        region: 'Nora',
      };

      const response = await apiService.captureConversation(payload);
      if (!response) {
        setError('No se pudo enviar la conversación. Revisa la conexión al backend.');
      } else {
        setResponseData(response);
        setMessage(response.mensaje || response.message || 'Conversación enviada correctamente.');

        // Limpiar formulario después de envío exitoso
        setPregunta('');
        setRespuesta('');
        setUsuarioNombre('');
        setUsuarioEmail('');
        setUsuarioId('');

        // Refrescar métricas del dashboard si hay callback
        if (onCaptureSuccess) {
          try {
            await onCaptureSuccess();
          } catch (err) {
            console.warn('⚠️ No se pudieron refrescar las métricas:', err);
          }
        }
      }
    } catch (caught) {
      const errorMsg = caught instanceof Error ? caught.message : 'Error desconocido';
      setError(`Error al enviar: ${errorMsg}`);
      console.error('Error capturando conversación:', caught);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="capture-form">
      <div className="capture-form__header">
        <div>
          <h3>Enviar conversación a Nora</h3>
          <p>Envía la conversación en vivo al backend para que el action la capture.</p>
        </div>
        <span className="capture-form__tag">POST /api/capturar-conversacion</span>
      </div>

      <form className="capture-form__form" onSubmit={handleSubmit}>
        <div className="capture-form__grid">
          <label className="capture-form__field">
            <span>Pregunta</span>
            <textarea
              value={pregunta}
              onChange={(event) => setPregunta(event.target.value)}
              rows={3}
              placeholder="Necesito ayuda con mi reserva"
              required
            />
          </label>

          <label className="capture-form__field">
            <span>Respuesta</span>
            <textarea
              value={respuesta}
              onChange={(event) => setRespuesta(event.target.value)}
              rows={3}
              placeholder="Déjalo vacío para generar respuesta automática con GPT."
            />
          </label>

          <label className="capture-form__field">
            <span>Nombre de usuario</span>
            <input
              type="text"
              value={usuarioNombre}
              onChange={(event) => setUsuarioNombre(event.target.value)}
              placeholder="Natalia Gómez"
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

          <label className="capture-form__field">
            <span>ID de usuario</span>
            <input
              type="text"
              value={usuarioId}
              onChange={(event) => setUsuarioId(event.target.value)}
              placeholder="user-123"
            />
          </label>
        </div>

        <div className="capture-form__actions">
          <button type="submit" disabled={loading} className="capture-form__button">
            {loading ? 'Procesando...' : 'Enviar Conversación'}
          </button>
        </div>

        {message && <div className="capture-form__notice capture-form__notice--success">{message}</div>}
        {error && <div className="capture-form__notice capture-form__notice--error">{error}</div>}
        {responseData && (
          <div className="capture-form__response">
            <strong>Respuesta del backend:</strong>
            <pre>{JSON.stringify(responseData, null, 2)}</pre>
          </div>
        )}
      </form>
    </div>
  );
};
