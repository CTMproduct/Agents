# 🎯 Dashboard Nora - Resumen del Proyecto

## 📊 ¿Qué se creó?

Un **dashboard profesional, intuitivo y moderno** para medir y monitorear en tiempo real el rendimiento del agente virtual **Nora**.

### Características Principales:

```
✅ Métricas de Conversación
   - Total de conversaciones
   - Conversaciones de hoy
   - Duración promedio
   - Satisfacción promedio
   - Gráfico de tendencias

✅ Rendimiento Técnico
   - Uptime del sistema
   - Latencia promedio
   - Tasa de errores
   - Solicitudes por minuto
   - Barras de estado

✅ Análisis de Alucinación
   - Tasa de alucinación
   - Alucinaciones detectadas
   - Precisión factual
   - Análisis por tema
   - Gráficos de tendencia

✅ Interfaz Moderna
   - Diseño responsivo (móvil, tablet, desktop)
   - Gráficos interactivos
   - Actualizaciones en tiempo real
   - Colores y animaciones profesionales
```

---

## 📁 Estructura de Carpetas

```
Agents/
├── 📄 QUICK-START.md              ← EMPIEZA AQUI (Guía en español)
├── 📄 README.md                   ← Documentación técnica completa
├── 📄 API-INTEGRATION.md          ← Guía de integración con API
├── 📄 DEVELOPMENT.md              ← Notas para desarrolladores
├── 🎯 start-dashboard.bat         ← EJECUTA ESTO (Windows)
├── 🎯 start-dashboard.sh          ← Ejecuta esto (Mac/Linux)
├── .env.example                   ← Variables de entorno
├── package.json                   ← Dependencias npm
├── vite.config.ts                 ← Config de Vite
├── tsconfig.json                  ← Config de TypeScript
│
├── 📁 src/
│   ├── 📁 components/             ← Componentes React
│   │   ├── Dashboard.tsx          ← Página principal
│   │   ├── Header.tsx             ← Encabezado
│   │   ├── MetricCard.tsx         ← Tarjeta de métrica
│   │   ├── Chart.tsx              ← Gráfico de líneas
│   │   ├── BarChartComponent.tsx  ← Gráfico de barras
│   │   ├── PieChartComponent.tsx  ← Gráfico circular
│   │   └── StatusBar.tsx          ← Barra de estado
│   │
│   ├── 📁 services/               ← Servicios (API, etc)
│   │   └── api.ts                 ← Cliente HTTP (Axios)
│   │
│   ├── 📁 hooks/                  ← Hooks personalizados
│   │   ├── useMetrics.ts          ← Hook para métricas
│   │   └── useChartData.ts        ← Hooks para gráficos
│   │
│   ├── 📁 types/                  ← Tipos TypeScript
│   │   └── index.ts               ← Definiciones de tipos
│   │
│   ├── 📁 styles/                 ← Estilos CSS
│   │   ├── Dashboard.css          ← Estilos del dashboard
│   │   ├── Header.css             ← Estilos del encabezado
│   │   ├── MetricCard.css         ← Estilos de tarjetas
│   │   ├── Chart.css              ← Estilos de gráficos
│   │   └── StatusBar.css          ← Estilos de barras
│   │
│   ├── App.tsx                    ← Componente raíz
│   ├── App.css                    ← Estilos de App
│   ├── main.tsx                   ← Punto de entrada
│   └── index.css                  ← Estilos globales
│
├── 📁 public/                     ← Archivos estáticos
├── 📁 dist/                       ← Build para producción
└── 📁 node_modules/               ← Dependencias instaladas
```

---

## 🔧 Tecnologías Utilizadas

| Tecnología | Versión | Propósito |
|------------|---------|----------|
| **React** | 18+ | Librería de UI |
| **TypeScript** | 5+ | Tipado estático |
| **Vite** | 5+ | Build tool (rápido) |
| **Recharts** | Latest | Gráficos interactivos |
| **Axios** | Latest | Cliente HTTP |
| **CSS3** | - | Estilos profesionales |

---

## 🚀 Cómo Usar

### Opción 1: Doble Clic (Más Fácil)
1. Ve a la carpeta del proyecto
2. Busca: `start-dashboard.bat`
3. Haz doble clic
4. ¡Listo! Se abrirá automáticamente

### Opción 2: PowerShell
```powershell
Push-Location "C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents"
npm run dev
```

### Opción 3: Terminal (Linux/Mac)
```bash
cd ~/Documents/Agents
npm run dev
```

El dashboard estará en: **http://localhost:5173**

---

## 📊 Secciones del Dashboard

### 1️⃣ Encabezado (Header)
- Logo del dashboard
- Hora de última actualización
- Botón para actualizar datos manualmente
- Toggle de actualización en tiempo real

### 2️⃣ Métrica de Conversación
- 4 tarjetas con información clave
- Gráfico de conversaciones vs satisfacción por hora
- Información visual clara y fácil de entender

### 3️⃣ Rendimiento Técnico
- 4 tarjetas con métricas de sistema
- 3 barras de estado (disponibilidad, precisión, estabilidad)
- Gráfico de latencia vs errores a lo largo del tiempo

### 4️⃣ Análisis de Alucinación
- 3 tarjetas con datos de alucinación
- Gráfico de alucinaciones por día
- Gráfico circular de alucinaciones por tema

