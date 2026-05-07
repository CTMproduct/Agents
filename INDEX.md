# 📚 Índice de Documentación - Dashboard Nora

Bienvenido al Dashboard Nora - Sistema de Medición de Agente IA.

Este archivo te guiará por toda la documentación disponible.

---

## 🎯 ¿DÓNDE EMPEZAR?

### Para Empezar Rápido (Recomendado)
1. **Lee primero**: [QUICK-START.md](QUICK-START.md) ← Comienza aquí
2. **Ejecuta**: `start-dashboard.bat` (Windows) o `./start-dashboard.sh` (Mac/Linux)
3. **Abre**: http://localhost:5173

### Si Tienes Problemas
→ [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 📖 Documentación Completa

### 🚀 Primero
| Archivo | Propósito | Cuando Leerlo |
|---------|----------|---------------|
| [QUICK-START.md](QUICK-START.md) | Guía rápida en español | **PRIMERO - Imprescindible** |
| [start-dashboard.bat](start-dashboard.bat) | Script para ejecutar (Windows) | Para empezar fácilmente |
| [start-dashboard.sh](start-dashboard.sh) | Script para ejecutar (Mac/Linux) | Para empezar fácilmente |

### 📚 Referencia
| Archivo | Propósito | Cuando Leerlo |
|---------|----------|---------------|
| [README.md](README.md) | Documentación técnica completa | Referencia general |
| [PROJECT-SUMMARY.md](PROJECT-SUMMARY.md) | Resumen ejecutivo del proyecto | Para entender la arquitectura |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Notas para desarrolladores | Si vas a modificar código |

### 🔌 Integración
| Archivo | Propósito | Cuando Leerlo |
|---------|----------|---------------|
| [API-INTEGRATION.md](API-INTEGRATION.md) | Especificaciones de API | Cuando conectes con tu API |
| [.env.example](.env.example) | Variables de entorno | Para configuración avanzada |

### 🆘 Problemas
| Archivo | Propósito | Cuando Leerlo |
|---------|----------|---------------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Solución de problemas | Cuando algo no funciona |

---

## 🗂️ Estructura del Código Fuente

```
src/
├── components/        Componentes React (Dashboard, gráficos, tarjetas)
├── services/         Servicios (conexión API)
├── hooks/            Lógica reutilizable (obtener datos)
├── types/            Definiciones TypeScript
└── styles/           Estilos CSS profesionales
```

→ Lee [README.md#estructura-del-proyecto](README.md) para más detalles.

---

## 🎨 Vista Previa del Dashboard

El dashboard tiene 5 secciones principales:

1. **Header**: Encabezado con controles de actualización
2. **Conversación**: Métricas y gráficos de conversaciones
3. **Rendimiento**: Métricas técnicas del sistema
4. **Alucinación**: Análisis de respuestas incorrectas
5. **Resumen**: Estado general del sistema

→ Lee [PROJECT-SUMMARY.md#secciones-del-dashboard](PROJECT-SUMMARY.md) para detalles.

---

## ⚡ Comandos Rápidos

```bash
# Instalar dependencias
npm install

# Iniciar desarrollo
npm run dev

# Compilar para producción
npm run build

# Ver compilación
npm run preview

# Verificar tipos TypeScript
npm run type-check

# Revisar código (linting)
npm run lint
```

---

## 🔗 Rutas Importantes

### Carpeta del Proyecto
```
C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents
```

### URL del Dashboard (en desarrollo)
```
http://localhost:5173
```

### Archivos Clave para Editar

**Cambiar URL de API:**
→ `src/services/api.ts` línea ~6

**Cambiar Colores:**
→ `src/index.css` línea ~7

**Cambiar Intervalo de Actualización:**
→ `src/hooks/useMetrics.ts` línea ~22

---

## 🚦 Estado de Implementación

### ✅ Completado

- [x] Interfaz responsiva (mobile, tablet, desktop)
- [x] Gráficos interactivos (líneas, barras, circulares)
- [x] Actualización en tiempo real (cada 30 segundos)
- [x] Datos de prueba incluidos
- [x] Sistema de colores (verde/amarillo/rojo)
- [x] 5 Secciones principales
- [x] Documentación completa
- [x] Scripts de inicio

### 🔄 Próximas Mejoras (Opcional)

- [ ] Dark mode
- [ ] Exportar PDF
- [ ] Historial de alertas
- [ ] Integración WebSocket
- [ ] Descarga CSV

---

## 🎯 Flujo Típico de Uso

1. **Ejecutar Dashboard**
   ```bash
   npm run dev
   # O hacer doble clic en start-dashboard.bat
   ```

2. **Abrir en Navegador**
   ```
   http://localhost:5173
   ```

3. **Ver Datos de Prueba**
   - El dashboard mostrará datos de prueba por defecto
   - Verás gráficos, métricas y análisis completos

4. **Conectar tu API** (Opcional)
   - Edita `src/services/api.ts`
   - Cambia `API_BASE_URL` con tu URL
   - Reinicia: Ctrl+C y `npm run dev`

5. **Ver Datos Reales**
   - El dashboard automáticamente mostrará datos de tu API
   - Las gráficas se actualizan cada 30 segundos

---

## 💡 Tips Importantes

### 1. Ruta con Espacios
Si ejecutar desde PowerShell te da error:
```powershell
Push-Location "C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents"
npm run dev
```

### 2. Puerto Ocupado
Si el puerto 5173 está en uso:
```bash
npm run dev -- --port 3000  # Usa otro puerto
```

### 3. Debugging
Abre DevTools: `F12` → Console
Para ver todos los logs de la API.

### 4. Caché
Si algo se ve extraño:
```bash
npm cache clean --force
npm install
npm run dev
```

---

## 📞 Preguntas Frecuentes

### P: ¿Cómo cambio los colores?
R: Edita `src/index.css` - busca `:root {`

### P: ¿Cómo conecto mi API?
R: Lee [API-INTEGRATION.md](API-INTEGRATION.md)

### P: ¿Qué hago si veo "No hay datos"?
R: Lee [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

### P: ¿Puedo usar esto en producción?
R: Sí, ejecuta `npm run build` y despliega en Vercel, Netlify, etc.

### P: ¿Qué si quiero dark mode?
R: Está en la lista de mejoras futuras. Actualmente tienes light mode.

---

## 🎓 Estructura de Aprendizaje

### Nivel 1: Usuario
- Leer [QUICK-START.md](QUICK-START.md)
- Ejecutar `start-dashboard.bat`
- Ver datos en el navegador

### Nivel 2: Integración
- Leer [API-INTEGRATION.md](API-INTEGRATION.md)
- Conectar tu API
- Ver datos reales

### Nivel 3: Personalización
- Leer [README.md](README.md)
- Editar estilos y colores
- Cambiar configuración

### Nivel 4: Desarrollo
- Leer [DEVELOPMENT.md](DEVELOPMENT.md)
- Modificar componentes
- Agregar nuevas secciones

---

## 🎉 Resumen

Tu dashboard está **100% listo** con:

✅ Interfaz profesional  
✅ Gráficos interactivos  
✅ Actualización en tiempo real  
✅ Datos de prueba  
✅ Documentación completa  

**Próximo paso:** Lee [QUICK-START.md](QUICK-START.md) y ejecuta el dashboard.

---

## 📝 Última Actualización

- **Fecha**: Mayo 7, 2026
- **Versión**: 1.0.0
- **Estado**: ✅ Producción lista

---

¿Listo para comenzar? 🚀

**Empieza aquí:** [QUICK-START.md](QUICK-START.md)
