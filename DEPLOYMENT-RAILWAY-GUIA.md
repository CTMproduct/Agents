# 🚀 GUÍA COMPLETA: DEPLOY A RAILWAY

**Status:** ✅ Proyecto listo para deployment  
**Fecha:** 2026-05-28

---

## 📋 PRE-REQUISITOS

- ✅ Proyecto reorganizado (backend/ y frontend/)
- ✅ Todas las configuraciones en lugar
- ✅ Git repository inicializado
- ✅ Cuenta en Railway (https://railway.app)

---

## 🔄 PASO 1: VERIFICAR LOCALMENTE (RECOMENDADO)

### 1.1 Instala todas las dependencias

```bash
npm run install:all
```

Debería ver:
```
✅ backend dependencies installed
✅ frontend dependencies installed
```

### 1.2 Inicia el backend (Terminal 1)

```bash
npm run start
```

Debería ver:
```
✅ PostgreSQL connected and conversation table initialized
✅ Nora Backend running on http://localhost:3001
```

### 1.3 Inicia el frontend (Terminal 2)

```bash
npm run dev:frontend
```

Debería ver:
```
➜  Local:   http://localhost:5173/
```

### 1.4 Verifica conexión (Terminal 3)

```bash
curl http://localhost:3001/health
```

Debería responder:
```
{"status":"ok"}
```

### 1.5 Prueba en navegador

Abre: http://localhost:5173

Si ves el dashboard → ✅ Todo funciona localmente

---

## 🌐 PASO 2: CONFIGURAR EN GITHUB

### 2.1 Haz commit de los cambios

```bash
git add .
git commit -m "Reorganize project structure for Railway deployment - separate backend and frontend folders"
git push origin main
```

Verifica en GitHub que todo se subió correctamente.

---

## 🚂 PASO 3: DEPLOY EN RAILWAY

### 3.1 Abre Railway Dashboard

https://railway.app/dashboard

### 3.2 Crea un nuevo proyecto

1. Click **"New Project"**
2. Selecciona **"Deploy from GitHub"**
3. Autoriza Railway a acceder a tu GitHub
4. Selecciona tu repositorio: **`CTMproduct/Agents`**
5. Selecciona branch: **`main`**

### 3.3 Railway detecta y despliega automáticamente

Railway verá `railway.json` y ejecutará:

```bash
# Build
npm run install:all
npm run build

# Deploy
npm run start
```

**Espera 3-5 minutos mientras Railway:**
- Instala dependencias
- Construye el frontend
- Inicia el backend
- Asigna puertos automáticamente

### 3.4 Obtén la URL pública

Una vez deployado, Railway asigna una URL como:
```
https://agents-production-xxxxx.railway.app
```

**COPIA ESTA URL** - la necesitarás en los siguientes pasos.

---

## 🔐 PASO 4: CONFIGURAR VARIABLES EN RAILWAY

### 4.1 En Railway Dashboard:

1. Ve a tu proyecto deployado
2. Click en **"Variables"** (o "Environment")
3. Configura estas variables:

```
OPENAI_API_KEY=sk-proj-[TU_CLAVE]
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=production
FRONTEND_URL=https://agents-production-xxxxx.railway.app
POSTGRES_URL=postgres://usuario:password@host:puerto/database
```

### 4.2 NO configures:

❌ NO configures `PORT` en Railway  
❌ NO configures variables que ya estén en archivos .env  

Railway asigna PORT automáticamente.

### 4.3 Guarda los cambios

Click **"Save"** después de cada variable.

---

## 📝 PASO 5: ACTUALIZAR REFERENCIAS EN TU CÓDIGO

Una vez que tengas la URL de Railway: `https://agents-production-xxxxx.railway.app`

### 5.1 Actualiza `frontend/.env`

```env
VITE_API_BASE_URL=https://agents-production-xxxxx.railway.app
VITE_REFRESH_INTERVAL=30000
VITE_ENABLE_REALTIME=true
VITE_SHOW_HALLUCINATION_ANALYSIS=true
VITE_SHOW_PERFORMANCE_METRICS=true
VITE_SHOW_CONVERSATION_METRICS=true
```

### 5.2 Actualiza `openapi/nora-action.json`

Busca:
```json
"servers": [{
  "url": "http://localhost:3001"
}]
```

Cambia a:
```json
"servers": [{
  "url": "https://agents-production-xxxxx.railway.app"
}]
```

### 5.3 Haz commit y push

```bash
git add frontend/.env openapi/nora-action.json
git commit -m "Update API URLs for production deployment"
git push origin main
```

Railway automáticamente hace re-deploy con los cambios.

---

## 🤖 PASO 6: ACTUALIZAR CUSTOM GPT EN CHATGPT

### 6.1 En ChatGPT:

1. Ve a **"My GPTs"**
2. Edita **"Nora"**
3. Ve a **"Actions"**
4. En la acción configurada, actualiza la URL:

**De:**
```
http://localhost:3001
```

**A:**
```
https://agents-production-xxxxx.railway.app
```

### 6.2 Guarda y prueba

Testa que el Custom GPT puede:
- Generar respuestas
- Capturar conversaciones
- Ver métricas en tiempo real

---

## ✅ PASO 7: VERIFICAR DEPLOYMENT

### 7.1 Test de health

```bash
curl https://agents-production-xxxxx.railway.app/health
```

Debería responder:
```json
{"status":"ok"}
```

### 7.2 Test de métricas

```bash
curl https://agents-production-xxxxx.railway.app/api/metrics
```

Debería devolver métricas JSON.

### 7.3 Prueba en el navegador

Abre:
```
https://agents-production-xxxxx.railway.app
```

Debería ver el dashboard.

### 7.4 Prueba Custom GPT

En ChatGPT, pregunta algo a Nora. Debería:
- Generar respuesta
- Capturar en PostgreSQL
- Mostrar en dashboard

---

## 🔧 TROUBLESHOOTING

### Si ves error "Cannot GET /"

El backend está corriendo pero el frontend no está siendo servido correctamente.

**Solución:**
- Verifica que `npm run build` se ejecutó
- Verifica que los archivos están en la carpeta `frontend/`

### Si ves error "API unreachable"

El frontend no puede conectar al backend.

**Solución:**
1. Verifica `VITE_API_BASE_URL` en Railway Dashboard
2. Asegúrate que sea la URL correcta de Railway
3. Verifica que OPENAI_API_KEY está configurada

### Si ves error "PostgreSQL connection failed"

Verifica que `POSTGRES_URL` está correctamente configurada en Railway Dashboard.

---

## 📊 CHECKLIST FINAL

- [ ] Proyecto reorganizado localmente ✅
- [ ] Código committed en GitHub ✅
- [ ] Railway deploy completado ✅
- [ ] URL pública obtenida ✅
- [ ] Variables configuradas en Railway Dashboard ✅
- [ ] frontend/.env actualizado ✅
- [ ] openapi/nora-action.json actualizado ✅
- [ ] Custom GPT actualizado con nueva URL ✅
- [ ] Health check responde OK ✅
- [ ] Dashboard carga en navegador ✅
- [ ] Custom GPT captura datos ✅

---

## 🎉 ¡LISTO!

Tu aplicación Nora está ahora:

✅ Deployada en Railway  
✅ Accesible desde cualquier navegador  
✅ Integrada con Custom GPT en ChatGPT  
✅ Capturando conversaciones en PostgreSQL  
✅ Mostrando métricas en tiempo real  

**Próximos pasos opcionales:**

- Configurar dominio personalizado en Railway
- Configurar alertas en Railway
- Monitorear logs en tiempo real
- Optimizar performance

---

## 📞 REFERENCIAS

- **Railway Dashboard:** https://railway.app/dashboard
- **Railway Docs:** https://docs.railway.app/
- **Custom GPT:** https://chat.openai.com/gpts
- **Proyecto:** `CTMproduct/Agents`

