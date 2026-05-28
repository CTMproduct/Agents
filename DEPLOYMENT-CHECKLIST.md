# ✅ DEPLOYMENT CHECKLIST - NORA FRONTEND

## 🔐 SEGURIDAD

- [ ] API keys NO están en `.env` (usar solo en Render env vars)
- [ ] `.env` está en `.gitignore`
- [ ] `.env.local` está en `.gitignore`
- [ ] `backend/.env` está en `.gitignore`
- [ ] No hay credenciales en `git log`

## 📦 BUILD

- [ ] Instalar dependencias: `npm install`
- [ ] TypeScript compila sin errores: `npm run build`
- [ ] Vite bundle se crea: ver carpeta `dist/`
- [ ] No hay warnings de TypeScript

## 🔗 CONFIGURACIÓN

- [ ] `render.yaml` está actualizado (solo frontend)
- [ ] `.env.example` documentado
- [ ] `VITE_API_BASE_URL` apunta al backend correcto
- [ ] Variables de entorno en Render dashboard configuradas

## 🧪 TESTING LOCAL

- [ ] `npm run dev` funciona (frontend en 5173)
- [ ] Backend corriendo en localhost:3000
- [ ] Dashboard abre en `http://localhost:5173`
- [ ] 🟢 Backend Online (indicador verde)
- [ ] Gráficos cargan datos
- [ ] Botones responden
- [ ] Console (F12) sin errores rojos

## 📝 GIT

- [ ] Todos los cambios están committeados
- [ ] `git status` está limpio
- [ ] Branch es `main`
- [ ] GitHub repo conectado a Render
- [ ] Cambios pusheados: `git push origin main`

## 🚀 RENDER

- [ ] Cuenta en Render creada
- [ ] Repositorio conectado
- [ ] Servicio creado: "nora-frontend"
- [ ] Variables de entorno agregadas (ver tabla en DEPLOYMENT.md)
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] Deploy iniciado

## ✅ POST-DEPLOYMENT

- [ ] URL en vivo es accesible
- [ ] Página carga sin errores en Chrome DevTools
- [ ] CSS y JS se cargan correctamente
- [ ] 🟢 Backend Online se muestra
- [ ] Métricas cargan
- [ ] Health check pasa
- [ ] Logs en Render no muestran errores

## 📊 PRODUCCIÓN

- [ ] Monitorear logs por 5 minutos
- [ ] Probar en múltiples navegadores
- [ ] Probar en mobile (responsive)
- [ ] Verificar que hard refresh (Ctrl+Shift+R) funciona
- [ ] Verificar que auto-refresh en tiempo real funciona

---

## ⏱️ TIMELINE ESTIMADO

| Paso | Tiempo |
|------|--------|
| Build local | 2-3 min |
| Git commit/push | 1 min |
| Create Render service | 3-5 min |
| Render build | 5-10 min |
| Render deploy | 2-3 min |
| **TOTAL** | **~15-25 min** |

---

## 🆘 AYUDA RÁPIDA

### Si Build falla:
```bash
# 1. Verificar localmente
npm run build

# 2. Si hay errores, fixear
npm install  # Falta algún paquete?
npm run lint  # Errores de linting?

# 3. Push otra vez
git add . && git commit -m "fix: build issue" && git push
```

### Si Backend no conecta:
1. Verificar URL en Render dashboard
2. Copiar URL exacta del backend
3. Actualizar `VITE_API_BASE_URL` en Render env vars
4. Trigger redeploy en Render

### Si página está en blanco:
```
F12 → Console → ver errores rojos
Ctrl+Shift+R (hard refresh)
Ver Network tab → ver qué no cargó
```

---

## ✨ ÚTIL DESPUÉS DE DEPLOY

**Comando para ver logs en tiempo real:**
```bash
# Desde Render dashboard o usar Render CLI
render logs --service nora-frontend

# O manualmente en Dashboard:
# Settings → Ver en "Logs" tab
```

**Redeploy sin cambios:**
- Render dashboard → "nora-frontend" → "Manual Deploy" button

**Cambiar variables de entorno:**
- Render dashboard → "nora-frontend" → "Environment" → Edit → Save

---

**Fecha**: 2026-05-13  
**Versión**: 1.0  
**Responsable**: Implementación completada ✅
