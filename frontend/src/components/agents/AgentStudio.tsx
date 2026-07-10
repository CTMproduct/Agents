import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/api';
import type { Agent, AgentPayload, ChatResponse } from '../../types';
import '../../styles/AgentStudio.css';

type AgentDraft = Required<Pick<AgentPayload, 'name' | 'slug' | 'description' | 'status' | 'default_language' | 'avatar' | 'system_prompt' | 'model'>> & {
  id?: string;
  temperature: number;
  max_tokens: number;
};

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  paused: 'Pausado',
};

function getStatusLabel(status: string) {
  return statusLabels[status] || status;
}

const emptyDraft: AgentDraft = {
  name: '',
  slug: '',
  description: '',
  status: 'draft',
  default_language: 'es',
  avatar: 'bot',
  system_prompt: 'Eres un asistente especializado. Responde en espanol de forma clara, breve y accionable.',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  max_tokens: 350,
};

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function agentToDraft(agent: Agent): AgentDraft {
  return {
    id: agent.id,
    name: agent.name || '',
    slug: agent.slug || slugify(agent.name || ''),
    description: agent.description || '',
    status: agent.status || 'draft',
    default_language: agent.default_language || 'es',
    avatar: agent.avatar || 'bot',
    system_prompt: agent.active_version?.system_prompt || emptyDraft.system_prompt,
    model: agent.active_version?.model || emptyDraft.model,
    temperature: Number(agent.active_version?.temperature ?? emptyDraft.temperature),
    max_tokens: Number(agent.active_version?.max_tokens ?? emptyDraft.max_tokens),
  };
}

