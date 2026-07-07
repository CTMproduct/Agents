import { useEffect, useState } from 'react';
import { api } from './api';

const fmt = (d: string) => new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []): [T | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const reload = () => { fn().then(setData).catch(() => setData(null)); };
  useEffect(reload, deps);
  return [data, reload];
}

// ---------- Dashboard ----------
export function Dashboard() {
  const [agents] = useLoad(() => api<any[]>('/marketplace/my-agents'));
  const [queue] = useLoad(() => api<any[]>('/review/queue?status=PENDING'));
  const [proposals] = useLoad(() => api<any[]>('/learning/proposals'));
  const [workflows] = useLoad(() => api<any[]>('/automations/workflows'));
  const pendingProposals = (proposals ?? []).filter((p) => p.status === 'PENDING');
  const activeWf = (workflows ?? []).filter((w) => w.status === 'ACTIVE');
  const todo: string[] = [];
  if ((queue ?? []).length) todo.push(`${queue!.length} respuesta(s) esperando tu aprobación en Human Review`);
  if (pendingProposals.length) todo.push(`${pendingProposals.length} propuesta(s) de aprendizaje lista(s) para revisar`);
  if (!(agents ?? []).length) todo.push('Instala tu primer agente desde el Marketplace');
  return (
    <div>
      <h1>Dashboard</h1>
      <p className="sub">Tu operación de agentes en un vistazo.</p>
      <div className="grid">
        <div className="card metric"><div className="n">{agents?.filter((a) => a.active).length ?? '—'}</div><div className="l">Agentes activos</div></div>
        <div className="card metric"><div className="n">{queue?.length ?? '—'}</div><div className="l">Respuestas pendientes</div></div>
        <div className="card metric"><div className="n">{activeWf.length}</div><div className="l">Automatizaciones activas</div></div>
        <div className="card metric"><div className="n">{pendingProposals.length}</div><div className="l">Mejoras propuestas</div></div>
      </div>
      <h1 style={{ marginTop: 28, fontSize: 16 }}>Qué hacer ahora</h1>
      {todo.length ? todo.map((t, i) => <div key={i} className="list-item">👉 {t}</div>)
        : <div className="list-item">✅ Todo al día. Revisa las métricas para decidir el siguiente paso.</div>}
    </div>
  );
}

