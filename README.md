# Dashboard Nora - Sistema de Medición de Agente IA

Un dashboard profesional e intuitivo para medir y monitorear el rendimiento del agente virtual **Nora**. Construido con React + TypeScript + Vite.

## 🎯 Características

- **📊 Métricas de Conversación**: Total, hoy, duración promedio, satisfacción
- **⚙️ Rendimiento Técnico**: Uptime, latencia, tasa de errores, solicitudes por minuto
- **🧠 Análisis de Alucinación**: Tasa de alucinación, precisión factual, análisis por tema
- **📈 Gráficos en Tiempo Real**: Líneas, barras y gráficos circulares interactivos
- **🔄 Actualización en Vivo**: Conexión a API con WebSocket/polling
- **📱 Diseño Responsivo**: Funciona en desktop, tablet y móvil
- **🎨 Interfaz Moderna y Profesional**: Gradientes, animaciones suaves y tema coherente

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js 18+
- npm o yarn

### Instalación

1. **Navega a la carpeta del proyecto** (soluciona el problema de rutas con espacios):
```bash
# En PowerShell, usa la sintaxis apropiada:
Push-Location "C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents"
```

2. **Instala las dependencias**:
```bash
npm install
```

3. **Inicia el servidor de desarrollo**:
```bash
npm run dev
```

4. **Abre en el navegador**:
- URL: `http://localhost:5173`

## 📦 Estructura del Proyecto

```
src/
├── components/           # Componentes React reutilizables
│   ├── Dashboard.tsx    # Componente principal del dashboard
│   ├── MetricCard.tsx   # Tarjeta de métrica
│   ├── Chart.tsx        # Gráfico de líneas
│   ├── BarChartComponent.tsx  # Gráfico de barras
│   ├── PieChartComponent.tsx  # Gráfico circular
│   ├── StatusBar.tsx    # Barra de estado
│   └── Header.tsx       # Encabezado del dashboard
├── services/
│   └── api.ts           # Servicio para conectar con API
├── hooks/
│   ├── useMetrics.ts    # Hook para obtener métricas
│   └── useChartData.ts  # Hooks para datos de gráficos
├── types/
│   └── index.ts         # Tipos TypeScript
├── styles/
│   ├── Dashboard.css    # Estilos del dashboard
│   ├── Header.css       # Estilos del encabezado
│   ├── MetricCard.css   # Estilos de tarjetas
│   ├── Chart.css        # Estilos de gráficos
│   └── StatusBar.css    # Estilos de barras
├── App.tsx              # Componente raíz
├── App.css              # Estilos globales
├── main.tsx             # Punto de entrada
└── index.css            # Estilos base
```

## 🔌 Configuración de API

El dashboard se conecta a la API del agente Nora. Para configurar la URL de la API:

1. Abre [src/services/api.ts](src/services/api.ts)
2. Modifica la constante `API_BASE_URL`:

```typescript
const API_BASE_URL = 'https://tu-api-aqui.com';
```

### Endpoints Esperados

- `GET /api/metrics` - Métricas actuales
- `GET /api/conversations/history?limit=24` - Histórico de conversaciones
- `GET /api/performance/history?limit=24` - Histórico de rendimiento
- `GET /api/hallucinations/history?limit=7` - Histórico de alucinaciones
- `GET /api/conversations/:id` - Detalles de una conversación

### Datos de Prueba

El dashboard incluye datos de prueba (mock data) que se mostrarán si la API no está disponible. Perfecto para desarrollo y pruebas.

## 🎨 Personalización

### Cambiar Colores
Edita las variables CSS en [src/index.css](src/index.css):

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #27ae60;
  /* ... más colores */
}
```

### Ajustar Intervalo de Actualización
En [src/hooks/useMetrics.ts](src/hooks/useMetrics.ts):

```typescript
const { metrics } = useMetrics(60000, true); // 60 segundos
```

## 📊 Secciones del Dashboard

### 1. Métricas de Conversación
- Total de conversaciones
- Conversaciones hoy
- Duración promedio
- Satisfacción promedio
- Gráfico de conversaciones por hora

### 2. Rendimiento Técnico
- Uptime
- Latencia promedio
- Tasa de error
- Solicitudes por minuto
- Barras de estado del sistema
- Gráfico de rendimiento a lo largo del tiempo

### 3. Análisis de Alucinación
- Tasa de alucinación
- Alucinaciones detectadas
- Precisión factual
- Alucinaciones por día (gráfico)
- Alucinaciones por tema (gráfico circular)

### 4. Resumen General
- Salud general del sistema
- Conversaciones activas
- Problemas detectados

## 🛠️ Scripts Disponibles

```bash
# Desarrollo con HMR
npm run dev

# Compilar para producción
npm run build

# Vista previa de la compilación
npm run preview

# Verificar tipos TypeScript
npm run type-check

# Lint del código
npm run lint
```

## 📱 Responsividad

El dashboard es completamente responsivo con breakpoints en:
- **Desktop**: 1024px+
- **Tablet**: 768px - 1023px
- **Móvil**: < 768px

## 🔐 Seguridad

Asegúrate de:
- Usar HTTPS en producción
- Validar tokens de API
- Sanitizar datos de la API
- Implementar CORS apropiadamente

## 📚 Dependencias Principales

- **React 18**: Librería UI
- **TypeScript**: Tipado estático
- **Vite**: Build tool
- **Recharts**: Gráficos
- **Axios**: Cliente HTTP

## 🐛 Troubleshooting

### Error: "TOURIST is not recognized"
El problema es que la ruta contiene espacios. Solución:
1. Abre PowerShell
2. Navega con: `Push-Location "ruta\con\espacios"`
3. Luego ejecuta `npm run dev`

### El dashboard muestra "No hay datos"
- Verifica que la API esté corriendo
- Confirma la URL en `src/services/api.ts`
- Abre DevTools para ver errores de red

### Los gráficos no se ven correctamente
- Limpia el caché: `npm cache clean --force`
- Reinstala dependencias: `rm node_modules && npm install`

## 📄 Licencia

MIT

## 👨‍💻 Autor

Dashboard creado para medir y monitorear el agente Nora - Mayo 2026

---

**¡El dashboard está listo para usar!** 🎉

import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
