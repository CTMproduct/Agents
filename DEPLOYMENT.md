# 🚀 GUÍA DE DEPLOYMENT - NORA DASHBOARD A RENDER

**Fecha**: 2026-05-13  
**Plataforma**: Render.com  
**Componente**: Frontend (React + Vite)

---

## 📋 PRE-REQUISITOS

✅ **Cuenta en Render**: https://render.com  
✅ **GitHub**: Repositorio conectado (recomendado)  
✅ **Backend**: Ya deployado en Render  
✅ **Git**: Instalado localmente  

---

## 🔗 CONEXIÓN CON GITHUB

### Opción 1: Conectar Repositorio (RECOMENDADO)

1. **En Render Dashboard**:
   - Ve a https://dashboard.render.com
   - Click en "New +" → "Web Service"
   - Selecciona "Build and deploy from a Git repository"
   - Autoriza GitHub
   - Selecciona tu repositorio

2. **Configuración**:
   - **Name**: `nora-frontend` (o tu nombre preferido)
   - **GitHub Repo**: `tu-usuario/tu-repo`
   - **Branch**: `main` (o la rama que uses)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free o Starter

3. **Environment Variables**:
   ```
   NODE_ENV = production
   VITE_API_BASE_URL = https://ctm-analyzer-backend.onrender.com
   VITE_REFRESH_INTERVAL = 30000
   VITE_ENABLE_REALTIME = true
   ```

---

## 📝 PASOS DE DEPLOYMENT

### Paso 1: Preparar Código Local

```bash
# Asegurate de estar en la rama main
git checkout main

# Hacer pull de cambios recientes
git pull origin main

# Verificar que todo compile
npm run build

# No debería haber errores de TypeScript
```

### Paso 2: Push a GitHub

```bash
# Agregar todos los cambios
git add .

# Hacer commit con mensaje claro
git commit -m "chore: prepare for render deployment - add debugging and backend health check"

# Hacer push
git push origin main
```

### Paso 3: Crear Servicio en Render

1. Ve a https://dashboard.render.com
2. Click en **"+ New"** → **"Web Service"**
3. Elige **"Build and deploy from a Git repository"**
4. Autoriza GitHub si es necesario
5. Selecciona tu repositorio

### Paso 4: Configurar Servicio

**Información Básica:**
- Name: `nora-frontend`
- Repository: Tu repo GitHub
- Branch: `main`
- Runtime: `Node`

**Build & Start:**
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Instance Type: Free

**Environment Variables:**
Agregar estas variables:

| Key | Value |
|-----|-------|
| NODE_ENV | production |
| VITE_API_BASE_URL | https://ctm-analyzer-backend.onrender.com |
| VITE_REFRESH_INTERVAL | 30000 |
| VITE_ENABLE_REALTIME | true |
| VITE_SHOW_HALLUCINATION_ANALYSIS | true |
| VITE_SHOW_PERFORMANCE_METRICS | true |
| VITE_SHOW_CONVERSATION_METRICS | true |

**IMPORTANTE**: Cambiar `VITE_API_BASE_URL` si tu backend está en otro URL.

### Paso 5: Deploy

1. Click en **"Create Web Service"**
2. Render comenzará a:
   - ✅ Clonar el repo
   - ✅ Instalar dependencias
   - ✅ Compilar TypeScript
   - ✅ Hacer build con Vite
   - ✅ Iniciar el servidor

3. **Ver logs**:
   - En el dashboard, ve a tu servicio
   - Tab "Logs"
   - Verás el progreso en tiempo real

---

## ✅ VERIFICAR DEPLOYMENT

Una vez que Render diga "Live" (verde):

1. **Ir a la URL**:
   - Dashboard de Render te dará la URL (ej: `https://nora-frontend-xxxx.onrender.com`)
   - Abre en navegador

2. **Verificar Backend Connection**:
   - Deberías ver 🟢 **Backend Online** en la esquina superior
   - Si ves 🔴 **Backend Offline**, verifica:
     - Backend está corriendo en Render
     - `VITE_API_BASE_URL` es correcto

3. **Pruebar Funcionalidad**:
   - Gráficos de métricas cargan
   - Los botones responden
   - Console (F12) no muestra errores rojos

---

## 🐛 TROUBLESHOOTING

### "Build failed"

**Error**: `npm ERR! not found: typescript`

