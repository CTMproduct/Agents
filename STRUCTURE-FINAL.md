# 📁 ESTRUCTURA FINAL DEL PROYECTO - LISTO PARA RAILWAY

**Fecha:** 2026-05-28  
**Status:** ✅ 100% REORGANIZADO Y CONFIGURADO  

---

## 🎯 NUEVA ESTRUCTURA

```
Agents/
├── backend/                          ← Backend Node/Express
│   ├── server.js                     (Puerto: 3001)
│   ├── postgres.js                   (PostgreSQL integration)
│   ├── db.js                         (Mongoose fallback)
│   ├── models.js                     (Data models)
│   ├── package.json                  (Backend dependencies)
│   ├── .env                          (Backend config - NOT committed)
│   ├── node_modules/                 (Installed dependencies)
│   └── data/                         (Fallback storage)
│
├── frontend/                         ← Frontend React/Vite
│   ├── src/                          (React components & services)
│   ├── public/                       (Static assets)
│   ├── index.html                    (Entry point)
│   ├── vite.config.ts                (Vite config - proxy to :3001)
│   ├── tsconfig.json                 (TypeScript config)
│   ├── package.json                  (Frontend dependencies)
│   ├── .env                          (Frontend config - NOT committed)
│   ├── package-lock.json             (Dependency lock)
│   ├── eslint.config.js              (Linter config)
│   └── node_modules/                 (Installed dependencies)
│
├── openapi/                          ← Custom GPT Schema
│   └── nora-action.json              (OpenAPI 3.1.1 definition)
│
├── package.json                      ← MONOREPO ROOT (scripts only)
├── railway.json                      ← Railway deployment config
├── .gitignore                        ← Git configuration
├── .env.example                      ← Environment template
├── [documentation files]             ← MD files for reference
└── .git/                             ← Git repository
```

---

## 🔑 CONFIGURACIÓN POR ARCHIVO

### 1️⃣ `package.json` (RAÍZ - Monorepo Coordinator)

```json
{
  "name": "nora-agents",
  "scripts": {
    "install:all": "npm install --prefix backend && npm install --prefix frontend",
    "build": "npm run build --prefix frontend",
    "build:all": "npm install --prefix backend && npm install --prefix frontend && npm run build --prefix frontend",
    "start": "npm run start --prefix backend",
    "dev:backend": "npm run dev --prefix backend",
    "dev:frontend": "npm run dev --prefix frontend",
    "dev": "npm run dev:frontend"
  }
}
```

**Propósito:** Coordina instalación y ejecución de backend + frontend

---

### 2️⃣ `backend/.env` (Backend Configuration)

```env
OPENAI_API_KEY=sk-proj-[YOUR_KEY]
OPENAI_MODEL=gpt-4o-mini
PORT=3001                              ← Usado en localhost
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
POSTGRES_URL=postgres://...
```

**Propósito:** Variables del backend (ignorado en Git)

---

### 3️⃣ `frontend/.env` (Frontend Configuration)

```env
VITE_API_BASE_URL=http://localhost:3001    ← Apunta a backend:3001
VITE_REFRESH_INTERVAL=30000
VITE_ENABLE_REALTIME=true
VITE_SHOW_HALLUCINATION_ANALYSIS=true
VITE_SHOW_PERFORMANCE_METRICS=true
VITE_SHOW_CONVERSATION_METRICS=true
```

**Propósito:** Variables del frontend (ignorado en Git)

---

### 4️⃣ `frontend/vite.config.ts` (Vite Build Config)

```typescript
server: {
  allowedHosts: ['localhost', '127.0.0.1', '.railway.app'],
  host: '0.0.0.0',
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',    ← Proxy al backend
      changeOrigin: true,
      rewrite: (path) => path,
    },
  },
}
```

**Propósito:** Desarrollo local y soporte para Railway

---

### 5️⃣ `backend/server.js` (Backend Entry Point)

```javascript
const PORT = process.env.PORT || 3001;    ← Lee de env, fallback 3001
```

**Propósito:** Railway asigna PORT automáticamente, fallback es 3001

---

