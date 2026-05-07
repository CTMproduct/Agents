# 🚀 Backend + Dashboard - Guía Rápida de Instalación

## Estructura Actual

```
Agents/
├── src/               ← Frontend React (Dashboard)
├── backend/           ← Backend Express (NUEVO)
├── .env               ← Config Frontend (actualizado)
└── backend/.env       ← Config Backend (con API key)
```

## 📋 Requisitos

- Node.js 16+ instalado
- npm

---

## ⚡ Pasos para Conectar Todo

### 1. Instalar dependencias del Backend

```bash
cd backend
npm install
```

### 2. Instalar dependencias del Frontend (si no las tienes)

```bash
cd ..
npm install
```

### 3. Ejecutar el Backend (Terminal 1)

```bash
cd backend
npm start
```

**Deberías ver**:
```
✅ Nora Backend running on http://localhost:3000
📝 POST /api/capturar-conversacion - Capture conversations
📊 GET /api/metrics - Get metrics
🏥 GET /health - Health check
```

### 4. Ejecutar el Frontend (Terminal 2)

```bash
npm run dev
```

**Deberías ver**:
```
VITE v4.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

---

## ✅ Verificar Conexión

### Opción A: Desde el Dashboard
1. Abre http://localhost:5173
2. Ve a la sección "Enviar conversación a Nora"
3. Llena el formulario y envía
4. Deberías ver la respuesta del backend

### Opción B: Desde la terminal (curl)

```bash
curl -X POST http://localhost:3000/api/capturar-conversacion \
  -H "Content-Type: application/json" \
  -d '{
    "asistente_nombre": "NORA",
    "pregunta": "¿Cuál es el mejor plan para Cartagena?",
    "respuesta": "El mejor plan es..."
  }'
```

### Opción C: Health Check

```bash
curl http://localhost:3000/health
```

---

## 🔗 Conexión OpenAI

El backend ahora usa tu API key para:
- Evaluar respuestas del asistente
- Calcular satisfacción automáticamente
- Detectar hallucinations (opcional, puedes expandir)

**API Key**: Ya está guardada en `backend/.env` (segura, no commitida)

---

## 📝 Endpoint Principal

### POST /api/capturar-conversacion

**Payload**:
```json
{
  "asistente_nombre": "NORA",
  "pregunta": "Pregunta del usuario",
  "respuesta": "Respuesta de Nora",
  "usuario_nombre": "Carlos",
  "usuario_email": "carlos@example.com",
  "usuario_id": "user_123",
  "region": "Nora"
}
```

**Respuesta**:
```json
{
  "status": "success",
  "mensaje": "Captura registrada correctamente",
  "data": { "conversationId": "conv_1234" },
  "score_promedio": 4.5
}
```

---

## 🎯 Otros Endpoints Disponibles

- `GET /api/metrics` - Métricas actuales
- `GET /api/conversations/history?limit=24` - Histórico de conversaciones
- `GET /api/performance/history?limit=24` - Histórico de rendimiento
- `GET /api/hallucinations/history?limit=7` - Histórico de alucinaciones
- `GET /api/conversations/:id` - Detalles de una conversación
- `GET /health` - Health check

---

## 🚀 Siguiente Paso: Producción

Cuando quieras desplegar:

1. **Backend**:
   - Despliega en Render, Railway, Vercel
   - Actualiza `backend/.env` con variables de entorno

2. **Frontend**:
   - Copia la URL pública del backend
   - Actualiza `VITE_API_BASE_URL` en `.env`
   - Despliega en Vercel, Netlify, etc.

3. **OpenAI Action**:
   - Actualiza `openapi/nora-action.json`
   - Reemplaza `https://YOUR_PUBLIC_BACKEND_URL` con la URL real
   - Conecta en ChatGPT

---

## 🐛 Troubleshooting

**Error: "Cannot find module 'express'"**
→ Ejecuta `npm install` en `/backend`

**Error: "CORS error"**
→ El backend ya tiene CORS habilitado. Si persiste, verifica que el backend esté en `http://localhost:3000`

**Error: "OPENAI_API_KEY not found"**
→ Asegúrate de que `backend/.env` tiene la API key

---

¡Listo! Ahora todo está conectado localmente. 🎉
