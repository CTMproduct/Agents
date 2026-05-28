# ✅ LISTO PARA RAILWAY

**Fecha:** 2026-05-28  
**Status:** 🟢 PREPARADO PARA DEPLOY  
**Commit:** `8b060e3` - Clean npm dependencies

---

## ✅ CAMBIOS REALIZADOS

### 1. **Limpiar dependencias**
- ❌ Eliminado: `node_modules/` (corrupto con @emapi)
- ❌ Eliminado: `package-lock.json` (inconsistente)
- ✅ Reinstalado: `npm install` en raíz
- ✅ Reinstalado: `npm install` en `backend/`
- ✅ Resultado: Sin vulnerabilidades, todas las dependencias limpias

### 2. **Configurar URLs para desarrollo/producción**
- ✅ `.env` raíz → `VITE_API_BASE_URL=http://localhost:3000`
- ✅ `openapi/nora-action.json` → `servers[0].url = http://localhost:3000`
- ✅ Backend `.env` → Configurado con PostgreSQL y OpenAI API Key

### 3. **Git commit**
- ✅ Commit: `8b060e3`
- ✅ Mensaje: Fix: Clean npm dependencies and update OpenAPI schema

---

## 🚀 PRÓXIMOS PASOS PARA RAILWAY

### PASO 1: Conectar GitHub a Railway

1. Ve a https://railway.app/dashboard
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub"**
4. Busca y selecciona: **`CTMproduct/Agents`**
5. Railway detectará el repositorio

---

### PASO 2: Configurar Variables de Entorno

En Railway, ve a **"Variables"** y agrega:

```
OPENAI_API_KEY=[Tu clave de OpenAI]
OPENAI_MODEL=gpt-4o-mini
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://[tu-dominio].railway.app
POSTGRES_URL=postgres://dashboard_user:CtmDashboard2026*@localhost:5432/dashboard_db
```

**Nota:** Si usas PostgreSQL local, necesitarás una BD pública. Considera:
- Railway PostgreSQL addon
- Supabase (PostgreSQL as a service)
- O dejar POSTGRES_URL con fallback a memoria

---

### PASO 3: Configurar Root Directory

**OPCIÓN A: (Recomendada) Crear `Dockerfile` en `backend/`**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

**OPCIÓN B: Usar `railway.json` en raíz**

```json
{
  "build": {
    "buildCommand": "cd backend && npm install"
  }
}
```

---

### PASO 4: Deploy

1. Click en **"Deploy"**
2. Railway construirá la aplicación (3-5 minutos)
3. Una vez completado, verás una URL como:
   ```
   https://agents-production-xxxxx.railway.app
   ```

---

### PASO 5: Actualizar Archivos Locales

Una vez tengas la URL de Railway (ejemplo: `https://agents-production-xxxxx.railway.app`):

**Archivo: `.env` (raíz)**
```
VITE_API_BASE_URL=https://agents-production-xxxxx.railway.app
```

**Archivo: `openapi/nora-action.json`**
```json
"servers": [
  {
    "url": "https://agents-production-xxxxx.railway.app",
    "description": "Production backend for the action"
  }
]
```

---

### PASO 6: Actualizar Custom GPT

1. Abre tu Custom GPT "Nora" en ChatGPT
2. Ve a **Configure → Actions**
3. **Elimina** la acción anterior
4. **Crea nueva acción:**
   - Pega el contenido actualizado de `openapi/nora-action.json`
   - URL debe ser tu URL de Railway
5. Click en **"Test the action"** para verificar
6. **Guarda**

---

### PASO 7: Hacer Commit Final

```bash
git add .env openapi/nora-action.json
git commit -m "Config: Update API URLs to Railway production"
git push
```

---

## ✅ CHECKLIST FINAL

### Antes de Deploy:
- [ ] Dependencias limpias (npm install corrió sin errores)
- [ ] Commit realizado (`8b060e3`)
- [ ] Backend `.env` tiene OPENAI_API_KEY válida
- [ ] PostgreSQL URL configurada (local o externa)

### Durante Deploy:
- [ ] GitHub conectado a Railway
- [ ] Variables de entorno configuradas
- [ ] Dockerfile o railway.json en su lugar
- [ ] Deploy iniciado y completado

### Después de Deploy:
- [ ] URL de Railway obtenida
- [ ] `.env` raíz actualizado con URL de Railway
- [ ] `openapi/nora-action.json` actualizado con URL de Railway
- [ ] Custom GPT action actualizada
- [ ] Test: Pregunta al GPT y verifica en `/api/conversations`

---

## 📊 RESULTADO ESPERADO

Una vez todo esté en Railway:

```
Frontend (localhost:5173)
    ↓
Backend (https://agents-production-xxxxx.railway.app)
    ↓
PostgreSQL (captura datos)
    ↓
Custom GPT (accede via URL pública)
    ↓
Dashboard actualiza cada 30s con datos reales
```

---

## 🎯 RESUMEN

✅ **Proyecto limpio y listo para Railway**
✅ **Dependencias sin conflictos**
✅ **URLs configuradas para desarrollo local**
✅ **Commit creado y pusheado**

**Siguiente paso:** Deploy en Railway con tu URL pública

¿Necesitas ayuda con algún paso específico? 🚀
