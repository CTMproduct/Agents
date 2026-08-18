import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiService } from './services/api';
import './App.css';

const Dashboard = lazy(() =>
  import('./components/dashboard/Dashboard').then((module) => ({ default: module.Dashboard })),
);
const AgentStudio = lazy(() =>
  import('./components/agents/AgentStudio').then((module) => ({ default: module.AgentStudio })),
);

type AppView = 'dashboard' | 'agents';

function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [accessKey, setAccessKey] = useState(() => apiService.getAgentAdminKey());
  const [authenticated, setAuthenticated] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  // El dashboard (Resumen) es publico y no necesita esto; solo restauramos
  // la sesion de administracion por si el usuario ya habia iniciado sesion
  // antes para editar agentes.
  useEffect(() => {
    const storedKey = apiService.getAgentAdminKey();
    if (!storedKey) return;

    void apiService.verifyAgentAdminKey(storedKey).then((isValid) => {
      setAuthenticated(isValid);
      if (!isValid) {
        apiService.clearAgentAdminKey();
        setAccessKey('');
      }
    });
  }, []);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSigningIn(true);
    setAccessError(null);

    const isValid = await apiService.verifyAgentAdminKey(accessKey);
    setSigningIn(false);
    setAuthenticated(isValid);

    if (!isValid) {
      setAccessError('No se pudo validar la clave de administracion.');
    }
  };

  const handleSignOut = () => {
    apiService.clearAgentAdminKey();
    setAuthenticated(false);
    setAccessKey('');
    setAccessError(null);
    setView('dashboard');
  };

  return (
    <div className="app">
      <nav className="app-nav" aria-label="Principal">
        <div className="app-nav__brand">
          <span className="app-nav__mark">N</span>
          <div>
            <strong>Nora Control</strong>
            <small>NORA (Net Optimization &amp; Revenue Assistant)</small>
          </div>
        </div>

        <div className="app-nav__actions">
          <div className="app-nav__tabs">
            <button
              type="button"
              className={view === 'dashboard' ? 'app-nav__tab app-nav__tab--active' : 'app-nav__tab'}
              onClick={() => setView('dashboard')}
            >
              Resumen
            </button>
            <button
              type="button"
              className={view === 'agents' ? 'app-nav__tab app-nav__tab--active' : 'app-nav__tab'}
              onClick={() => setView('agents')}
            >
              Agentes
            </button>
          </div>

          {authenticated && (
            <button type="button" className="app-nav__logout" onClick={handleSignOut}>
              Salir
            </button>
          )}
        </div>
      </nav>

      <Suspense fallback={<div className="app-loading">Cargando...</div>}>
        {view === 'dashboard' && <Dashboard />}

        {view === 'agents' &&
          (authenticated ? (
            <AgentStudio />
          ) : (
            <main className="app-auth">
              <section className="app-auth__panel" aria-labelledby="access-title">
                <div className="app-auth__brand">
                  <span className="app-nav__mark">N</span>
                  <div>
                    <h1 id="access-title">Editar agentes</h1>
                    <p>Esta seccion requiere la clave de administracion</p>
                  </div>
                </div>

                <form className="app-auth__form" onSubmit={handleSignIn}>
                  <label>
                    <span>Clave de administracion</span>
                    <input
                      type="password"
                      value={accessKey}
                      onChange={(event) => setAccessKey(event.target.value)}
                      autoComplete="current-password"
                      autoFocus
                      required
                    />
                  </label>
                  <button type="submit" disabled={signingIn}>
                    {signingIn ? 'Validando...' : 'Ingresar'}
                  </button>
                </form>

                {accessError && <p className="app-auth__error">{accessError}</p>}
              </section>
            </main>
          ))}
      </Suspense>
    </div>
  );
}

export default App;
