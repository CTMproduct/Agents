# 🔌 API Integration Guide - Dashboard Nora

## Overview

Este documento describe cómo integrar tu API del agente Nora con el dashboard.

## Configuración de Base

### 1. URL de la API

Archivo: `src/services/api.ts`

```typescript
const API_BASE_URL = 'https://tu-dominio.com/api';
```

### 2. Autenticación (Opcional)

Si tu API requiere autenticación, modifica el client en `src/services/api.ts`:

```typescript
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.VITE_API_TOKEN}`,
  },
});
```

Y crea un archivo `.env`:

```
VITE_API_BASE_URL=https://tu-api.com
VITE_API_TOKEN=tu_token_aqui
```

## Endpoints Requeridos

### 1. GET /api/metrics

**Descripción**: Obtiene las métricas actuales del agente

**Response**:
```json
{
  "conversations": {
    "total": 1250,
    "today": 45,
    "averageDuration": 4.5,
    "averageSatisfaction": 4.2,
    "trend": 12.5
  },
  "performance": {
    "uptime": 99.8,
    "averageLatency": 245,
    "errorRate": 0.5,
    "requestsPerMinute": 120,
    "peakLatency": 890
  },
  "hallucination": {
    "rate": 2.3,
    "count": 28,
    "factualAccuracy": 97.7,
    "byTopic": {
      "Travel Info": 1.2,
      "Flight Details": 3.5,
      "Hotel Booking": 2.1,
      "General Info": 1.8
    }
  }
}
```

**Campos**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `conversations.total` | number | Total de conversaciones históricas |
| `conversations.today` | number | Conversaciones en el día actual |
| `conversations.averageDuration` | number | Duración promedio en minutos |
| `conversations.averageSatisfaction` | number | Satisfacción promedio (0-5) |
| `conversations.trend` | number | Porcentaje de cambio vs. día anterior |
| `performance.uptime` | number | Disponibilidad en porcentaje (0-100) |
| `performance.averageLatency` | number | Latencia promedio en milisegundos |
| `performance.errorRate` | number | Porcentaje de errores (0-100) |
| `performance.requestsPerMinute` | number | Solicitudes por minuto |
| `performance.peakLatency` | number | Latencia máxima en ms |
| `hallucination.rate` | number | Porcentaje de alucinaciones (0-100) |
| `hallucination.count` | number | Número total de alucinaciones |
| `hallucination.factualAccuracy` | number | Precisión factual (0-100) |
| `hallucination.byTopic` | object | Alucinaciones desglosadas por tema |

---

### 2. POST /api/capturar-conversacion

**Descripción**: Captura una conversación enviada por Nora hacia el backend.

**Request Body**:
```json
{
  "asistente_nombre": "NORA",
  "pregunta": "Necesito ayuda con mi reserva",
  "respuesta": "Claro, te ayudo con tu reserva.",
  "usuario_nombre": "Natalia Gómez",
  "usuario_email": "natagomez@gmail.com",
  "usuario_id": "",
  "region": "Nora"
}
```

**Response**:
```json
{
  "status": "success",
  "score_promedio": 4.5,
  "usuario_email": "natagomez@gmail.com",
  "asistente": "NORA",
  "mensaje": "Conversación evaluada y guardada ✅"
}
```

**Campos**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `asistente_nombre` | string | Debe ser siempre `NORA` |
| `pregunta` | string | Pregunta completa del usuario |
| `respuesta` | string | Respuesta completa del asistente |
| `usuario_nombre` | string | Nombre del usuario si existe |
| `usuario_email` | string | Email del usuario si existe |
| `usuario_id` | string | ID del usuario si existe |
| `region` | string | Debe ser siempre `Nora` |
| `status` | string | Resultado de la captura |
| `score_promedio` | number | Puntaje promedio devuelto por el servicio |
| `mensaje` | string | Mensaje descriptivo del backend |

---

### 3. GET /api/conversations/history?limit=24

**Descripción**: Histórico de conversaciones (por horas)

**Query Parameters**:
- `limit` (number): Número de registros (default: 24)

**Response**:
```json
[
  {
    "timestamp": "14:00",
    "count": 32,
    "satisfaction": 4.5
  },
  {
    "timestamp": "15:00",
    "count": 28,
    "satisfaction": 4.2
  }
]
```

**Campos**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `timestamp` | string | Hora o fecha (formato flexible) |
| `count` | number | Número de conversaciones |
| `satisfaction` | number | Satisfacción promedio (0-5) |

---

### 3. GET /api/performance/history?limit=24

**Descripción**: Histórico de rendimiento (por horas)

**Query Parameters**:
- `limit` (number): Número de registros (default: 24)

**Response**:
```json
[
  {
    "timestamp": "14:00",
    "latency": 245,
    "errors": 2
  },
  {
    "timestamp": "15:00",
    "latency": 198,
    "errors": 1
  }
]
```

**Campos**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `timestamp` | string | Hora o fecha |
| `latency` | number | Latencia en milisegundos |
| `errors` | number | Número de errores |

---

### 4. GET /api/hallucinations/history?limit=7

**Descripción**: Histórico de alucinaciones (por días)

**Query Parameters**:
- `limit` (number): Número de días (default: 7)

**Response**:
```json
[
  {
    "date": "2024-05-01",
    "rate": 2.3,
    "count": 5
  },
  {
    "date": "2024-05-02",
    "rate": 1.8,
    "count": 4
  }
]
```

**Campos**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `date` | string | Fecha (formato YYYY-MM-DD) |
| `rate` | number | Porcentaje de alucinaciones |
| `count` | number | Número de alucinaciones detectadas |

---

### 5. GET /api/conversations/:id (Opcional)

**Descripción**: Detalles de una conversación específica

**Response**:
```json
{
  "id": "conv_123",
  "startTime": "2024-05-07T14:30:00Z",
  "endTime": "2024-05-07T14:35:00Z",
  "duration": 5,
  "messages": 15,
  "satisfaction": 4.5,
  "topic": "Travel Info",
  "hallucinations": 0,
  "summary": "Cliente preguntó sobre vuelos a Paris..."
}
```

---

## OpenAI / ChatGPT Action

Para que el action de ChatGPT pueda llamar directamente a tu backend, publica un esquema OpenAPI público y apunta el `server.url` a la URL accesible desde internet.

- Si estás en desarrollo local con prueba rápida, usa `ngrok` para exponer tu backend:
  - `ngrok http 3000`
  - Copia la URL pública `https://xxxxxx.ngrok.io`
  - Actualiza `openapi/nora-action.json` en `servers[0].url`
