// Cliente API minimo: mismo backend, token JWT en localStorage.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

export function getToken(): string | null { return localStorage.getItem('mk_token'); }
export function setToken(t: string | null) {
  if (t) localStorage.setItem('mk_token', t);
  else localStorage.removeItem('mk_token');
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401) { setToken(null); onUnauthorized?.(); throw new Error('Sesión expirada'); }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message ?? msg; } catch { /* noop */ }
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return res.status === 204 ? (null as T) : res.json();
}
