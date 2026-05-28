# 🔐 CONFIGURACIÓN DE VARIABLES DE ENTORNO EN RAILWAY

**IMPORTANTE:** Las variables de entorno NO van en archivos `.env` en Railway. Se configuran en el dashboard.

---

## 📋 VARIABLES REQUERIDAS EN RAILWAY

En tu proyecto Railroad, ve a **Variables** y agrega EXACTAMENTE estas:

### 1. OpenAI Configuration
```
OPENAI_API_KEY=sk-proj-[TU_CLAVE_AQUI]
OPENAI_MODEL=gpt-4o-mini
```

### 2. Node Configuration
```
NODE_ENV=production
```

### 3. Frontend URL (para CORS)
```
FRONTEND_URL=https://[tu-dominio-railway].railway.app
```

### 4. Database Configuration
```
POSTGRES_URL=postgres://dashboard_user:CtmDashboard2026*@localhost:5432/dashboard_db
```

**NOTA:** Si usas BD local, necesitas:
- Railway PostgreSQL addon, O
- Supabase (PostgreSQL externa), O
- Dejar fallback a memoria

---

## ⚙️ PUERTO - AUTOMÁTICO EN RAILWAY

❌ **NO configures `PORT` manualmente**

✅ Railway asigna automáticamente el puerto al variable `$PORT`

El `backend/server.js` ya lee:
```javascript
const PORT = process.env.PORT || 3000;
```

Cuando Railway despliega, inyecta automáticamente `PORT=xxxx`

---

## 🚀 PASOS PARA CONFIGURAR EN RAILWAY

### PASO 1: En tu proyecto Railway

1. Abre https://railway.app/dashboard
2. Selecciona tu proyecto **"marvelous-spontaneity"** (o el tuyo)
3. Ve a **"Variables"** tab

### PASO 2: Agregar Variables

Click en **"+ Add Variable"** para cada una:

```
Key: OPENAI_API_KEY
Value: sk-proj-[TU_CLAVE_AQUI]
```

```
Key: OPENAI_MODEL
Value: gpt-4o-mini
```

```
Key: NODE_ENV
Value: production
```

```
Key: FRONTEND_URL
Value: https://[tu-dominio-railway].railway.app
```

```
Key: POSTGRES_URL
Value: postgres://dashboard_user:CtmDashboard2026*@localhost:5432/dashboard_db
```

### PASO 3: Guardar

Click en **"Save"** después de cada variable

---

## ✅ VERIFICACIÓN

Una vez guardadas las variables:

1. Ve a **"Deployments"**
2. Inicia un nuevo deploy (o redeploy del anterior)
3. Railway detectará las variables
4. El build debería completarse sin errores

---

## 📊 FLUJO DE VARIABLES EN RAILWAY

```
Railway Dashboard (Variables tab)
        ↓
[Inyecta en runtime]
        ↓
backend/server.js (usa process.env.OPENAI_API_KEY, etc)
        ↓
Corre el backend con esas variables
```

---

## 🔍 VERIFICAR QUE FUNCIONAN

Una vez desplegado, verifica que está funcionando:

```bash
# Reemplaza {TU_URL} con tu URL de Railway
curl https://{TU_URL}/health

# Deberías ver:
# {"status":"online","database":"PostgreSQL",...}
```

---

## ⚠️ PROBLEMAS COMUNES

| Problema | Solución |
|----------|----------|
| "OPENAI_API_KEY undefined" | Verifica que la variable está en Railway Dashboard |
| "POSTGRES error" | Si usas BD local, necesitas BD pública (Supabase o Railway addon) |
| "Port already in use" | Railway asigna puerto automáticamente, no necesitas configurar |
| "Backend Offline" | Verifica las variables de entorno en Railway |

---

## 🎯 RESUMEN

✅ **NO usar archivos `.env` en Railway**  
✅ **Configurar TODO en Railway Dashboard → Variables**  
✅ **PORT es automático**  
✅ **OPENAI_API_KEY y POSTGRES_URL son obligatorios**  

Cuando estés listo:
1. Configura las variables en Railway
2. Railway hace redeploy automáticamente
3. Todo debería funcionar 🚀

¿Necesitas ayuda configurando en Railway? 📞
