# 🚀 GUÍA: DESPLEGAR BACKEND EN RAILWAY

**Repositorio:** https://github.com/CTMproduct/Agents  
**Carpeta a desplegar:** `backend/`  
**Estado:** Listo para subir

---

## 📋 PASO 1: Crear Proyecto en Railway

1. Ve a https://railway.app
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub"**

---

## 🔗 PASO 2: Conectar tu Repositorio GitHub

1. Click en **"GitHub Repository"**
2. Busca: **`CTMproduct/Agents`**
3. Selecciona el repositorio
4. Railway te pedirá autorizar GitHub (autoriza)
5. **Selecciona la rama:** `main`

---

## ⚙️ PASO 3: Configurar el Proyecto

Una vez conectado, Railway detectará que hay un `package.json` en la raíz.

**IMPORTANTE:** Necesitas indicarle a Railway que la app está en la carpeta `backend/`:

1. En la configuración del proyecto, busca **"Root Directory"** o **"Build Settings"**
2. Cambia a: `backend`
3. O crear un archivo `railway.json` en la raíz con:

```json
{
  "root": "backend",
  "build": {
    "builder": "dockerfile"
  }
}
```

**ALTERNATIVA MÁS FÁCIL:** Crea un `Dockerfile` en `backend/`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

---

## 🔐 PASO 4: Configurar Variables de Entorno en Railway

1. En el dashboard de Railway, ve a tu proyecto
2. Haz click en **"Variables"**
3. Agrega estas variables:

```
OPENAI_API_KEY=sk-proj-[tu_clave_aqui]
OPENAI_MODEL=gpt-4o-mini
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://[tu_dominio_railway].railway.app
POSTGRES_URL=postgres://dashboard_user:CtmDashboard2026*@localhost:5432/dashboard_db
```

**IMPORTANTE - Base de datos:**
- Si Railway proporciona una BD PostgreSQL, usa esa URL en lugar de localhost
- Si no la tiene, usa un servicio externo como Railway PostgreSQL o Supabase

---

## 🚀 PASO 5: Desplegar

1. Click en **"Deploy"**
2. Railway construirá la imagen Docker
3. Esperará a que se complete (3-5 minutos)

---

## 📍 PASO 6: Obtener la URL del Backend

Una vez desplegado:

1. Ve a la pestaña **"Deployments"**
2. Busca el **"URL"** o **"Domain"** 
3. Debería verse algo como: `https://agents-production-xxxx.railway.app`
4. **Copia esa URL** ← LA NECESITAREMOS

---

## ✅ PASO 7: Verificar que Funciona

```bash
# Reemplaza {TU_URL} con la URL de Railway
curl https://{TU_URL}/health

# Deberías ver:
# {"status":"online","message":"Nora API Backend is running",...}
```

---

## 🔄 PASO 8: Actualizar Archivos Locales

Una vez tengas la URL de Railway, actualiza estos archivos en tu proyecto local:

### Archivo 1: `.env` (raíz)

```bash
VITE_API_BASE_URL=https://{TU_URL_RAILWAY}
VITE_REFRESH_INTERVAL=30000
VITE_ENABLE_REALTIME=true
VITE_SHOW_HALLUCINATION_ANALYSIS=true
```

### Archivo 2: `openapi/nora-action.json`

Busca esta sección y actualiza:

```json
"servers": [
  {
    "url": "https://{TU_URL_RAILWAY}",
    "description": "Production backend URL for the action"
  }
]
```

---

## 🤖 PASO 9: Actualizar Custom GPT Action

1. Abre tu Custom GPT "Nora" en ChatGPT
2. Ve a **Configure → Actions**
3. **Elimina** la acción anterior
4. **Crea nueva acción:**
   - Click en **"Create new action"**
   - En **"Schema"** → Pega el contenido de `openapi/nora-action.json` (ya actualizado)
   - La URL debería ser tu URL de Railway
5. **Test the action** para verificar que conecta
6. **Guarda**

---

## 📊 PASO 10: Prueba Completa

1. **Frontend local:** `npm run dev` → http://localhost:5173
2. **Custom GPT:** Pregunta algo a Nora en ChatGPT
3. **Verifica captura:**
   ```bash
   curl https://{TU_URL_RAILWAY}/api/conversations
   ```
4. **Dashboard:** Las métricas deben actualizarse con datos reales

---

## ⚠️ TROUBLESHOOTING

| Problema | Solución |
|----------|----------|
| "Build failed" | Verifica que `backend/package.json` existe |
| "Port already in use" | Railway asigna puerto automáticamente, no necesitas especificar |
| "POSTGRES_URL error" | Si usas BD local, necesitas BD en Railway o Supabase |
| "Action timeout" | Verifica que la URL de Railway es correcta |
| "Backend Offline en dashboard" | Verifica que VITE_API_BASE_URL en `.env` apunta a tu URL de Railway |

---

## 📝 RESUMEN DE CAMBIOS

Después de desplegar en Railway:

1. ✅ Backend corriendo en: `https://{TU_URL_RAILWAY}`
2. ✅ Frontend en local apunta a esa URL (`.env`)
3. ✅ Custom GPT action apunta a esa URL (`openapi/nora-action.json`)
4. ✅ PostgreSQL captura datos
5. ✅ Dashboard muestra métricas en tiempo real

---

**Una vez tengas la URL de Railway, dame la URL y actualizo todo automáticamente.** 🚀
