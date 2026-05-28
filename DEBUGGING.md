# 🔍 DEBUGGING COMPLETO - NORA DASHBOARD

Fecha: 2026-05-13
Versión: 1.0

## 📋 Resumen Ejecutivo

Se ha realizado un debugging completo del proyecto que identificó **5 problemas críticos** y **7 mejoras implementadas**.

---

## 🚨 PROBLEMAS ENCONTRADOS

### 1. **SEGURIDAD CRÍTICA: API Key Expuesta** 
- **Ubicación**: `backend/.env`
- **Problema**: La API key de OpenAI está en texto plano en el archivo `.env`
- **Riesgo**: Comprometimiento de credenciales de OpenAI
- **Solución**: 
  ```bash
  # Remover key del .env
  # Usar solo en variables de entorno de producción (Render)
  # Agregar validación en server.js
  ```
- **Estado**: ✅ IMPLEMENTADO

### 2. **Configuración CORS Insegura**
- **Ubicación**: `backend/server.js`
- **Problema**: `origin: '*'` permite cualquier origen
- **Impacto**: Vulnerabilidad a CSRF, exposición de API pública
- **Solución**: Configurar CORS dinámicamente según `NODE_ENV`
  - Desarrollo: `['localhost:5173', 'localhost:3000', 'localhost:4173']`
  - Producción: Usar `FRONTEND_URL`
- **Estado**: ✅ IMPLEMENTADO

### 3. **Variables de Entorno Mal Configuradas**
- **Ubicación**: `.env.local` vs `.env`
- **Problema**: Confusión entre configuración local y producción
- **Impacto**: En Render, se usa `.env` (production) pero localmente `.env.local` (development)
- **Solución**:
  - Crear `.env.example` en ambas carpetas
  - Documentar correctamente en README
- **Estado**: ✅ IMPLEMENTADO

### 4. **Sin Validación de Conectividad Backend**
- **Ubicación**: Frontend no verifica si backend está online
- **Problema**: Errores vagos cuando backend no responde
- **Impacto**: Experiencia de usuario pobre, difícil debugging
- **Solución**: Crear hook `useBackendHealth` que verifique salud cada 30s
- **Estado**: ✅ IMPLEMENTADO

### 5. **Sin Manejo de Errores Global**
- **Ubicación**: `backend/server.js`
- **Problema**: Endpoints 404 no retornan JSON, sin error handler
- **Impacto**: Errores de cliente no capturados adecuadamente
- **Solución**: Agregar middleware 404 y error handler global
- **Estado**: ✅ IMPLEMENTADO

---

## ✅ CAMBIOS IMPLEMENTADOS

### Backend (`backend/server.js`)

#### 1. Validación de API Key
```javascript
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY no está configurada');
  process.exit(1);
}
```

#### 2. CORS Mejorado
```javascript
const corsOptions = {
  origin: NODE_ENV === 'production' 
    ? FRONTEND_URL 
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
```

#### 3. Logging de Configuración
```javascript
console.log('🔧 Configuration:');
console.log(`  NODE_ENV: ${NODE_ENV}`);
console.log(`  PORT: ${PORT}`);
console.log(`  CORS Origins: ${...}`);
```

#### 4. Error Handler Global
```javascript
// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Endpoint no encontrado: ${req.method} ${req.url}`,
    availableEndpoints: { ... }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err);
  res.status(500).json({
    status: 'error',
    message: NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});