- Para producción o pruebas estables, usa un host como Render, Vercel o Railway.
  - `https://mi-backend-nora.onrender.com`

### Esquema de acción disponible

- Archivo: `openapi/nora-action.json`
- Endpoint: `POST /api/capturar-conversacion`
- Content-Type: `application/json`
- Payload mínimo requerido:
  - `asistente_nombre` = `NORA`
  - `pregunta`
  - `respuesta`
  - `region` = `Nora`

### Ejemplo de payload

```json
{
  "asistente_nombre": "NORA",
  "pregunta": "¿Cuál es el mejor plan de viaje para Cartagena?",
  "respuesta": "El mejor plan es...",
  "usuario_nombre": "Carlos",
  "usuario_email": "carlos@example.com",
  "usuario_id": "user_123",
  "region": "Nora",
  "status": "capturada",
  "score_promedio": 4.7,
  "mensaje": "Captura registrada con éxito"
}
```

> Nota: el action debe usar la URL pública de tu backend, no `localhost`.

---

## Manejo de Errores

El dashboard maneja automáticamente:

```typescript
// Si la API no responde, muestra datos de prueba
try {
  const data = await apiClient.get('/api/metrics');
  return data.data;
} catch (error) {
  console.error('Error fetching metrics:', error);
  return generateMockMetrics(); // Datos de prueba
}
```

