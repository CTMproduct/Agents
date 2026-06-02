# Arquitectura del Proyecto Nora Agents

## Descripción General

Nora Agents es una aplicación monolítica que combina un **backend Express.js** con un **frontend React/Vite**. La arquitectura está organizada para ser **mantenible, escalable y fácil de entender**.

## Estructura del Proyecto

```
Agents/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuraciones centralizadas
│   │   ├── routes/         # Definición de rutas
│   │   ├── controllers/    # Lógica de request/response
│   │   ├── services/       # Lógica de negocio
│   │   ├── models/         # Schemas de Mongoose
│   │   ├── database/       # Operaciones con BD
│   │   ├── middleware/     # Middleware de Express
│   │   ├── utils/          # Helpers y validators
│   │   └── index.js        # Punto de entrada
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes React
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # Cliente API (Axios)
│   │   ├── types/          # TypeScript types
│   │   ├── constants/      # Constantes de la aplicación
│   │   ├── utils/          # Helpers, formatters
│   │   ├── styles/         # Estilos globales
│   │   ├── App.tsx         # Componente raíz
│   │   └── main.tsx        # Punto de entrada
│   └── package.json
│
├── docs/                   # Documentación
├── .env.example
├── package.json            # Root monorepo
├── railway.json           # Configuración Railway
└── README.md
```

## Backend (Express.js)

### Entrada Principal
- **Archivo**: `backend/src/index.js`
- **Puerto**: 3001
- **Responsabilidad**: Inicializar Express, conectar BD, exponer APIs y servir frontend estático

### Estructura de Carpetas

#### `config/`
Configuraciones centralizadas:
- Database URLs
- OpenAI API keys
- Constantes de aplicación

#### `database/`
Conexiones y operaciones con bases de datos:
- `postgres.js` - Pool de PostgreSQL, CRUD operations
- `mongodb.js` - Conexión a MongoDB con Mongoose

#### `models/`
Schemas de Mongoose:
- Conversation - Conversaciones capturadas
- Metrics - Métricas históricas
- ConversationHistory, PerformanceHistory, HallucinationHistory

#### `services/`
Lógica de negocio:
- `openaiService.js` - Llamadas a OpenAI GPT
- `conversationService.js` - Procesamiento de conversaciones
- `metricsService.js` - Cálculo de métricas
- `storageService.js` - Fallback a almacenamiento en archivos

#### `controllers/`
Lógica de request/response:
- `metricsController.js`
- `chatController.js`
- `conversationController.js`
- `healthController.js`