**Solución**:
```bash
# Asegurar que TypeScript está en devDependencies
npm install --save-dev typescript

# Hacer build localmente primero
npm run build

# Push a GitHub
git add . && git commit -m "fix: add typescript" && git push
```

### "Port already in use"

**Error**: `Port 10000 is already in use`

**Solución**:
- Render asigna puerto automáticamente - eliminar `PORT` de env vars
- El script `start` ya lee de variable de entorno

### "Backend Offline en el Dashboard"

**Error**: 🔴 Backend Online

**Solución**:
1. Verificar URL del backend:
   ```bash
   curl https://ctm-analyzer-backend.onrender.com/health
   ```

2. Si backend no responde:
   - Backend también necesita estar en Render
   - O Render está durmiendo (plan free se duerme)

3. Cambiar `VITE_API_BASE_URL` si es necesario

### "Blank page o estilos raros"

**Problema**: CSS no carga correctamente

**Solución**:
1. Abrir DevTools (F12)
2. Tab Console - ver si hay errores
3. Tab Network - verificar que CSS se cargó
4. Hard refresh: `Ctrl+Shift+R` (o `Cmd+Shift+R` Mac)

### "Métricas no cargan"

**Problema**: Gráficos vacíos

**Solución**:
1. Verificar que backend está online (🟢)
2. Abrir Console (F12)
3. Buscar errores de Network
4. Verificar CORS en backend permite este dominio
5. Reintentar manual: botón "🔄 Actualizar"

---

## 🔄 AUTO-DEPLOYMENT CON GIT

Una vez que Render esté conectado a GitHub:

**Cada vez que hagas Push, Render hace deploy automáticamente:**

```bash
# Hacer cambios en código
# ...

# Commit y Push
git commit -m "feature: add new chart"
git push origin main

# ✅ Render detecta cambios y hace deploy automáticamente
# Ver en: https://dashboard.render.com → Nora Frontend → Deploys
```

---

## 📊 MONITOREAR EN PRODUCCIÓN

**Dashboard Render**:
- URL en vivo
- Logs en tiempo real
- Estadísticas de uso
- Health checks

**Desde el Dashboard de Nora**:
- 🟢 Indicador Backend Online
- 📊 Métricas en tiempo real
- 🔄 Actualización automática cada 30s

---

## 🆘 SI ALGO SALE MAL

### Rollback rápido

```bash
# Ver historial de deploys
git log --oneline

# Revertir al último commit conocido como bueno
git revert HEAD
git push origin main

# Render hará deploy con la versión anterior
```

### Ver logs completos

1. Render Dashboard
2. Tu servicio "nora-frontend"
3. Tab "Logs"
4. Buscar errores (líneas en rojo)

### Contacto soporte Render

Si nada funciona:
- Email: support@render.com
- Web: https://render.com/docs
- Community: https://community.render.com

---

## ✨ CONFIGURACIÓN AVANZADA (OPCIONAL)

### Custom Domain

1. Ir a tu servicio en Render
2. Tab "Settings"
3. "Custom Domain"
4. Seguir instrucciones de DNS

### SSL/TLS (Automático)

Render automáticamente genera certificado SSL para todos los dominios.

### Configurar Render CLI (Desarrollo)

```bash
# Instalar Render CLI
npm install -g @render-com/cli

# Login
render login

# Deployar desde terminal
render create --instance-type free
```

---

## 📈 PRÓXIMOS PASOS DESPUÉS DE DEPLOYMENT

✅ **Hecho**: Frontend en Render  
⏭️ **Siguiente**: 

1. **Backend**: Si aún no lo hiciste, deployar backend también
2. **Dominio Custom**: Configurar dominio propio
3. **CI/CD**: Agregar GitHub Actions para testing automático
4. **Monitoreo**: Configurar alertas en Render
5. **Base de Datos**: Migrar de memoria a PostgreSQL

---

## 📞 SOPORTE

**Problemas comunes**: Ver sección TROUBLESHOOTING arriba

**Stack utilizado**:
- Frontend: React 19 + Vite + TypeScript
- UI: Recharts para gráficos
- HTTP: Axios con interceptores

**Versiones**:
- Node 18+
- npm 8+

---

**Estado**: ✅ LISTO PARA DEPLOY  
**Última Actualización**: 2026-05-13  
**Autor**: GitHub Copilot
