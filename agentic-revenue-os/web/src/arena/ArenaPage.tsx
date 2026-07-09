import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../api';
import {
  ArenaBattle, BattleParticipant, AgentProfile,
  startArenaBattle, listArenaBattles, getLeaderboard, resolveArenaBattle,
} from './arena.api';

const AgentAvatar3D = lazy(() => import('./AgentAvatar3D'));

const money = (v: string | number) => `$${Number(v || 0).toFixed(6)}`;

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre style={{ maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', borderRadius: 10, background: '#0b1220', color: '#d7e3d2', padding: 12, fontSize: 12 }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ParticipantCard({ battle, participant, onPick, resolving }: {
  battle: ArenaBattle; participant: BattleParticipant; onPick: (id: string) => void; resolving: boolean;
}) {
  const isWinner = battle.winnerParticipantId === participant.id;
  const isResolved = battle.status === 'RESOLVED';
  const hasFailed = Boolean(participant.errorMessage);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={<div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: '#0b1220', color: '#fff' }}>Cargando avatar…</div>}>
        <AgentAvatar3D avatarUrl={participant.profile.avatarUrl} level={participant.profile.level} elo={participant.profile.elo} isWinner={isWinner} />
      </Suspense>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>{participant.aliasSnapshot}</h3>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{participant.modelSnapshot}</span>
        </div>
        {isWinner && <span className="badge ok">Ganador 🏆</span>}
      </div>
      <div style={{ marginTop: 12 }}>
        {hasFailed
          ? <div className="msg" style={{ background: '#fde8e6', border: '1px solid #f5c2c0', color: '#b42318' }}>{participant.errorMessage}</div>
          : <JsonPreview value={participant.outputData} />}
      </div>
      <div className="row" style={{ gap: 14, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
        <span>⏱️ {participant.latencyMs}ms</span>
        <span>💸 {money(participant.tokenCost)}</span>
        <span>In: {participant.inputTokens}</span>
        <span>Out: {participant.outputTokens}</span>
      </div>
      <button className="btn accent" style={{ marginTop: 14 }}
        disabled={isResolved || hasFailed || resolving}
        onClick={() => onPick(participant.id)}>
        {isResolved ? 'Batalla cerrada' : hasFailed ? 'Agente falló' : 'Declarar ganador 🏆'}
      </button>
    </div>
  );
}

export function Arena() {
  const [agents, setAgents] = useState<any[]>([]);
  const [battles, setBattles] = useState<ArenaBattle[]>([]);
  const [board, setBoard] = useState<AgentProfile[]>([]);
  const [form, setForm] = useState({ agentAId: '', agentBId: '', context: '' });
  const [active, setActive] = useState<ArenaBattle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setBattles(await listArenaBattles().catch(() => []));
    setBoard(await getLeaderboard().catch(() => []));
  };
  useEffect(() => {
    api<any[]>('/marketplace/my-agents').then(setAgents).catch(() => setAgents([]));
    reload();
  }, []);

  const start = async () => {
    setError(null); setBusy(true);
    try {
      const battle = await startArenaBattle(form.agentAId, form.agentBId, form.context.trim());
      setActive(battle);
      await reload();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const pickWinner = async (participantId: string) => {
    if (!active) return;
    setBusy(true);
    try {
      const updated = await resolveArenaBattle(active.id, participantId);
      setActive(updated);
      await reload();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  return (
    <div>
      <h1>⚔️ Agentic Arena</h1>
      <p className="sub">Enfrenta dos agentes con la misma tarea, compara sus propuestas lado a lado y declara al ganador. El ranking ELO, XP y nivel se actualizan solos.</p>

      {!active && (
        <div className="card" style={{ maxWidth: 720, marginBottom: 18 }}>
          <div className="row" style={{ gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label>Agente A</label>
              <select value={form.agentAId} onChange={(e) => setForm({ ...form, agentAId: e.target.value })}>
                <option value="">Elige…</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Agente B</label>
              <select value={form.agentBId} onChange={(e) => setForm({ ...form, agentBId: e.target.value })}>
                <option value="">Elige…</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <label>Tarea / contexto para ambos agentes</label>
          <textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })}
            placeholder="Ej. Cliente quiere 4 noches en San Andrés para 2 adultos, todo incluido, en septiembre." />
          {error && <div className="err-text">{error}</div>}
          <button className="btn accent" style={{ marginTop: 12 }}
            disabled={busy || !form.agentAId || !form.agentBId || form.context.trim().length < 10 || form.agentAId === form.agentBId}
            onClick={start}>
            {busy ? 'Ejecutando batalla…' : 'Iniciar batalla ⚔️'}
          </button>
        </div>
      )}

      {active && (
        <div style={{ marginBottom: 22 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h1 style={{ fontSize: 16 }}>Batalla — <span className="badge">{active.status}</span></h1>
            <button className="btn ghost sm" onClick={() => setActive(null)}>← Volver</button>
          </div>
          {error && <div className="err-text">{error}</div>}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
            {active.participants.map((p) => (
              <ParticipantCard key={p.id} battle={active} participant={p} onPick={pickWinner} resolving={busy} />
            ))}
          </div>
        </div>
      )}

      <h1 style={{ fontSize: 16, marginTop: 8 }}>🏆 Ranking</h1>
      {board.length ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
              <th style={{ padding: 6 }}>#</th><th>Agente</th><th>ELO</th><th>Nivel</th><th>XP</th><th>V/D</th>
            </tr></thead>
            <tbody>
              {board.map((p, i) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 6 }}>{i + 1}</td>
                  <td><b>{p.alias}</b></td>
                  <td>{p.elo}</td>
                  <td>Lvl {p.level}</td>
                  <td>{p.xp}</td>
                  <td>{p.wins}/{p.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">Sin batallas resueltas todavía.</div>}

      <h1 style={{ fontSize: 16 }}>Historial</h1>
      {battles.length ? battles.map((b) => (
        <div key={b.id} className="list-item row" style={{ justifyContent: 'space-between' }}>
          <div>
            <b>{b.participants.map((p) => p.aliasSnapshot).join(' vs ')}</b>{' '}
            <span className="badge">{b.taskType}</span>{' '}
            <span className={`badge ${b.status === 'RESOLVED' ? 'ok' : b.status === 'FAILED' ? 'err' : ''}`}>{b.status}</span>
          </div>
          <button className="btn sm" onClick={() => setActive(b)}>Ver</button>
        </div>
      )) : <div className="empty">Aún no hay batallas.</div>}
    </div>
  );
}
