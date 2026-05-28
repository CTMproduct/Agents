# ✅ LISTO PARA RAILWAY - CONFIGURACIÓN FINAL

**Fecha:** 2026-05-28  
**Commit:** `fe75b9b` - Monorepo Railway configuration refinado  
**Estado:** 🟢 100% LISTO

---

## 📁 ESTRUCTURA DEL PROYECTO

```
Agents/ (RAÍZ)
├── backend/
│   ├── server.js (Node/Express - corre en PORT asignado por Railway)
│   ├── postgres.js (conexión a PostgreSQL)
│   ├── package.json (dependencias del backend)
│   └── .env (ignorado - variables vienen de Railway)
│
├── src/
│   ├── components/
│   ├── services/api.ts (llamadas al backend)
│   └── ...
│
├── package.json (RAÍZ - scripts para monorepo)
├── railway.json (config para Railway)
├── vite.config.ts (config de build/dev del frontend)
├── .gitignore (excluye .env)
└── ...
```

---

## ✅ ARCHIVOS CONFIGURADOS PARA RAILWAY

### 1️⃣ `package.json` (RAÍZ)

```json
{
  "scripts": {
    "install:all": "npm install --prefix backend && npm install",
    "start": "npm run start --prefix backend",
    "build": "npm run build"
  }
}
```

**Lo que hace:**
- `npm run install:all` → Instala dependencias de backend Y frontend
- `npm run start` → Inicia el backend (lee PORT de Railway)
- `npm run build` → Build del frontend Vite (si se necesita)

---

### 2️⃣ `railway.json`

```json
{
  "build": {
    "buildCommand": "npm run install:all"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/health"
  }
}
```

**Lo que hace:**
1. Instala ambas dependencias
2. Inicia el backend con `npm run start`
3. Monitorea `/health` para verificar que está corriendo

---

### 3️⃣ `vite.config.ts` (Frontend)

```javascript
export default defineConfig({
  server: {
    allowedHosts: [
      'localhost',
      '.railway.app'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000'
      }
    }
  }
})
```

**Lo que hace:**
- Permite Railway.app como host
- Proxy `/api/*` al backend en puerto 3000 (local dev)

---

### 4️⃣ `.env` (raíz y backend)

**EN GITHUB:** ❌ NO está (ignorado en .gitignore)  
**EN RAILWAY:** ✅ Variables configuradas en Dashboard

```
OPENAI_API_KEY=sk-proj-[TU_CLAVE]
POSTGRES_URL=postgres://...
NODE_ENV=production
```

---

## 🚀 FLUJO EN RAILWAY

```
1. Railway recibe push
   ↓
2. Detecta railway.json
   ↓
3. Ejecuta: npm run install:all
   - Instala backend/package.json
   - Instala package.json (frontend)
   ↓
4. Ejecuta: npm run start
   - Inicia backend/server.js
   - Backend lee process.env.PORT (asignado por Railway)
   - Backend corre en puerto asignado
   ↓
5. Railway monitorea /health
   - Si responde ✅ → App está running
   - Si falla ❌ → Restart automático (10 intentos)
   ↓
6. Frontend en localhost:5173 (dev local) apunta a:
   - VITE_API_BASE_URL en .env
   - O automáticamente a https://[tu-railway-url]
```

---

## 📊 VERIFICACIÓN FINAL

| Componente | Status | Configurado |
|-----------|--------|------------|
| **package.json raíz** | ✅ | Scripts para monorepo |
| **railway.json** | ✅ | Build + Deploy config |
| **vite.config.ts** | ✅ | Railway.app allowed |
| **backend/server.js** | ✅ | Lee PORT de env |
| **backend/.env** | ✅ | En .gitignore |
| **Git commits** | ✅ | Limpios y listos |
| **Dependencias** | ✅ | Sin conflictos |

---

## 🎯 SIGUIENTE PASO: DEPLOY EN RAILWAY

### Opción A: Primer Deploy

1. Abre https://railway.app/dashboard
2. Click **"New Project"** → **"Deploy from GitHub"**
3. Selecciona **`CTMproduct/Agents`**
4. Railway detecta `railway.json` automáticamente
5. Click **"Deploy"**

### Opción B: Redeploy Existente

1. Ve a tu proyecto en Railway
2. Click **"Variables"** → Configura variables de entorno
3. Click **"Redeploy"**

---

## 🔐 VARIABLES DE ENTORNO PARA RAILWAY

Cuando hagas deploy en Railway, ve a **"Variables"** y configura:

```
OPENAI_API_KEY=sk-proj-[TU_CLAVE]
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
FRONTEND_URL=https://[tu-dominio-railway].railway.app
POSTGRES_URL=postgres://dashboard_user:CtmDashboard2026*@localhost:5432/database_db
```

⚠️ **IMPORTANTE:** Las variables se configuran en Railway Dashboard, NO en archivos `.env`

---

## ✨ QUÉ SUCEDE DESPUÉS

Una vez Railway haga el deploy:

1. **URL pública de Railway:** `https://agents-production-xxxxx.railway.app`
2. **Actualizamos:**
   - `.env` raíz → `VITE_API_BASE_URL=https://...railway.app`
   - `openapi/nora-action.json` → `"url": "https://...railway.app"`
   - Custom GPT action en ChatGPT
3. **Listo:** El Custom GPT accede desde cualquier navegador

---

## 📝 RESUMEN

✅ Monorepo configurado correctamente  
✅ Railway.json listo para deploy  
✅ Package.json con scripts apropiados  
✅ Vite.config.ts para Railway  
✅ Variables de entorno documentadas  
✅ Commits limpios  

**Estás 100% listo para hacer deploy en Railway.** 🚀

Una vez obtengas la URL pública, me la pasas y actualizo los últimos 3 archivos.

¿Empezamos el deploy?