// ---------- Marketplace ----------
export function Marketplace() {
  const [templates, reload] = useLoad(() => api<any[]>('/marketplace/templates'));
  const install = async (key: string) => {
    try { await api(`/marketplace/templates/${key}/activate`, { method: 'POST' }); alert('Agente instalado. Configúralo en "Mis Agentes".'); reload(); }
    catch (e) { alert((e as Error).message); }
  };
  return (
    <div>
      <h1>Marketplace</h1>
      <p className="sub">Instala agentes con calificaciones reales de otras empresas.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {(templates ?? []).map((t) => (
          <div key={t.key} className="card">
            <div style={{ fontSize: 34 }}>{t.avatarEmoji}</div>
            <h3 style={{ margin: '8px 0 4px' }}>{t.name}</h3>
            <div style={{ color: '#b58900', fontSize: 13, marginBottom: 8 }}>
              {'★'.repeat(Math.round(t.ratingAvg || 0))}{'☆'.repeat(5 - Math.round(t.ratingAvg || 0))}
              <span style={{ color: 'var(--muted)' }}> ({t.ratingCount})</span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>{t.tagline}</p>
            <ul style={{ paddingLeft: 18, color: 'var(--muted)', fontSize: 12 }}>{t.features.map((f: string) => <li key={f}>{f}</li>)}</ul>
            <div className="row"><span className="badge">Autonomía L0</span><span className="badge ok">Revisión humana incluida</span></div>
            <button className="btn accent" style={{ width: '100%', marginTop: 12 }} onClick={() => install(t.key)}>Instalar agente</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Mis Agentes (Agent Studio con tabs) ----------
export function Agents() {
  const [agents, reload] = useLoad(() => api<any[]>('/marketplace/my-agents'));
  const [models] = useLoad(() => api<any[]>('/marketplace/models'));
  const [tools] = useLoad(() => api<any[]>('/marketplace/tools'));
  const [sel, setSel] = useState<string | null>(null);
  const agent = (agents ?? []).find((a) => a.id === sel);
  if (!agent) {
    return (
      <div>
        <h1>Mis Agentes</h1>
        <p className="sub">Selecciona un agente para abrir su Studio.</p>
        {(agents ?? []).length ? (agents ?? []).map((a) => (
          <div key={a.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
            <div><b>{a.name}</b> <span className="badge">{a.modelName ?? 'modelo por defecto'}</span>
              <span className={`badge ${a.active ? 'ok' : ''}`}>{a.active ? 'Activo' : 'Inactivo'}</span></div>
            <button className="btn sm" onClick={() => setSel(a.id)}>Abrir Studio</button>
          </div>
        )) : <div className="empty">Instala un agente desde el Marketplace.</div>}
      </div>
    );
  }
  return <Studio agent={agent} models={models ?? []} tools={tools ?? []} back={() => { setSel(null); reload(); }} />;
}

function Studio({ agent, models, tools, back }: { agent: any; models: any[]; tools: any[]; back: () => void }) {
  const TABS = ['Identidad', 'Instrucciones', 'Modelo', 'Tools', 'Knowledge', 'Testing'] as const;
  const [tab, setTab] = useState<(typeof TABS)[number]>('Identidad');
  const [form, setForm] = useState({ name: agent.name, skillMd: agent.skillMd, modelName: agent.modelName ?? '', toolKeys: agent.toolKeys as string[] });
  const [wizard, setWizard] = useState({ queHace: '', tono: '', puedePrometer: '', noPuedePrometer: '', cuandoEscalar: '', reglas: '' });
  const [testMsg, setTestMsg] = useState('');
  const [testOut, setTestOut] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    try { await api(`/marketplace/my-agents/${agent.id}`, { method: 'PATCH', body: JSON.stringify(patch) }); alert('Guardado.'); }
    catch (e) { alert((e as Error).message); }
  };
  const generate = async () => {
    setBusy(true);
    try {
      const r = await api<{ skillMd: string }>('/marketplace/generate-skill', { method: 'POST', body: JSON.stringify({ answers: wizard }) });
      setForm({ ...form, skillMd: r.skillMd }); alert('Instrucciones generadas: revísalas y guarda.');
    } catch (e) { alert((e as Error).message); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setTestOut('Ejecutando…');
    try { const r = await api<{ text: string }>(`/marketplace/my-agents/${agent.id}/run`, { method: 'POST', body: JSON.stringify({ conversationText: testMsg }) }); setTestOut(r.text); }
    catch (e) { setTestOut('Error: ' + (e as Error).message); }
    setBusy(false);
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Agent Studio — {agent.name}</h1>
        <button className="btn ghost sm" onClick={back}>← Volver</button>
      </div>
      <div className="tabs">{TABS.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>

      {tab === 'Identidad' && (<div className="card" style={{ maxWidth: 560 }}>
        <label>Nombre del agente</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <button className="btn" style={{ marginTop: 14 }} onClick={() => save({ name: form.name })}>Guardar</button>
      </div>)}

      {tab === 'Instrucciones' && (<div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="card">
          <b>Asistente guiado</b>
          <p className="sub" style={{ marginBottom: 0 }}>Responde y la plataforma escribe el prompt por ti.</p>
          <label>¿Qué hace este agente?</label><input value={wizard.queHace} onChange={(e) => setWizard({ ...wizard, queHace: e.target.value })} />
          <label>¿Qué tono debe usar?</label><input value={wizard.tono} onChange={(e) => setWizard({ ...wizard, tono: e.target.value })} />
          <label>¿Qué puede prometer?</label><input value={wizard.puedePrometer} onChange={(e) => setWizard({ ...wizard, puedePrometer: e.target.value })} />
          <label>¿Qué NO puede prometer?</label><input value={wizard.noPuedePrometer} onChange={(e) => setWizard({ ...wizard, noPuedePrometer: e.target.value })} />
          <label>¿Cuándo escalar a humano?</label><input value={wizard.cuandoEscalar} onChange={(e) => setWizard({ ...wizard, cuandoEscalar: e.target.value })} />
          <label>Reglas de tu empresa</label><input value={wizard.reglas} onChange={(e) => setWizard({ ...wizard, reglas: e.target.value })} />
          <button className="btn accent" style={{ marginTop: 14 }} disabled={busy} onClick={generate}>Generar instrucciones profesionales</button>
        </div>
        <div className="card">
          <b>Instrucciones (avanzado)</b>
          <textarea style={{ minHeight: 320, marginTop: 10 }} value={form.skillMd} onChange={(e) => setForm({ ...form, skillMd: e.target.value })} />
          <button className="btn" style={{ marginTop: 10 }} onClick={() => save({ skillMd: form.skillMd })}>Guardar (versiona la anterior)</button>
        </div>
      </div>)}

      {tab === 'Modelo' && (<div className="card" style={{ maxWidth: 560 }}>
        <label>Modelo LLM conectado</label>
        <select value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })}>
          <option value="">Modelo por defecto de la plataforma</option>
          {models.map((m) => <option key={m.model} value={m.model}>{m.label} ({m.priceLabel})</option>)}
        </select>
        <button className="btn" style={{ marginTop: 14 }} onClick={() => save({ modelName: form.modelName || null })}>Guardar</button>
      </div>)}

      {tab === 'Tools' && (<div className="card" style={{ maxWidth: 560 }}>
        {tools.map((t) => (
          <label key={t.key} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--ink)' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.toolKeys.includes(t.key)}
              onChange={(e) => setForm({ ...form, toolKeys: e.target.checked ? [...form.toolKeys, t.key] : form.toolKeys.filter((k) => k !== t.key) })} />
            <span><b>{t.name}</b> <span className="badge ok">riesgo bajo</span><br /><span style={{ color: 'var(--muted)', fontSize: 12 }}>{t.description}</span></span>
          </label>
        ))}
        <button className="btn" style={{ marginTop: 14 }} onClick={() => save({ toolKeys: form.toolKeys })}>Guardar</button>
      </div>)}

      {tab === 'Knowledge' && (<Knowledge agentId={agent.id} initial={agent.knowledge ?? []} />)}

      {tab === 'Testing' && (<div className="card" style={{ maxWidth: 640 }}>
        <label>Mensaje de prueba</label>
        <textarea style={{ minHeight: 70 }} value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="Ej. Hola, quiero información de sus servicios" />
        <button className="btn accent" style={{ marginTop: 10 }} disabled={busy || !testMsg.trim()} onClick={test}>Probar agente</button>
        {testOut && <div className="msg out" style={{ marginTop: 12 }}>{testOut}</div>}
      </div>)}
    </div>
  );
}

function Knowledge({ agentId, initial }: { agentId: string; initial: any[] }) {
  const [docs, setDocs] = useState<any[]>(initial);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const add = async () => {
    try {
      const d = await api(`/marketplace/my-agents/${agentId}/knowledge`, { method: 'POST', body: JSON.stringify({ title, content }) });
      setDocs([...docs, d]); setTitle(''); setContent('');
    } catch (e) { alert((e as Error).message); }
  };
  const del = async (id: string) => {
    await api(`/marketplace/my-agents/${agentId}/knowledge/${id}`, { method: 'DELETE' });
    setDocs(docs.filter((d) => d.id !== id));
  };
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
      <div className="card">
        <b>Agregar documento</b>
        <label>Título</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Catálogo de precios 2026" />
        <label>Contenido</label><textarea value={content} onChange={(e) => setContent(e.target.value)} />
        <button className="btn accent" style={{ marginTop: 10 }} disabled={!title || !content} onClick={add}>Agregar</button>
      </div>
      <div>
        {docs.length ? docs.map((d) => (
          <div key={d.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
            <b>{d.title}</b>
            <button className="btn danger sm" onClick={() => del(d.id)}>Eliminar</button>
          </div>
        )) : <div className="empty">Sin documentos. El agente los consultará automáticamente al responder.</div>}
      </div>
    </div>
  );
}

// ---------- Human Review ----------
export function Review() {
  const [status, setStatus] = useState('PENDING');
  const [rows, reload] = useLoad(() => api<any[]>(`/review/queue?status=${status}`), [status]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const act = async (id: string, action: string, body: Record<string, unknown> = {}) => {
    try { await api(`/review/${id}/${action}`, { method: 'POST', body: JSON.stringify(body) }); reload(); }
    catch (e) { alert((e as Error).message); }
  };
  return (
    <div>
      <h1>Human Review</h1>
      <p className="sub">Nada llega a un cliente sin tu decisión. Aprobar reanuda la automatización pausada.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        {['PENDING', 'APPROVED', 'EDITED', 'REJECTED'].map((s) => (
          <button key={s} className={`btn sm ${status === s ? '' : 'ghost'}`} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {(rows ?? []).length ? rows!.map((r) => (
        <div key={r.id} className="list-item">
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="badge">{r.channel ?? '—'}</span>
            <span className={`badge ${r.status === 'PENDING' ? 'warn' : 'ok'}`}>{r.status}</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{fmt(r.createdAt)}</span>
          </div>
          <div className="msg in">{r.inputSummary}</div>
          {r.status === 'PENDING' ? (<>
            <textarea value={edits[r.id] ?? r.suggestedOutput} onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn accent sm" onClick={() => act(r.id, 'approve')}>Aprobar</button>
              <button className="btn sm" onClick={() => act(r.id, 'edit-and-approve', { finalOutput: edits[r.id] ?? r.suggestedOutput })}>Aprobar con edición</button>
              <button className="btn danger sm" onClick={() => act(r.id, 'reject', { reason: prompt('Motivo (queda como aprendizaje):') ?? undefined })}>Rechazar</button>
              <button className="btn ghost sm" onClick={() => act(r.id, 'escalate')}>Escalar</button>
            </div>
          </>) : <div className="msg out">{r.finalOutput ?? r.suggestedOutput}</div>}
        </div>
      )) : <div className="empty">Nada en esta bandeja.</div>}
    </div>
  );
}

// ---------- Learning ----------
export function Learning() {
  const [agents] = useLoad(() => api<any[]>('/marketplace/my-agents'));
  const [proposals, reload] = useLoad(() => api<any[]>('/learning/proposals'));
  const [agentId, setAgentId] = useState('');
  const run = async () => {
    const id = agentId || agents?.[0]?.id;
    if (!id) return alert('Instala un agente primero.');
    try {
      const r = await api<any>(`/learning/agents/${id}/run`, { method: 'POST', body: '{}' });
      alert(`${r.message}\n(editadas: ${r.analyzed.edited}, rechazadas: ${r.analyzed.rejected})`); reload();
    } catch (e) { alert((e as Error).message); }
  };
  const decide = async (id: string, action: string) => { await api(`/learning/proposals/${id}/${action}`, { method: 'POST', body: '{}' }); reload(); };
  return (
    <div>
      <h1>Learning Loops</h1>
      <p className="sub">El agente propone mejoras a partir de tus decisiones. Nada cambia sin tu aprobación.</p>
      <div className="row" style={{ marginBottom: 16 }}>
        <select style={{ maxWidth: 280 }} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button className="btn accent" onClick={run}>Analizar y proponer mejora</button>
      </div>
      {(proposals ?? []).length ? proposals!.map((p) => (
        <div key={p.id} className="list-item">
          <div className="row"><span className={`badge ${p.status === 'PENDING' ? 'warn' : 'ok'}`}>{p.status}</span>
            <b>{p.title}</b></div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>{p.reason}</p>
          <div className="msg out" style={{ fontFamily: 'Consolas,monospace', fontSize: 12 }}>{p.proposedValue}</div>
          {p.status === 'PENDING' && (<div className="row" style={{ marginTop: 8 }}>
            <button className="btn accent sm" onClick={() => decide(p.id, 'approve')}>Aprobar (se aplica como skill)</button>
            <button className="btn danger sm" onClick={() => decide(p.id, 'reject')}>Rechazar</button>
          </div>)}
        </div>
      )) : <div className="empty">Sin propuestas todavía. Corre el análisis después de revisar respuestas.</div>}
    </div>
  );
}

// ---------- Métricas ----------
export function Metrics() {
  const [data] = useLoad(() => api<{ agents: any[] }>('/metrics/decision'));
  return (
    <div>
      <h1>Decision Intelligence</h1>
      <p className="sub">¿Este agente sirve? ¿Lo aprueban? ¿Está listo para más autonomía?</p>
      {(data?.agents ?? []).length ? data!.agents.map((a) => (
        <div key={a.agentId} className="list-item">
          <div className="row" style={{ marginBottom: 10 }}>
            <b>{a.agentName}</b>
            <span className="badge">{a.modelName ?? 'modelo por defecto'}</span>
            {a.autonomyReadiness != null
              ? <span className="badge ok">Autonomy Readiness: {a.autonomyReadiness}/100</span>
              : <span className="badge">sin datos suficientes</span>}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' }}>
            <div className="card metric"><div className="n">{a.reviewed}</div><div className="l">Revisadas</div></div>
            <div className="card metric"><div className="n">{a.approvalRatePct != null ? a.approvalRatePct + '%' : '—'}</div><div className="l">Aprobación</div></div>
            <div className="card metric"><div className="n">{a.editRatePct != null ? a.editRatePct + '%' : '—'}</div><div className="l">Edición</div></div>
            <div className="card metric"><div className="n">{a.runs}</div><div className="l">Corridas</div></div>
            <div className="card metric"><div className="n">${a.costUsd}</div><div className="l">Costo IA</div></div>
            <div className="card metric"><div className="n">{a.avgLatencyMs != null ? (a.avgLatencyMs / 1000).toFixed(1) + 's' : '—'}</div><div className="l">Latencia</div></div>
          </div>
          <div className="msg out" style={{ marginTop: 10 }}>💡 {a.recommendation}</div>
        </div>
      )) : <div className="empty">Instala un agente para ver métricas.</div>}
    </div>
  );
}