export function AgentStudio() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgentDraft>(emptyDraft);
  const [testQuestion, setTestQuestion] = useState('Necesito recomendaciones para una reserva de hotel corporativa.');
  const [testResponse, setTestResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId) || null,
    [agents, selectedId],
  );

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await apiService.getAgents();
    setAgents(data);
    if (data.length > 0) {
      setSelectedId((current) => current || data[0].id);
      setDraft((current) => (current.id ? current : agentToDraft(data[0])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadAgents();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadAgents]);

  const updateDraft = <Key extends keyof AgentDraft>(key: Key, value: AgentDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSelect = (agent: Agent) => {
    setSelectedId(agent.id);
    setDraft(agentToDraft(agent));
    setTestResponse(null);
    setNotice(null);
    setError(null);
  };

  const handleNewAgent = () => {
    setSelectedId(null);
    setDraft(emptyDraft);
    setTestResponse(null);
    setNotice(null);
    setError(null);
  };

  const handleNameChange = (value: string) => {
    setDraft((current) => ({
      ...current,
      name: value,
      slug: current.id ? current.slug : slugify(value),
    }));
  };

  const handleSave = async () => {
    const cleanName = draft.name.trim();
    if (!cleanName) {
      setError('El nombre del agente es requerido.');
      return;
    }

    setSaving(true);
    setNotice(null);
    setError(null);

    const payload: AgentPayload = {
      id: draft.id,
      name: cleanName,
      slug: draft.slug || slugify(cleanName),
      description: draft.description.trim(),
      status: draft.status,
      default_language: draft.default_language,
      avatar: draft.avatar,
      system_prompt: draft.system_prompt.trim(),
      model: draft.model.trim(),
      temperature: Number(draft.temperature),
      max_tokens: Number(draft.max_tokens),
    };

    const saved = draft.id
      ? await apiService.updateAgent(draft.id, payload)
      : await apiService.createAgent(payload);

    setSaving(false);

    if (!saved) {
      setError('No se pudo guardar el agente. Revisa el backend.');
      return;
    }

    setAgents((current) => [saved, ...current.filter((agent) => agent.id !== saved.id)]);
    setSelectedId(saved.id);
    setDraft(agentToDraft(saved));
    setNotice('Agente guardado correctamente.');
  };

  const handleTest = async () => {
    if (!draft.id) {
      setError('Guarda el agente antes de probarlo.');
      return;
    }

    const question = testQuestion.trim();
    if (!question) {
      setError('Escribe una pregunta de prueba.');
      return;
    }

    setTesting(true);
    setNotice(null);
    setError(null);
    setTestResponse(null);

    const response = await apiService.testAgent(draft.id, question);
    setTesting(false);

    if (!response?.respuesta) {
      setError('No se pudo obtener una respuesta de prueba.');
      return;
    }

    setTestResponse(response);
  };

  return (
    <main className="agent-studio">
      <section className="agent-studio__header">
        <div>
          <p className="agent-studio__eyebrow">Configuracion</p>
          <h1>Estudio de Agentes</h1>
        </div>
        <button type="button" className="agent-studio__primary" onClick={handleNewAgent}>
          Nuevo agente
        </button>
      </section>

      <section className="agent-studio__layout">
        <aside className="agent-studio__sidebar" aria-label="Agentes disponibles">
          <div className="agent-studio__sidebar-head">
            <strong>Agentes</strong>
            <span>{agents.length}</span>
          </div>

          {loading ? (
            <p className="agent-studio__muted">Cargando agentes...</p>
          ) : agents.length === 0 ? (
            <p className="agent-studio__muted">No hay agentes guardados.</p>
          ) : (
            <div className="agent-studio__agent-list">
              {agents.map((agent) => (
                <button
                  type="button"
                  key={agent.id}
                  className={agent.id === selectedId ? 'agent-studio__agent agent-studio__agent--active' : 'agent-studio__agent'}
                  onClick={() => handleSelect(agent)}
                >
                  <span className="agent-studio__agent-name">{agent.name}</span>
                  <span className="agent-studio__agent-meta">
                    {getStatusLabel(agent.status)} · v{agent.active_version?.version || 1} · {agent.active_version?.model || 'modelo'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="agent-studio__workspace">
          <section className="agent-studio__editor">
            <div className="agent-studio__section-head">
              <div>
                <h2>{draft.id ? 'Editar agente' : 'Crear agente'}</h2>
                <p>{selectedAgent ? `Version activa ${selectedAgent.active_version?.version || 1}` : 'Nuevo borrador'}</p>
              </div>
              <span className={`agent-studio__status agent-studio__status--${draft.status}`}>{getStatusLabel(draft.status)}</span>
            </div>

            <fieldset className="agent-studio__form-grid">
              <label className="agent-studio__field">
                <span>Nombre</span>
                <input value={draft.name} onChange={(event) => handleNameChange(event.target.value)} placeholder="Nora Hoteles" />
              </label>

              <label className="agent-studio__field">
                <span>Identificador interno</span>
                <input value={draft.slug} onChange={(event) => updateDraft('slug', slugify(event.target.value))} placeholder="nora-hoteles" />
              </label>

              <label className="agent-studio__field agent-studio__field--wide">
                <span>Descripcion</span>
                <input value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} placeholder="Agente para reservas y soporte hotelero" />
              </label>

              <label className="agent-studio__field">
                <span>Estado</span>
                <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="paused">Pausado</option>
                </select>
              </label>

              <label className="agent-studio__field">
                <span>Modelo</span>
                <select value={draft.model} onChange={(event) => updateDraft('model', event.target.value)}>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  <option value="gpt-4.1">gpt-4.1</option>
                </select>
              </label>

              <label className="agent-studio__field">
                <span>Creatividad: {draft.temperature.toFixed(1)}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={draft.temperature}
                  onChange={(event) => updateDraft('temperature', Number(event.target.value))}
                />
              </label>

              <label className="agent-studio__field">
                <span>Longitud maxima</span>
                <input
                  type="number"
                  min="80"
                  max="2000"
                  value={draft.max_tokens}
                  onChange={(event) => updateDraft('max_tokens', Number(event.target.value))}
                />
              </label>

              <label className="agent-studio__field agent-studio__field--wide">
                <span>Instrucciones del agente</span>
                <textarea
                  value={draft.system_prompt}
                  onChange={(event) => updateDraft('system_prompt', event.target.value)}
                  rows={9}
                />
              </label>
            </fieldset>

            <div className="agent-studio__actions">
              <button type="button" className="agent-studio__secondary" onClick={loadAgents} disabled={loading || saving}>
                Recargar
              </button>
              <button type="button" className="agent-studio__primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar agente'}
              </button>
            </div>
          </section>

          <section className="agent-studio__test">
            <div className="agent-studio__section-head">
              <div>
                <h2>Prueba rapida</h2>
                <p>{draft.name || 'Agente sin nombre'}</p>
              </div>
            </div>

            <label className="agent-studio__field">
              <span>Pregunta</span>
              <textarea value={testQuestion} onChange={(event) => setTestQuestion(event.target.value)} rows={4} />
            </label>

            <div className="agent-studio__actions">
              <button type="button" className="agent-studio__primary" onClick={handleTest} disabled={testing}>
                {testing ? 'Probando...' : 'Probar agente'}
              </button>
            </div>

            {notice && <div className="agent-studio__notice agent-studio__notice--success">{notice}</div>}
            {error && <div className="agent-studio__notice agent-studio__notice--error">{error}</div>}

            {testResponse && (
              <div className="agent-studio__response">
                <strong>Respuesta</strong>
                <p>{testResponse.respuesta}</p>
                <small>{testResponse.modelo || testResponse.agent?.active_version?.model}</small>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}