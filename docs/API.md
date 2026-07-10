# API Documentation - Nora Agents

## Base URL

**Production (Railway)**

Use the public domain assigned to the Railway service after deployment.

**Local Development**
```
http://localhost:3001
```

## Authentication

The internal dashboard, metrics, conversations, exports, and agent management require the administrative key configured in `AGENT_ADMIN_KEY`. Public agent responses expose only safe summary fields.

Send the key only in the administrative requests:

```http
X-Agent-Admin-Key: your-administrative-key
```

The browser stores this key only for the current tab session. AI endpoints are rate limited and may return `429` when the configured limit is exceeded.

---

## Endpoints

### Health Check

#### `GET /health`
Verifica que el servidor esté funcionando.

**Response** (200 OK)
```json
{
  "status": "ok",
  "message": "Nora API Backend is running",
  "timestamp": "2024-06-02T10:30:00Z"
}
```

---

### Metrics

#### `GET /api/metrics`
Obtiene métricas actuales del asistente.

**Query Parameters**
- `asistente` (optional): Nombre del asistente (default: "NORA")

**Response** (200 OK)
```json
{
  "conversations": {
    "total": 42,
    "today": 8,
    "averageDuration": 4.5,
    "averageSatisfaction": 4.2,
    "trend": 2.3
  },
  "performance": {
    "uptime": 99.8,
    "averageLatency": 245,
    "errorRate": 0.5,
    "requestsPerMinute": 42,
    "peakLatency": 890
  },
  "hallucination": {
    "rate": 2.3,
    "count": 1,
    "factualAccuracy": 97.7,
    "byTopic": {
      "Precisión": 4.2,
      "Claridad": 4.1,
      "Relevancia": 4.0,
      "Completitud": 3.9,
      "Utilidad": 4.3
    }
  },
  "lastUpdated": "2024-06-02T10:30:00Z"
}
```

---

### Agents

#### `GET /api/agents`
Lista los agentes configurados y su version activa.

**Response** (200 OK)
```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "id": "agent_nora",
      "slug": "nora",
      "name": "Nora",
      "description": "Asistente de viajes y turismo de CTM",
      "status": "published",
      "default_language": "es",
      "active_version": {
        "id": "agent_nora_v1",
        "version": 1,
        "system_prompt": "Eres Nora...",
        "model": "gpt-4o-mini",
        "temperature": 0.4,
        "max_tokens": 350
      }
    }
  ]
}
```

#### `POST /api/agents/admin/verify`
Valida la clave administrativa antes de habilitar la edicion visual.

**Required Header**
```http
X-Agent-Admin-Key: your-administrative-key
```

#### `POST /api/agents`
Crea un agente nuevo. Requiere `X-Agent-Admin-Key`. Si se envia `system_prompt`, `model`, `temperature` o `max_tokens`, se crea tambien su primera version activa.

**Request Body**
```json
{
  "name": "Nora Hoteles",
  "slug": "nora-hoteles",
  "description": "Agente para reservas y soporte hotelero",
  "status": "draft",
  "default_language": "es",
  "system_prompt": "Eres un agente experto en hoteles...",
  "model": "gpt-4o-mini",
  "temperature": 0.4,
  "max_tokens": 350
}
```

#### `PATCH /api/agents/:id`
Actualiza un agente existente. Requiere `X-Agent-Admin-Key`. Cuando cambia el prompt o parametros del modelo, el backend guarda una version nueva y la marca como activa.

#### `POST /api/agents/:id/test`
Prueba un agente sin guardar una conversacion. Requiere `X-Agent-Admin-Key`.

**Request Body**
```json
{
  "pregunta": "Necesito una recomendacion de hotel corporativo en Bogota"
}
```

**Response** (200 OK)
```json
{
  "status": "success",
  "respuesta": "Claro, puedo ayudarte...",
  "modelo": "gpt-4o-mini",
  "agent": {
    "id": "agent_nora",
    "name": "Nora"
  },
  "telemetry": {
    "provider": "openai",
    "latency_ms": 820,
    "tokens_input": 120,
    "tokens_output": 90
  }
}
```
---

### Conversations