### 6️⃣ `railway.json` (Railway Deployment Config)

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run install:all"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/health"
  }
}
```

**Propósito:** Configura build y deploy automático en Railway

---

### 7️⃣ `.gitignore` (Git Ignore Rules)

```
# Ignora archivos sensibles
.env
backend/.env
frontend/.env
node_modules
dist
```

**Propósito:** Previene commit de variables de entorno y dependencias

---

### 8️⃣ `openapi/nora-action.json` (Custom GPT Schema)

```json
{
  "servers": [{
    "url": "http://localhost:3001"    ← Debe ser actualizado al deployer
  }],
  "paths": {
    "/api/capturar-conversacion": { ... },
    "/api/chat": { ... }
  }
}
```

**Propósito:** Define endpoints para Custom GPT de ChatGPT

---

## ✅ VERIFICACIÓN DE CONFIGURACIÓN

| Elemento | Estado | Detalles |
|----------|--------|----------|
| **Backend estructura** | ✅ | server.js, postgres.js, models.js |
| **Frontend estructura** | ✅ | src/, vite.config.ts, tsconfig |
| **Backend PORT** | ✅ | 3001 (env) + fallback 3001 |
| **Frontend PORT** | ✅ | 5173 |
| **Proxy /api** | ✅ | Apunta a localhost:3001 |
| **Backend .env** | ✅ | OPENAI_API_KEY, POSTGRES_URL |
| **Frontend .env** | ✅ | VITE_API_BASE_URL=localhost:3001 |
| **railway.json** | ✅ | buildCommand + startCommand correcto |
| **package.json raíz** | ✅ | Scripts monorepo coordinador |
| **.gitignore** | ✅ | Ignora .env en todos lados |

---

## 🚀 COMANDOS LOCALES

### Terminal 1 - Backend:
```bash
cd backend
npm start
# Output: ✅ Nora Backend running on http://localhost:3001
```

### Terminal 2 - Frontend:
```bash
npm run dev:frontend
# Abre: http://localhost:5173
```

### Terminal 3 - Verificar:
```bash
curl http://localhost:3001/health
# Output: {"status":"ok"}
```

---

## 🚀 DEPLOYMENT A RAILWAY

### Paso 1: Instalar dependencias localmente (opcional pero recomendado)
```bash
npm run install:all
```

### Paso 2: Hacer git commit
```bash
git add .
git commit -m "Reorganize structure for Railway deployment"
git push
```

### Paso 3: En Railway Dashboard
1. Click "New Project" → "Deploy from GitHub"
2. Selecciona repositorio `CTMproduct/Agents`
3. Railway detecta `railway.json` automáticamente
4. Click "Deploy"

### Paso 4: Configurar variables en Railway Dashboard
```
OPENAI_API_KEY=sk-proj-[YOUR_KEY]
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
FRONTEND_URL=https://[tu-app].railway.app
POSTGRES_URL=postgres://[credentials]@[host]:[port]/[db]
```

**Nota:** NO configures PORT en Railway Dashboard, lo asigna automáticamente

### Paso 5: Obtener URL pública
Railway proporciona: `https://agents-xxxxx.railway.app`

### Paso 6: Actualizar referencias
Una vez obtengas la URL, actualiza:
- `frontend/.env` → `VITE_API_BASE_URL=https://agents-xxxxx.railway.app`
- `openapi/nora-action.json` → `"url": "https://agents-xxxxx.railway.app"`
- Custom GPT action en ChatGPT → Nueva URL

---

## 🎯 FLUJO DE DATOS FINAL

```
1️⃣ Usuario pregunta a Custom GPT (Nora)
   └─ GPT conectado a: https://agents-xxxxx.railway.app (en prod)

2️⃣ GPT genera respuesta
   └─ Usa OPENAI_API_KEY configurada en Railway

3️⃣ GPT llama automáticamente a POST /api/capturar-conversacion
   └─ URL: https://agents-xxxxx.railway.app/api/capturar-conversacion

4️⃣ Backend recibe y procesa
   └─ CORS habilitado
   └─ Valida campos requeridos
   └─ Evalúa calidad con OpenAI

5️⃣ Guarda en PostgreSQL
   └─ POSTGRES_URL configurada en Railway Dashboard
   └─ Tabla conversations creada

6️⃣ Frontend polling cada 30s
   └─ GET /api/metrics

7️⃣ Dashboard actualiza CON DATOS REALES
   └─ Desde PostgreSQL en prod
```

---

## ✨ CONCLUSIÓN

✅ **Proyecto 100% reorganizado y listo**
✅ **Estructura clara: backend/ y frontend/ separados**
✅ **Configuración monorepo con scripts coordinadores**
✅ **Railway deployment automático configurado**
✅ **Variables de entorno seguras (no committeadas)**
✅ **Todos los puertos correctos: backend:3001, frontend:5173**
✅ **OpenAPI schema para Custom GPT**
✅ **PostgreSQL integrado para persistencia**

**Próximo paso:** Ejecutar `npm run install:all` en localhost, luego hacer commit y deploy a Railway.