#### `routes/`
Definición de rutas Express:
- `api.js` - Rutas /api/*
- `health.js` - Ruta /health
- `spa.js` - Fallback SPA

#### `middleware/`
Middleware de Express:
- CORS configuration
- Error handling
- Request logging

#### `utils/`
Funciones auxiliares:
- Validators
- Helpers
- Logging

### Flow de Request

```
Request HTTP
    ↓
CORS Middleware
    ↓
Logger Middleware
    ↓
Route Handler
    ↓
Controller (request validation)
    ↓
Service (business logic)
    ↓
Database / External API
    ↓
Response
```

## Frontend (React + Vite)

### Entrada Principal
- **Archivo**: `frontend/src/main.tsx`
- **Punto de monta**: `div#root` en `index.html`

### Estructura de Carpetas

#### `components/`
Componentes React organizados por función:
- `common/` - Componentes reutilizables (Header, StatusBar, MetricCard)
- `dashboard/` - Componentes específicos del dashboard
- `charts/` - Componentes de gráficos
- `status/` - Componentes de estado

#### `hooks/`
Custom React hooks:
- `useMetrics` - Obtiene métricas del backend
- `useBackendHealth` - Verifica salud del backend
- `useChartData` - Datos para gráficos
- `useApi` - Hook genérico para llamadas API

#### `services/`
Cliente API:
- `api.ts` - Cliente Axios centralizado
- Todos los métodos para comunicarse con el backend

#### `types/`
TypeScript types:
- Interfaces de respuestas API
- Modelos de dominio

#### `constants/`
Constantes de aplicación:
- URLs de API
- Strings de UI
- Configuración del frontend

#### `utils/`
Funciones auxiliares:
- Formatters (fechas, números)
- Validators (inputs)
- Helpers (transformaciones de datos)

### Build Output
- **Carpeta**: `frontend/dist`
- **Contenido**: HTML + CSS + JS compilado por Vite
- **Servida por**: Backend Express (express.static)

## Monorepo Root

### Scripts Principales
```json
{
  "install:all": "instala dependencias en backend y frontend",
  "build:all": "compila backend e instala, luego compila frontend",
  "start": "inicia el backend en puerto 3001",
  "dev:backend": "inicia backend con nodemon",
  "dev:frontend": "inicia frontend con Vite dev server"
}
```

### Railway Configuration
- **Archivo**: `railway.json`
- **Build Command**: `npm run build:all`
- **Start Command**: `npm run start`
- **Health Check**: `/health`
- **Puerto**: Automático (Railway asigna)

## Flujo de Datos

### Consulta de Métricas
```
Frontend (Dashboard.tsx)
    ↓ (fetch /api/metrics)
Backend Controller (metricsController)
    ↓
Service (metricsService)
    ↓
Database (MongoDB/PostgreSQL)
    ↓
Response JSON con métricas
    ↓
Frontend (actualiza estado con setMetrics)
```

### Captura de Conversación
```
Frontend (ConversationCaptureForm.tsx)
    ↓ (POST /api/capturar-conversacion)
Backend Controller (conversationController)
    ↓
Service (conversationService + openaiService)
    ↓
OpenAI GPT → Evaluación
    ↓
Database (guarda evaluación)
    ↓
Response con análisis
    ↓
Frontend (actualiza lista de conversaciones)
```

## Bases de Datos

### PostgreSQL
- **Propósito**: Producción, datos persistentes
- **Tabla**: `conversations` - todas las conversaciones capturadas
- **Configuración**: Via `POSTGRES_URL`

### MongoDB
- **Propósito**: Historial y métricas
- **Colecciones**: 
  - Conversation
  - Metrics
  - ConversationHistory
  - PerformanceHistory
  - HallucinationHistory
- **Configuración**: Via `MONGODB_URI`

### Fallback Storage
- **Propósito**: Cuando no hay BD disponible
- **Ubicación**: `backend/src/data/fallback-conversations.json`
- **Formato**: JSON plano

## Autenticación y Autorización

Actualmente el proyecto **no tiene autenticación**. Todos los endpoints son públicos.

Para agregar autenticación en el futuro:
1. Crear `backend/src/middleware/auth.js`
2. Agregar validación de tokens JWT
3. Actualizar controllers para verificar permisos

## Variables de Entorno

### Backend (`.env`)
```
OPENAI_API_KEY=          # API key de OpenAI
OPENAI_MODEL=gpt-4o-mini # Modelo a usar
PORT=3001               # Puerto del servidor
FRONTEND_URL=http://...  # URL del frontend
POSTGRES_URL=            # Conexión PostgreSQL
MONGODB_URI=             # Conexión MongoDB
NODE_ENV=production      # Entorno
```

### Frontend (`.env`)
```
VITE_API_BASE_URL=https://...  # URL del backend
VITE_ASSISTANT_NAME=NORA       # Nombre del asistente
VITE_DEBUG_MODE=false          # Debug logging
```

## Deployment

### En Railway
1. Root `package.json` ejecuta `npm run build:all`
2. Crea `frontend/dist`
3. Inicia backend con `npm run start`
4. Backend sirve frontend compilado desde `/`
5. APIs están disponibles en `/api/*`

### Verificación Post-Deploy
- ✅ GET `/health` retorna 200
- ✅ GET `/` retorna HTML del dashboard
- ✅ GET `/api/metrics` retorna métricas
- ✅ POST `/api/capturar-conversacion` funciona
- ✅ POST `/api/chat` funciona

## Testing

No hay tests automatizados actualmente. Próximas mejoras podrían incluir:
- Tests unitarios en services/ (Jest)
- Tests de integración API (Supertest)
- Tests en componentes React (Vitest + React Testing Library)

## Performance

### Optimizaciones Actuales
- Express.static sirve assets compilados con caché
- Axios en frontend con timeout configurado
- Índices en MongoDB en campos importantes
- Connection pooling en PostgreSQL

### Mejoras Futuras
- Implementar caching (Redis)
- Compresión de responses (gzip)
- Lazy loading en frontend
- Paginación en endpoints de consulta

## Seguridad

### Configuración Actual
- CORS habilitado para desarrollo
- NODE_ENV sensible en producción
- Variables de entorno para secrets
- SSL en PostgreSQL en producción

### Recomendaciones
- Agregar rate limiting
- Validar y sanitizar inputs
- Implementar autenticación
- Usar HTTPS en todas partes
- Auditoría de logs

## Mantenimiento

### Checklist Regular
- ✅ Verificar logs en Railway
- ✅ Monitorear uso de BD
- ✅ Actualizar dependencias npm
- ✅ Revisar health checks
- ✅ Validar métricas de error

---

**Última actualización**: Junio 2024
**Versión**: 1.0.0