#### `GET /api/conversations`
Obtiene lista de conversaciones capturadas.

**Query Parameters**
- `limit` (optional, default: 100): Número máximo de conversaciones a retornar

**Response** (200 OK)
```json
[
  {
    "id": "conv_1717328400000_abc123xyz",
    "asistente_nombre": "NORA",
    "pregunta": "¿Cuántos hoteles hay en Bogotá?",
    "respuesta": "Hay aproximadamente 450 hoteles registrados...",
    "usuario_nombre": "Juan Pérez",
    "usuario_email": "juan@example.com",
    "usuario_id": "user_123",
    "region": "Bogotá, Colombia",
    "status": "capturada",
    "score_promedio": 4.5,
    "timestamp": "2024-06-02T10:15:00Z",
    "createdAt": "2024-06-02T10:15:00Z",
    "updatedAt": "2024-06-02T10:15:00Z"
  }
]
```

#### `GET /api/conversations/:id`
Obtiene detalles de una conversación específica.

**Response** (200 OK)
```json
{
  "id": "conv_1717328400000_abc123xyz",
  "asistente_nombre": "NORA",
  "pregunta": "¿Cuántos hoteles hay en Bogotá?",
  "respuesta": "Hay aproximadamente 450 hoteles...",
  "usuario_nombre": "Juan Pérez",
  "usuario_email": "juan@example.com",
  "status": "capturada",
  "score_promedio": 4.5,
  "timestamp": "2024-06-02T10:15:00Z"
}
```

#### `GET /api/conversations/history?limit=24`
Obtiene histórico de conversaciones para gráficos.

**Response** (200 OK)
```json
[
  {
    "timestamp": "10:00",
    "count": 5,
    "satisfaction": 4.2
  },
  {
    "timestamp": "11:00",
    "count": 8,
    "satisfaction": 4.5
  }
]
```

---

### Chat & Processing

#### `POST /api/chat`
Genera una respuesta usando el agente activo o el agente indicado.

**Request Body**
```json
{
  "pregunta": "Cual es el mejor momento para visitar las Islas Galapagos?",
  "agent_id": "agent_nora",
  "usuario_id": "user_123",
  "usuario_email": "user@example.com",
  "region": "Ecuador"
}
```

**Response** (200 OK)
```json
{
  "status": "success",
  "respuesta": "El mejor momento es de junio a agosto...",
  "modelo": "gpt-4o-mini",
  "agent": {
    "id": "agent_nora",
    "name": "Nora",
    "slug": "nora"
  },
  "telemetry": {
    "provider": "openai",
    "latency_ms": 820,
    "tokens_input": 45,
    "tokens_output": 120
  }
}
```

#### `POST /api/capturar-conversacion`
Captura una conversación y la evalúa.

**Request Body**
```json
{
  "pregunta": "¿Dónde hospedarse en Cartagena?",
  "respuesta": "Cartagena tiene varias opciones de hospedaje...",
  "usuario_nombre": "María López",
  "usuario_email": "maria@example.com",
  "usuario_id": "user_456",
  "region": "Cartagena, Colombia"
}
```

**Response** (200 OK)
```json
{
  "id": "conv_1717328400000_abc123xyz",
  "asistente_nombre": "NORA",
  "pregunta": "¿Dónde hospedarse en Cartagena?",
  "respuesta": "Cartagena tiene varias opciones...",
  "usuario_nombre": "María López",
  "status": "capturada",
  "scores": {
    "precision": 4.5,
    "claridad": 4.3,
    "relevancia": 4.4,
    "completitud": 4.2,
    "utilidad": 4.6
  },
  "score_promedio": 4.4,
  "timestamp": "2024-06-02T10:35:00Z"
}
```

---

### Export

#### `GET /api/export/conversations?format=csv`
Exporta conversaciones en formato especificado.

**Query Parameters**
- `format` (required): `csv` o `json`
- `limit` (optional, default: 1000): Número de registros a exportar

**Response** (200 OK)
- **CSV**: `Content-Type: text/csv` - Descarga archivo CSV
- **JSON**: `Content-Type: application/json` - Array de conversaciones

**CSV Headers**
```
ID,Assistant,Question,Answer,User Name,User Email,Region,Status,Score,Timestamp
```