### 5️⃣ Resumen General
- Salud general del sistema
- Conversaciones activas
- Indicador de problemas

---

## 🎨 Diseño Profesional

```
Colores:
🟣 Púrpura (#667eea) - Principal
🟣 Púrpura Oscuro (#764ba2) - Secundario
🟢 Verde (#27ae60) - Éxito
🟡 Naranja (#f39c12) - Advertencia
🔴 Rojo (#e74c3c) - Error

Layout:
- Responsive (funciona en cualquier pantalla)
- Gradientes suaves
- Animaciones elegantes
- Sombras profesionales
```

---

## 🔌 Integración con API

Por defecto, el dashboard se conecta a:
```
https://ctm-analyzer-backend.onrender.com
```

Para cambiar, edita:
- `src/services/api.ts` → `API_BASE_URL`

Consulta **API-INTEGRATION.md** para especificaciones completas.

---

## 📊 Datos de Prueba

Si tu API no está disponible, el dashboard mostrará **datos de prueba** automáticamente. Esto es perfecto para:
- Desarrollo local
- Demostración
- Testing de UI

Cuando conectes tu API, los datos reales aparecerán automáticamente.

---

## ⚙️ Configuración

### Variables de Entorno (.env)
```
VITE_API_BASE_URL=https://tu-api.com
VITE_REFRESH_INTERVAL=30000
VITE_ENABLE_REALTIME=true
```

### Cambiar Colores
Edita: `src/index.css`

### Cambiar Velocidad de Actualización
Edita: `src/hooks/useMetrics.ts`

---

## 🛠️ Comandos npm

```bash
npm run dev       # Desarrollo (con HMR)
npm run build     # Compilar para producción
npm run preview   # Ver compilación
npm run type-check # Verificar tipos TypeScript
npm run lint      # Revisar código
npm install       # Instalar dependencias
```

---

## 📈 Métricas del Dashboard

### Conversaciones
- **Total**: Suma de todas las conversaciones
- **Hoy**: Conversaciones del día actual
- **Duración**: Promedio en minutos
- **Satisfacción**: Puntuación 0-5
- **Tendencia**: % cambio vs día anterior

### Rendimiento
- **Uptime**: % de tiempo disponible (meta: >99%)
- **Latencia**: Tiempo de respuesta en ms (meta: <300ms)
- **Errores**: % de solicitudes fallidas (meta: <1%)
- **RPM**: Solicitudes por minuto

### Alucinación
- **Tasa**: % de respuestas incorrectas (meta: <2%)
- **Precisión**: % de respuestas correctas (meta: >95%)
- **Por tema**: Desglose por categoría
- **Detectadas**: Número total

---

## 🎯 Estados del Sistema

El dashboard usa colores para indicar estado:

```
🟢 VERDE (BUENO)
   - Uptime: >95%
   - Latencia: <300ms
   - Errores: <1%
   - Alucinación: <1%

🟡 AMARILLO (ADVERTENCIA)
   - Uptime: 85-95%
   - Latencia: 300-500ms
   - Errores: 1-3%
   - Alucinación: 1-3%

🔴 ROJO (CRÍTICO)
   - Uptime: <85%
   - Latencia: >500ms
   - Errores: >3%
   - Alucinación: >3%
```

---

## 💡 Tips para Sacar el Máximo

1. **Actualización Manual**: Haz clic en "🔄 Actualizar" cuando quieras datos frescos
2. **Desactiva Actualización**: Si quieres pausar, desactiva el toggle "Actualización en tiempo real"
3. **DevTools**: Abre F12 → Console para ver logs de debugging
4. **Fullscreen**: Presiona F11 para pantalla completa
5. **Gráficos**: Pasa mouse sobre gráficos para ver valores exactos

---

## 📱 Responsividad

```
🖥️ Desktop (1024px+)
   - Todas las métricas en grid
   - Gráficos lado a lado
   - Barras de estado expandidas

📱 Tablet (768px-1023px)
   - Métrica: 2 columnas
   - Gráficos apilados
   - Optimizado para toque

📱 Móvil (<768px)
   - Métrica: 1 columna
   - Gráficos a pantalla completa
   - Fuente más grande
```

---

## ✨ Próximas Mejoras Posibles

- [ ] Exportar reportes PDF
- [ ] Historial de alertas
- [ ] Dark mode
- [ ] Comparación de períodos
- [ ] Análisis predictivo
- [ ] Integración Slack/Teams
- [ ] Descarga de datos CSV
- [ ] Personalización de widgets

---

## 📞 Archivos de Referencia

| Archivo | Propósito |
|---------|----------|
| **QUICK-START.md** | Guía rápida en español (EMPIEZA AQUI) |
| **README.md** | Documentación técnica completa |
| **API-INTEGRATION.md** | Especificaciones de API |
| **DEVELOPMENT.md** | Notas para desarrolladores |

---

## 🎉 ¡LISTO!

Tu dashboard Nora está **100% operativo** con:
- ✅ Interfaz profesional
- ✅ Gráficos interactivos
- ✅ Actualización en tiempo real
- ✅ Datos de prueba incluidos
- ✅ Documentación completa

**Disfruta monitoreando tu agente Nora!** 📊🚀
