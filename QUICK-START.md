# 📊 GUÍA DE INSTALACIÓN Y USO - Dashboard Nora

## ✨ ¿Qué es este Dashboard?

Un **dashboard profesional e intuitivo** para medir y monitorear el rendimiento del agente virtual Nora. Muestra en tiempo real:

- 📞 **Métricas de Conversación**: Total, hoy, duración, satisfacción
- ⚙️ **Rendimiento Técnico**: Uptime, latencia, errores
- 🧠 **Análisis de Alucinación**: Tasa, precisión, análisis por tema
- 📈 **Gráficos Interactivos**: Visualización profesional de datos

---

## 🚀 INSTALACIÓN RÁPIDA (Windows)

### Paso 1: Abre la carpeta del proyecto
```
C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents
```

### Paso 2: Ejecuta el script de inicio
**Opción A - Fácil (Recomendado):**
- Busca el archivo: `start-dashboard.bat`
- Haz **doble clic** en él
- El dashboard se abrirá automáticamente en `http://localhost:5173`

**Opción B - Manual:**
1. Abre **PowerShell** o **CMD**
2. Copia y pega este código:
```powershell
Push-Location "C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents"
npm install
npm run dev
```
3. Espera a que termine (verás "Local: http://localhost:5173")
4. Abre en tu navegador: `http://localhost:5173`

---

## 💻 INSTALACIÓN EN MAC/LINUX

1. Abre **Terminal**
2. Ve a la carpeta del proyecto
3. Ejecuta:
```bash
chmod +x start-dashboard.sh
./start-dashboard.sh
```

---

## 🔌 CONECTAR CON TU API NORA

Para que el dashboard muestre datos reales de tu agente:

### 1. Abre el archivo de configuración
```
src/services/api.ts
```

### 2. Busca esta línea:
```typescript
const API_BASE_URL = 'https://ctm-analyzer-backend.onrender.com';
```

### 3. Reemplázala con tu API:
```typescript
const API_BASE_URL = 'https://tu-api-aqui.com';
```

### 4. Asegúrate de que tu API devuelva estos datos:
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
      "Flight Details": 3.5
    }
  }
}
```

---

## 📊 CARACTERÍSTICAS DEL DASHBOARD

### Sección 1: Métricas de Conversación
- Visualiza el total de conversaciones
- Ve cuántas hay hoy y la tendencia
- Duración promedio y satisfacción del usuario
- Gráfico de conversaciones por hora

### Sección 2: Rendimiento Técnico
- **Uptime**: Disponibilidad del sistema (debe ser > 99%)
- **Latencia**: Tiempo de respuesta (menor es mejor)
- **Tasa de Error**: Porcentaje de errores (menor es mejor)
- Gráficos de tendencia a lo largo del tiempo

### Sección 3: Análisis de Alucinación
- **Tasa de Alucinación**: Cuándo el agente da información incorrecta
- **Precisión Factual**: Porcentaje de respuestas correctas
- Análisis de alucinaciones por tema
- Tendencia diaria

### Sección 4: Resumen General
- Salud general del sistema (score 0-100)
- Conversaciones activas
- Indicador de problemas detectados

---

## 🎨 PERSONALIZACIÓN

### Cambiar Colores
1. Abre: `src/index.css`
2. Busca la sección `:root {`
3. Cambia los colores que quieras:

```css
:root {
  --primary-color: #667eea;      /* Azul principal */
  --secondary-color: #764ba2;    /* Púrpura */
  --success-color: #27ae60;      /* Verde */
  --warning-color: #f39c12;      /* Naranja */
  --danger-color: #e74c3c;       /* Rojo */
}
```

### Ajustar Velocidad de Actualización
1. Abre: `src/hooks/useMetrics.ts`
2. Cambia el intervalo (en milisegundos):

```typescript
// 30000 = 30 segundos (por defecto)
const { metrics } = useMetrics(60000, true); // Cambiar a 60 segundos
```

---

## 🛠️ COMANDOS ÚTILES

```bash
# Inicia el servidor de desarrollo
npm run dev

# Crea versión para producción
npm run build

# Vista previa de la compilación
npm run preview

# Verifica tipos TypeScript
npm run type-check

# Revisa el código
npm run lint
```

---

## ⚠️ SOLUCIÓN DE PROBLEMAS

### ❌ Error: "TOURIST is not recognized"
**Causa**: La ruta tiene espacios
**Solución**:
```powershell
# En PowerShell, usa esto:
Push-Location "C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents"
npm run dev
```

### ❌ El dashboard muestra "No hay datos"
- Verifica que tu API esté corriendo
- Abre el navegador (F12) → Console
- Busca errores de conexión

### ❌ npm no se encuentra
- Instala Node.js: https://nodejs.org/
- Reinicia tu terminal después de instalar

### ❌ Puerto 5173 ya está en uso
```bash
# En PowerShell:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

---

## 📱 FUNCIONALIDADES ESPECIALES

### ✅ Actualización en Tiempo Real
- El dashboard se actualiza automáticamente cada 30 segundos
- Puedes desactivar/activar desde el botón en la esquina superior derecha

### 🔄 Botón Actualizar
- Haz clic en "🔄 Actualizar" para obtener datos frescos al instante

### 📊 Gráficos Interactivos
- Pasa el mouse sobre los gráficos para ver valores exactos
- Los colores indican salud del sistema (rojo = crítico, verde = bueno)

---

## 🚀 DESPLIEGUE EN PRODUCCIÓN

Para desplegar el dashboard en línea:

### 1. Compila para producción:
```bash
npm run build
```

### 2. Sube la carpeta `dist/` a:
- **Vercel**: https://vercel.com (ideal para Vite)
- **Netlify**: https://netlify.com
- **GitHub Pages**: https://pages.github.com
- **Tu servidor web**: Apache, Nginx, etc.

---

## 📚 ARCHIVOS IMPORTANTES

```
📁 Agents/
├── 📄 README.md              ← Documentación técnica
├── 📄 QUICK-START.md         ← Esta guía
├── 📄 DEVELOPMENT.md         ← Notas de desarrollo
├── 🎯 start-dashboard.bat    ← Script para Windows (USAR ESTO)
├── 🎯 start-dashboard.sh     ← Script para Mac/Linux
├── package.json              ← Dependencias
└── 📁 src/                   ← Código fuente
    ├── components/           ← Componentes React
    ├── services/            ← Conexión a API
    ├── hooks/               ← Lógica reutilizable
    └── styles/              ← Estilos CSS
```

---

## 💡 TIPS

- Abre **DevTools** (F12) → Console para ver logs de debug
- El dashboard funciona **sin internet** mostrando datos de prueba
- Todos los datos son **responsivos** (funciona en móvil también)
- Los gráficos se actualizan **suavemente** sin parpadeos

---

## 📞 CONTACTO / SOPORTE

Si tienes problemas:
1. Revisa esta guía
2. Lee el archivo [README.md](README.md)
3. Abre DevTools (F12) y busca errores en Console

---

## ✅ ¡LISTO!

Tu dashboard Nora está **100% operativo** y listo para monitorear tu agente IA en tiempo real. 

🎉 **¡Disfruta viendo cómo funciona tu agente Nora!** 🎉