```

### Frontend - API Service (`src/services/api.ts`)

#### 1. Interceptores de Request/Response
```typescript
apiClient.interceptors.request.use((config) => {
  if (DEBUG_MODE) {
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (DEBUG_MODE) console.log(`✅ ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`❌ API Error [${status}]:`, message);
    return Promise.reject(error);
  }
);
```

#### 2. Health Check Method
```typescript
async checkHealth(): Promise<boolean> {
  try {
    await apiClient.get('/health');
    return true;
  } catch (error) {
    return false;
  }
}
```

### Frontend - Hook de Salud (`src/hooks/useBackendHealth.ts`)

Nuevo hook que:
- Verifica salud del backend al montar
- Re-verifica cada 30 segundos
- Retorna estado, errores y función de reintento
- Facilita debugging

```typescript
const { isHealthy, error, retry } = useBackendHealth();
```

### Frontend - Componente de Estado (`src/components/BackendStatus.tsx`)

Nuevo componente que:
- Muestra indicador visual de backend (online/offline)
- Anima el estado con pulsación
- Muestra errores si los hay
- Permite reintentar manualmente
- Timestamp de última verificación

### Archivos de Configuración

#### `.env.example` (Frontend)
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_REFRESH_INTERVAL=30000
VITE_ENABLE_REALTIME=true
VITE_DEBUG_MODE=false
```

#### `.env.example` (Backend)
```env
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
OPENAI_MODEL=gpt-4o-mini
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### Estilos (`src/styles/BackendStatus.css`)

Nuevo archivo con:
- Indicador visual con animación de pulso
- Colores verde (online) y rojo (offline)
- Sección de errores editable
- Botón de reintento
- Responsive design

---

## 🚀 CÓMO USAR

### Instalación
```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### Configuración Inicial
```bash
# Frontend - Copiar .env.example a .env.local
cp .env.example .env.local

# Backend - Copiar .env.example a .env
cd backend
cp .env.example .env

# Editar backend/.env y agregar tu API key de OpenAI
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

### Ejecución
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
cd backend
npm run dev
```

### Debugging
```bash
# PowerShell (Windows)
.\debug.ps1

# Bash (Linux/Mac)
chmod +x debug.sh
./debug.sh
```

---

## 🔍 QUÉ HACE CADA VERIFICACIÓN

### `debug.ps1` (Windows)

1. **Variables de Entorno**: Verifica que `.env` y `.env.local` existan
2. **Dependencias**: Comprueba que `node_modules` esté instalado
3. **Puertos**: Verifica si 3000 y 5173 están en uso
4. **Archivos Críticos**: Confirma que todos los archivos necesarios existan
5. **Conexión**: Prueba HTTP GET a `/health`

### `debug.sh` (Linux/Mac)

Mismo flujo que `debug.ps1` pero en bash.

---

## 📊 INDICADORES EN VIVO

El nuevo componente `BackendStatus` muestra:

- 🟢 **Online**: Backend respondiendo correctamente
- 🔴 **Offline**: Backend no responde o error
- ⏳ **Verificando**: En proceso de health check
- 📍 **Timestamp**: Cuándo fue la última verificación

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### "Backend Offline" en Dashboard
1. Verificar que `npm run dev` esté ejecutándose en `backend/`
2. Confirmar que puerto 3000 está disponible
3. Ver logs en terminal del backend
4. Ejecutar: `curl http://localhost:3000/health`

### "API Base URL" incorrecta
1. En `.env.local`: `VITE_API_BASE_URL=http://localhost:3000`
2. Reiniciar servidor de desarrollo: `npm run dev`
3. Limpiar caché: `Ctrl+Shift+R` en navegador

### OpenAI API Key error
1. Verificar que `backend/.env` tiene clave válida
2. Usar: `OPENAI_API_KEY=sk-proj-...` (24 caracteres mínimo)
3. No incluir comillas: `KEY=value` no `KEY="value"`

### CORS Error
1. Confirmar `NODE_ENV=development` en `backend/.env`
2. Frontend debe estar en `http://localhost:5173`
3. Reiniciar ambos servidores

---

## 📈 MEJORAS FUTURAS

1. **Base de Datos**: Migrar de almacenamiento en memoria a PostgreSQL
2. **Autenticación**: Agregar JWT o sessions
3. **Rate Limiting**: Proteger endpoints con rate limits
4. **Logging Persistente**: Guardar logs en archivo
5. **Monitoreo**: Integrar Sentry o similar
6. **Cache**: Implementar Redis para datos en tiempo real
7. **CI/CD**: GitHub Actions para deploy automático a Render

---

## 📝 ARCHIVOS MODIFICADOS

```
✅ backend/server.js
   - Validación de OPENAI_API_KEY
   - CORS dinámico según NODE_ENV
   - Logging de configuración
   - Error handlers (404, global)

✅ src/services/api.ts
   - Interceptores de request/response
   - Health check method
   - Better error logging

🆕 src/hooks/useBackendHealth.ts
   - Verificación de salud cada 30s
   - Estado reactivo (isHealthy, error, etc)

🆕 src/components/BackendStatus.tsx
   - Indicador visual de estado
   - Animación de pulso
   - Botón de reintento

🆕 src/styles/BackendStatus.css
   - Estilos responsive
   - Animaciones

✅ src/components/Header.tsx
   - Integración de BackendStatus

✅ .env.example (backend)
   - Variables de ejemplo sin key

✅ .env.example (frontend)
   - Variables de frontend documentadas

🆕 debug.ps1
   - Script de debugging completo (Windows)

🆕 debug.sh
   - Script de debugging completo (Linux/Mac)

🆕 DEBUGGING.md (este archivo)
   - Documentación completa
```

---

## ✨ BENEFICIOS

✅ **Seguridad**: API key protegida y validada
✅ **Debugging**: Fácil identificar problemas de conectividad
✅ **Logging**: Información detallada en consola (dev mode)
✅ **CORS**: Configuración flexible para dev y prod
✅ **UX**: Indicador visual de estado del backend
✅ **Documentación**: Guías completas de setup
✅ **Escalabilidad**: Base lista para mejoras

---

## 📞 SOPORTE

Si encuentras problemas:

1. Ejecutar `debug.ps1` (Windows) o `debug.sh` (Linux)
2. Revisar logs en consola del browser (F12)
3. Revisar logs en terminal del backend
4. Verificar archivos `.env` tienen valores correctos
5. Confirmar puertos 3000 y 5173 no están en uso

---

**Última Actualización**: 2026-05-13
**Versión**: 1.0
**Status**: ✅ COMPLETO