---

## Error Handling

### Error Response Format
```json
{
  "error": "Error message",
  "status": 400,
  "timestamp": "2024-06-02T10:30:00Z"
}
```

### Common Error Codes

| Code | Message | Meaning |
|------|---------|---------|
| 200 | OK | Solicitud exitosa |
| 400 | Bad Request | Parámetros inválidos |
| 404 | Not Found | Recurso no encontrado |
| 500 | Internal Server Error | Error del servidor |
| 503 | Service Unavailable | BD o API externa no disponible |

### Ejemplo de Error
```json
{
  "error": "Invalid conversation ID format",
  "status": 400,
  "timestamp": "2024-06-02T10:30:00Z"
}
```

---

## Rate Limiting

Currently, there is **no rate limiting** implemented. 

**Recommended for production**: Implement rate limiting to prevent abuse.

---

## CORS Policy

The backend accepts requests from configured origins:

**Development**
- `http://localhost:5173`
- `http://localhost:3000`
- `http://localhost:4173`

**Production**
- Configured via `ALLOWED_ORIGINS` environment variable
- Defaults to `FRONTEND_URL`

**Error**
```
CORS policy does not allow origin: ...
```

---

## Data Models

### Conversation
```typescript
{
  id: string;                    // Unique identifier
  asistente_nombre: string;      // Assistant name (default: "NORA")
  pregunta: string;              // User question
  respuesta: string;             // Assistant response
  usuario_nombre?: string;       // User name
  usuario_email?: string;        // User email
  usuario_id?: string;           // User ID
  region?: string;               // Geographic region
  status: string;                // capturada | procesada | archivada
  score_promedio: number;        // Average score (1-5)
  timestamp: Date;               // When conversation occurred
  createdAt: Date;              // Record creation
  updatedAt: Date;              // Last update
}
```

### Metrics
```typescript
{
  conversations: {
    total: number;              // Total conversations
    today: number;              // Today's conversations
    averageDuration: number;    // Minutes
    averageSatisfaction: number; // 1-5 scale
    trend: number;              // Trend percentage
  };
  performance: {
    uptime: number;             // Percentage
    averageLatency: number;     // Milliseconds
    errorRate: number;          // Percentage
    requestsPerMinute: number;  // RPM
    peakLatency: number;        // Milliseconds
  };
  hallucination: {
    rate: number;               // Percentage
    count: number;              // Number of hallucinations
    factualAccuracy: number;    // Percentage
    byTopic: Record<string, number>; // Topic-specific scores
  };
  lastUpdated: Date;
}
```

---

## Examples

### Curl Examples

**Get Health**
```bash
curl -X GET http://localhost:3001/health
```

**Get Metrics**
```bash
curl -X GET "http://localhost:3001/api/metrics?asistente=NORA"
```

**Capture Conversation**
```bash
curl -X POST http://localhost:3001/api/capturar-conversacion \
  -H "Content-Type: application/json" \
  -d '{
    "pregunta": "¿Dónde dormir?",
    "respuesta": "Hay varias opciones...",
    "usuario_nombre": "Juan",
    "usuario_email": "juan@example.com",
    "region": "Bogotá"
  }'
```

**Export as CSV**
```bash
curl -X GET "http://localhost:3001/api/export/conversations?format=csv" \
  -o conversations.csv
```

### JavaScript Examples

```javascript
// Get Metrics
const metrics = await fetch('http://localhost:3001/api/metrics')
  .then(r => r.json());

// Capture Conversation
const response = await fetch('http://localhost:3001/api/capturar-conversacion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pregunta: '¿Dónde hospedarse?',
    respuesta: 'Hay varias opciones...',
    usuario_nombre: 'María',
    usuario_email: 'maria@example.com',
    region: 'Cartagena'
  })
});
```

---

## Changelog

### v1.0.0 (Current)
- Initial API release
- Health check endpoint
- Metrics endpoint
- Conversations CRUD
- Chat endpoint
- Conversation capture with GPT evaluation
- Export functionality

---

**Last Updated**: June 2024
**Version**: 1.0.0
**Maintainer**: CTM Engineering Team
