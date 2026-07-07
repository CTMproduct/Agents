import { useEffect, useState, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';
import { Dashboard, Marketplace, Agents, Review, Learning, Metrics } from './pages';

export interface Me { id: string; email: string; role: string; tenant: { id: string; name: string } | null }
const MeCtx = createContext<Me | null>(null);
export const useMe = () => useContext(MeCtx);

function Login({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ email: '', password: '', tenantName: '' });
  const submit = async () => {
    setErr('');
    try {
      const r = await api<{ token: string }>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      setToken(r.token); onAuth();
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 style={{ color: 'var(--primary)' }}>Agentic <span style={{ color: 'var(--accent)' }}>Revenue OS</span></h1>
        <p className="sub">Plataforma empresarial de agentes de IA</p>
        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Iniciar sesión</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Registrar empresa</button>
        </div>
        {mode === 'register' && (<><label>Nombre de tu empresa</label>
          <input value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })} /></>)}
        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label>Contraseña</label>
        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <div className="err-text">{err}</div>
        <button className="btn accent" style={{ width: '100%', marginTop: 8 }} onClick={submit}>
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </div>
    </div>
  );
}

function Shell({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const links = [
    ['/dashboard', 'Dashboard'], ['/marketplace', 'Marketplace'], ['/agents', 'Mis Agentes'],
    ['/review', 'Human Review'], ['/learning', 'Aprendizaje'], ['/metrics', 'Métricas'],
  ] as const;
  return (
    <MeCtx.Provider value={me}>
      <div className="layout">
        <nav className="sidebar">
          <div className="logo">Agentic <span>Revenue OS</span></div>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
          ))}
          <a href="/marketplace" target="_blank" rel="noreferrer">Automation Studio ↗</a>
          <div className="foot">
            {me.tenant?.name ?? me.email}<br />
            <a style={{ color: '#c8d3dc', cursor: 'pointer' }} onClick={onLogout}>Cerrar sesión</a>
          </div>
        </nav>
        <main className="main">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/review" element={<Review />} />
            <Route path="/learning" element={<Learning />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </MeCtx.Provider>
  );
}

function Root() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const refresh = async () => {
    if (!getToken()) { setMe(null); setLoading(false); return; }
    try { setMe(await api<Me>('/auth/me')); } catch { setMe(null); }
    setLoading(false);
  };
  useEffect(() => { setUnauthorizedHandler(() => { setMe(null); nav('/'); }); refresh(); }, []);
  if (loading) return <div className="empty">Cargando…</div>;
  if (!me) return <Login onAuth={refresh} />;
  return <Shell me={me} onLogout={() => { setToken(null); setMe(null); }} />;
}

export default function App() {
  return (<HashRouter><Root /></HashRouter>);
}
