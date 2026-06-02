# 🚀 QUICK START GUIDE - Dashboard Nora

**Acceso Inmediato:** https://agents-production-5abe.up.railway.app

---

## ⚡ 5 PASOS PARA EMPEZAR

### 1️⃣ Abre el Dashboard
```
URL: https://agents-production-5abe.up.railway.app
Espera a que cargue (2-3 segundos)
```

### 2️⃣ Verifica que Backend está Online
```
Deberías ver:
✅ "Backend Online" en la esquina superior derecha
✅ "Última actualización: [timestamp]"
✅ "Actualización en tiempo real: ON"
```

### 3️⃣ Envía tu Primera Conversación
```
Sección: "Enviar conversación a Nora"

OPCIÓN A - Sin respuesta (Backend genera):
  Pregunta: "¿Cuál es la mejor playa en Colombia?"
  Usuario: "Tu nombre"
  Email: "tu@email.com"
  Respuesta: (dejar vacío)
  → Click "Enviar"

OPCIÓN B - Con respuesta (solo guarda):
  Pregunta: "¿Cuál es la mejor playa en Colombia?"
  Respuesta: "La mejor playa es..."
  Usuario: "Tu nombre"
  Email: "tu@email.com"
  → Click "Enviar"
```

### 4️⃣ Verifica que Se Guardó
```
Sección: "Conversaciones Capturadas"

Deberías ver:
✅ Tu conversación en la tabla
✅ Fecha y hora
✅ Tu nombre como usuario
✅ La pregunta y respuesta
✅ Puntuación (⭐)
```

### 5️⃣ Verifica que Las Métricas Subieron
```
Sección: "Métricas de Conversación"

Deberías ver:
✅ "Total de Conversaciones: 1" (incrementó)
✅ "Hoy: 1" (incrementó)
✅ "Satisfacción Promedio: 4.5" (actualizado)
```

---

## 🎯 CASOS DE USO

### Caso 1: Evaluar Respuesta de Nora
```
1. Usuario hace pregunta a Nora en ChatGPT
2. Nora responde
3. Tú copias la pregunta y respuesta
4. Las pegas en el formulario del dashboard
5. Click "Enviar"
6. Dashboard actualiza automáticamente
→ Se registra en métricas
```

### Caso 2: Capturar Automáticamente (GPT Action)
```
1. Configura el GPT Nora con OpenAPI Action
2. Nora responde una pregunta
3. Automáticamente Nora llama la acción
4. La conversación se captura en el dashboard
5. Métricas se actualizan sin intervención manual
→ Captura totalmente automática
```

### Caso 3: Monitorear Desempeño
```
1. Abre dashboard en segundo monitor o pestaña
2. Mientras testeas Nora, mantén el dashboard visible
3. Verás en tiempo real:
   - Total de conversaciones
   - Satisfacción promedio
   - Análisis de alucinaciones
   - Temas de preguntas
→ Monitoreo en tiempo real
```

---

## 📊 SECCIONES DEL DASHBOARD

### 💬 Métricas de Conversación
```
┌─────────────────────────────────────┐
│ Total de Conversaciones: 1          │
│ Hoy: 1                              │
│ Duración Promedio: 4.5 min          │
│ Satisfacción Promedio: 4.5 / 5      │
└─────────────────────────────────────┘

Muestra:
✅ Cantidad de conversaciones capturadas
✅ Datos del día actual
✅ Promedio de satisfacción
✅ Duración de conversaciones
```

### ⚙️ Rendimiento Técnico
```
┌─────────────────────────────────────┐
│ Uptime: 99.8%                       │
│ Latencia Promedio: 245 ms           │
│ Tasa de Error: 0%                   │
│ Solicitudes/min: 120                │
└─────────────────────────────────────┘

Muestra:
✅ Disponibilidad del servidor
✅ Velocidad de respuesta
✅ Errores
✅ Carga del sistema
```

### 🧠 Análisis de Alucinación
```
┌─────────────────────────────────────┐
│ Tasa de Alucinación: 0%             │
│ Alucinaciones Detectadas: 0         │
│ Precisión Factual: 100%             │
└─────────────────────────────────────┘

Muestra:
✅ Qué tan confiable es Nora
✅ Errores o confabulaciones
✅ Precisión general
✅ Análisis por tema (gráfica)
```

### 💬 Conversaciones Capturadas
```
Tabla con columnas:
┌──────┬──────┬──────────┬──────┬──────┐
│Fecha │Usuario│ Pregunta │Resp. │ Score│
├──────┼──────┼──────────┼──────┼──────┤
│21:30 │Juan  │¿Playas?  │[...]│  ⭐⭐⭐ │
│21:31 │Maria │¿Tayrona? │[...]│  ⭐⭐⭐ │
└──────┴──────┴──────────┴──────┴──────┘

Filtrable y ordenable
```

---

## ✨ CARACTERÍSTICAS PRINCIPALES

