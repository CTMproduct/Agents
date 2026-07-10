# Configuracion local

## Requisitos

- Node.js 22
- npm 10 o superior
- PostgreSQL recomendado
- Una clave de OpenAI

## Instalar

```powershell
npm run install:all
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

## Backend

Edita `backend/.env`:

```env
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_EVALUATION_MODEL=gpt-4o-mini
AGENT_ADMIN_KEY=your-long-random-admin-key
DATABASE_URL=postgresql://user:password@localhost:5432/nora
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=30
```

Si `DATABASE_URL` no esta disponible, el backend usa `backend/src/data/fallback-conversations.json`. Ese modo sirve para desarrollo, pero no reemplaza una base persistente en produccion.

## Frontend

Para desarrollo local, `frontend/.env` puede conservar:

```env
VITE_API_BASE_URL=
VITE_REFRESH_INTERVAL=30000
VITE_ENABLE_REALTIME=true
VITE_SHOW_HALLUCINATION_ANALYSIS=true
VITE_SHOW_PERFORMANCE_METRICS=true
VITE_SHOW_CONVERSATION_METRICS=true
VITE_DEBUG_MODE=false
```

Una URL vacia hace que Vite envie las solicitudes `/api` al backend local mediante su proxy.

## Iniciar

Terminal 1:

```powershell
npm run dev:backend
```

Terminal 2:

```powershell
npm run dev:frontend
```

Abre `http://localhost:5173` e ingresa la clave de `AGENT_ADMIN_KEY`.

## Verificar

```powershell
npm run check
```

Pruebas rapidas:

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/api/status
```

Las rutas del dashboard, las conversaciones y la edicion de agentes requieren la cabecera `X-Agent-Admin-Key`.

## Problemas frecuentes

- `401`: la clave administrativa no coincide.
- `503` al validar acceso en produccion: falta `AGENT_ADMIN_KEY`.
- `429`: se alcanzo el limite temporal de solicitudes de IA.
- El dashboard no conserva datos: configura PostgreSQL mediante `DATABASE_URL`.
- El frontend no carga en produccion: ejecuta `npm run build --prefix frontend` antes de iniciar el backend.