Para agregar manejo personalizado, edita `src/services/api.ts`.

## CORS (Cross-Origin Resource Sharing)

Si tu dashboard y API están en dominios diferentes, configura CORS:

### Backend (Node.js/Express):
```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

### Backend (Python/FastAPI):
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Actualizaciones en Tiempo Real (WebSocket - Futuro)

Actualmente el dashboard usa polling cada 30 segundos.

Para implementar WebSocket:

1. Edita `src/services/api.ts`
2. Agrega conexión WebSocket:

```typescript
const socket = io('https://tu-api.com', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.on('metrics:update', (data) => {
  setMetrics(data);
});
```

3. Instala: `npm install socket.io-client`

---

## Testing

### Mockear API para desarrollo:

```typescript
// Reemplazar en apiService.getMetrics():
async getMetrics(): Promise<AgentMetrics> {
  // Comentar esto:
  // const response = await apiClient.get('/api/metrics');

  // Usar esto en su lugar:
  return generateMockMetrics();
}
```

### Verificar conexión:

Abre DevTools (F12) → Network → Refresca → Busca `/api/metrics`

---

## Ejemplos de Implementación

### Backend Node.js/Express:

```javascript
app.get('/api/metrics', async (req, res) => {
  const metrics = await db.query('SELECT * FROM metrics ORDER BY created_at DESC LIMIT 1');
  res.json(metrics[0]);
});

app.get('/api/conversations/history', async (req, res) => {
  const limit = req.query.limit || 24;
  const history = await db.query(`
    SELECT DATE_FORMAT(created_at, '%H:%i') as timestamp, 
           COUNT(*) as count, 
           AVG(satisfaction) as satisfaction
    FROM conversations
    WHERE created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
    GROUP BY HOUR(created_at)
  `, [limit]);
  res.json(history);
});
```

### Backend Python/FastAPI:

```python
from fastapi import FastAPI
from datetime import datetime, timedelta

@app.get("/api/metrics")
async def get_metrics():
    metrics = await db.get_metrics_latest()
    return metrics

@app.get("/api/conversations/history")
async def get_conversation_history(limit: int = 24):
    history = await db.get_conversation_history(hours=limit)
    return history
```

---

## Variables de Entorno

Crea archivo `.env` en la raíz del proyecto:

```env
VITE_API_BASE_URL=https://api.ejemplo.com
VITE_REFRESH_INTERVAL=30000
VITE_ENABLE_REALTIME=true
```

Acceder desde React:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

---

## Rate Limiting

Para proteger tu API, implementa rate limiting:

### Con express-rate-limit:
```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite 100 requests por ventana
});

app.use('/api/', limiter);
```

---

## Caché (Opcional)

Para mejorar rendimiento:

```typescript
const cache = new Map();
const CACHE_TTL = 60000; // 1 minuto

async getMetrics() {
  const cached = cache.get('metrics');
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await apiClient.get('/api/metrics');
  cache.set('metrics', { data: data.data, time: Date.now() });
  return data.data;
}
```

---

## Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| 404 Not Found | Endpoint no existe | Verifica URL y ruta |
| 401 Unauthorized | Falta autenticación | Agrega token en headers |
| 500 Server Error | Error en backend | Revisa logs del servidor |
| CORS error | Headers incorrectos | Configura CORS en backend |
| Datos vacíos | API sin datos | Genera datos de prueba primero |

---

## Conclusión

Siguiendo esta guía, tu dashboard estará completamente integrado con tu API Nora en minutos. ¡Disfruta monitoreando tu agente IA en tiempo real!

Para preguntas o problemas, revisa el código en `src/services/api.ts`.