### Auto-Refresh
```
Las métricas se actualizan automáticamente cada 30 segundos
Presiona "Actualizar" para refrescar manualmente
```

### Búsqueda y Filtro
```
Sección "Conversaciones Capturadas"
- Busca por palabra clave
- Ordena por fecha o puntuación
- Filtra por usuario
```

### Exportación
```
Botones en "Conversaciones Capturadas":
📊 CSV - Para Excel
📋 JSON - Para análisis
```

---

## 🔧 TROUBLESHOOTING RÁPIDO

| Problema | Solución |
|----------|----------|
| Backend aparece offline | Espera 5 segundos y presiona Actualizar |
| No se guarda conversación | Verifica que todos los campos tengan datos |
| Métricas no suben | Presiona Actualizar arriba a la derecha |
| Gráficas en blanco | Captura más conversaciones (mínimo 2) |
| Email no se guarda | Email es opcional, puede estar vacío |

---

## 🌍 ENDPOINTS ÚTILES

Si necesitas acceder directamente (sin UI):

```bash
# Obtener métricas actuales
curl https://agents-production-5abe.up.railway.app/api/metrics

# Obtener lista de conversaciones
curl https://agents-production-5abe.up.railway.app/api/conversations?limit=10

# Verificar que backend está online
curl https://agents-production-5abe.up.railway.app/health
```

---

## 💾 DATOS QUE SE GUARDAN

Cada conversación capturada incluye:

```json
{
  "id": "conv_1780435852635_2d8ujj7hi",
  "pregunta": "Tu pregunta aquí",
  "respuesta": "Respuesta de Nora",
  "usuario_nombre": "Tu nombre",
  "usuario_email": "tu@email.com",
  "usuario_id": "identificador único",
  "asistente_nombre": "NORA",
  "region": "Nora",
  "status": "capturada",
  "score_promedio": 4.5,
  "timestamp": "2026-06-02T21:30:52.635Z"
}
```

---

## 📱 VISTA MÓVIL

El dashboard funciona en móvil, aunque es mejor en desktop debido al tamaño de las gráficas.

**Desktop:** Visualización óptima  
**Tablet:** Buena visualización  
**Móvil:** Funciona, pero comprimido

---

## 🎓 EJEMPLO COMPLETO

### Escenario Real:

```
1. Abres dashboard
2. Ves:
   - Total: 0
   - Uptime: 99.8%
   - Hoy: 0

3. Haces pregunta a Nora:
   "¿Cuál es la mejor época para viajar a Cartagena?"

4. Nora responde:
   "Octubre a diciembre es la mejor época..."

5. Copias pregunta y respuesta al dashboard
6. Presionas "Enviar"

7. Dashboard ahora muestra:
   - Total: 1 (incrementó)
   - Hoy: 1 (incrementó)
   - Satisfacción: 4.5 (actualizado)
   - Tu conversación en la tabla
   - "General Info" en análisis de temas
   - Precisión: 100%

8. Repites 5-7 varios veces

9. Después de 10 conversaciones:
   - Gráficas se llenan
   - Análisis se profundiza
   - Puedes ver tendencias
```

---

## 🚀 PRÓXIMO NIVEL

### Integrar GPT Nora (Opcional)

Si quieres captura totalmente automática:

1. Ve a tu GPT personalizado en ChatGPT
2. Agrega una "Action" con:
   - URL: `https://agents-production-5abe.up.railway.app`
   - Schema: El archivo `openapi/nora-action.json`
3. Instrúyele al GPT: "Después de responder, llama la acción captureConversation"
4. Prueba una conversación
5. Aparecerá automáticamente en el dashboard

---

## 📞 AYUDA RÁPIDA

**¿Cómo sé si funciona?**
- ✅ Backend online (verde)
- ✅ Total de conversaciones incrementa
- ✅ Satisfacción promedio se actualiza
- ✅ Conversación aparece en la tabla

**¿Dónde se guardan los datos?**
- En PostgreSQL (o Memory Storage como fallback)
- Persistidos mientras el servidor esté online

**¿Puedo ver historial?**
- Sí, en "Conversaciones Capturadas"
- Puedes buscar, filtrar y exportar

**¿Qué pasa si pierdo la conversación?**
- No pasa nada, está guardada en la base de datos
- Puedes verla en cualquier momento en el dashboard

---

## ✅ CHECKLIST INICIAL

Cuando abras el dashboard por primera vez:

- [ ] Backend aparece "Online"
- [ ] Se ve "Última actualización: [timestamp]"
- [ ] Total de Conversaciones = 0
- [ ] Uptime = 99.8%
- [ ] Puedo ver las secciones:
  - [ ] Métricas de Conversación
  - [ ] Rendimiento Técnico
  - [ ] Análisis de Alucinación
  - [ ] Conversaciones Capturadas
- [ ] Puedo capturar una conversación
- [ ] Total incrementa a 1
- [ ] Satisfacción se actualiza

---

**¡LISTO! Ya está todo funcionando. ¡A capturar conversaciones!** 🎉
