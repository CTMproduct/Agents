# 🆘 Guía de Solución de Problemas

## ❌ Error: "TOURIST is not recognized"

### Causa
La ruta del proyecto contiene espacios que PowerShell no interpreta correctamente.

### Soluciones

**Opción 1: Ejecutar script (Recomendado)**
```
Busca: start-dashboard.bat
Haz doble clic
```

**Opción 2: PowerShell con Push-Location**
```powershell
Push-Location "C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents"
npm run dev
```

**Opción 3: CMD (Símbolo del sistema)**
```cmd
cd /d "C:\Users\PRODUCTO\OneDrive - CONSOLIDATORS & TOURIST MANAGEMENT S.A.S\Documentos\Agents"
npm run dev
```

---

## ❌ Error: "npm not found" / "npm: command not found"

### Causa
Node.js no está instalado o no está en el PATH

### Solución
1. Descargar Node.js: https://nodejs.org/
2. Instalar (elige versión LTS - Long Term Support)
3. Reiniciar PowerShell / Terminal
4. Verificar: `npm --version`
5. Reintentar: `npm run dev`

---

## ❌ El puerto 5173 ya está en uso

### Causa
Ya hay otro proceso corriendo en ese puerto (probablemente otra instancia del dashboard)

### Soluciones

**En PowerShell:**
```powershell
# Ver qué proceso usa puerto 5173
netstat -ano | findstr :5173

# Resultado: TCP    0.0.0.0:5173    0.0.0.0:0    LISTENING    12345
# Donde 12345 es el PID

# Cerrar el proceso
taskkill /PID 12345 /F
```

**En Terminal (Mac/Linux):**
```bash
# Ver qué proceso usa puerto 5173
lsof -i :5173

# Cerrar el proceso (reemplaza PID con el número)
kill -9 PID
```

**O simplemente:**
```bash
npm run dev -- --port 3000  # Usa otro puerto
```

---

## ❌ El dashboard muestra "No hay datos"

### Cause
La API no está disponible o la URL es incorrecta

### Debugging

1. **Abre DevTools**
   - Presiona `F12`
   - Ve a la pestaña "Console"

2. **Busca errores de red**
   - Presiona `F12`
   - Ve a pestaña "Network"
   - Actualiza la página
   - Busca `/api/metrics`
   - Mira si tiene un ❌

3. **Verifica la URL de API**
   - Abre: `src/services/api.ts`
   - Busca: `const API_BASE_URL`
   - Asegúrate de que sea correcta

### Soluciones

**Si la API no está corriendo:**
```bash
# Inicia tu servidor API primero
npm start  # o el comando de tu API
```

**Si cambió la URL:**
```typescript
// Edita src/services/api.ts
const API_BASE_URL = 'https://tu-url-nueva.com';
```

**Si la API requiere autenticación:**
```typescript
// Edita src/services/api.ts
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': 'Bearer tu_token_aqui'
  }
});
```

---

## ❌ Los gráficos no se ven

### Causa
Problema con las dependencias de gráficos (recharts)

### Soluciones

```bash
# Limpia caché npm
npm cache clean --force

# Reinstala dependencias
rm -r node_modules
npm install

# Reinicia servidor
npm run dev
```

---

## ❌ "Cannot find module"

### Causa
Falta instalar dependencias

### Solución

```bash
npm install
npm run dev
```

---

## ❌ El proyecto está muy lento

### Causa
Problema de rendimiento (máquina lenta, caché corrupto, etc.)

### Soluciones

1. **Limpia el caché de Vite**
   ```bash
   rm -r .vite
   npm run dev
   ```

2. **Reinicia desde cero**
   ```bash
   rm -r node_modules .vite dist
   npm install
   npm run dev
   ```

3. **Usa modo preview (si no necesitas HMR)**
   ```bash
   npm run build
   npm run preview
   ```

---

## ❌ TypeScript error: "Property does not exist"

### Causa
Problema con tipos TypeScript

### Solución

```bash
npm run type-check  # Ver errores
# Arregla los tipos en los archivos
```

O en VS Code:
- Abre la Paleta de Comandos (Ctrl+Shift+P)
- Escribe: "TypeScript: Select Version"
- Elige "Use VS Code's Version"

---

## ❌ "CORS Error"

### Causa
La API está en otro dominio y no tiene CORS habilitado

### Error que ves
```
Access to XMLHttpRequest at 'https://api.com/metrics' 
blocked by CORS policy
```

### Soluciones

**Si controlas el backend:**

Node.js/Express:
```javascript
const cors = require('cors');
app.use(cors());
```

Python/FastAPI:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://tu-dominio.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Si no controlas el backend:**
- Contacta al administrador de la API
- Pide que agregue `http://localhost:5173` a CORS

---

## ❌ "Build error" al compilar

### Causa
Error de sintaxis o configuración

### Solución

```bash
# Ver el error exacto
npm run build

# Arreglar errores mostrados
# Generalmente son errores de TypeScript

# Validar tipos
npm run type-check

# Verificar linting
npm run lint
```

---

## ❌ Git error: "fatal: not a git repository"

### Cause
No es importante si no usas Git

### Solución
Puedes ignorar este error - solo es necesario si compartirás código

---

## ❌ "Permission denied" en Mac/Linux

### Causa
Los scripts no tienen permisos de ejecución

### Solución

```bash
chmod +x start-dashboard.sh
./start-dashboard.sh
```

---

## ✅ Verificación rápida

Si algo no funciona, ejecuta estos comandos en orden:

```bash
# 1. Verifica Node.js
node --version
npm --version

# 2. Verifica carpeta correcta
pwd  # Mac/Linux
cd   # Windows

# 3. Instala todo desde cero
rm -r node_modules package-lock.json
npm install

# 4. Inicia servidor
npm run dev

# 5. Abre en navegador
# http://localhost:5173
```

---

## 📊 Dashboard Checklist

Antes de decir que "no funciona":

- [ ] ¿Instalé Node.js?
- [ ] ¿Ejecuté `npm install`?
- [ ] ¿Abrí el puerto correcto (5173)?
- [ ] ¿La API está en la URL correcta?
- [ ] ¿Abrí DevTools para ver errores (F12)?
- [ ] ¿Intenté reiniciar terminal?
- [ ] ¿Intenté `rm -r node_modules` && `npm install`?

---

## 📞 Si nada funciona:

1. **Lee la documentación**
   - QUICK-START.md
   - README.md
   - API-INTEGRATION.md

2. **Abre DevTools (F12)**
   - Console tab
   - Network tab
   - Busca errores con detalle

3. **Verifica estructura de carpetas**
   - Existe `src/components/Dashboard.tsx`?
   - Existe `package.json`?

4. **Intenta en otra carpeta**
   - Copia `src/`, `package.json`, etc.
   - En una ruta sin espacios
   - Ejemplo: `C:\nora-dashboard`

---

## 🆘 Última Opción: Reinstalar Todo

Si nada funciona, reinicia desde cero:

```bash
# 1. Elimina todo
rm -r node_modules package-lock.json .vite dist

# 2. Reinstala Node.js
# Descarga: https://nodejs.org/

# 3. Reinstala dependencias
npm install

# 4. Limpia caché
npm cache clean --force

# 5. Inicia
npm run dev
```

---

## 💡 Proactive Tips

Para evitar problemas:

- Usa PowerShell o CMD para ejecutar comandos (no PowerShell ISE)
- Mantén tu Node.js actualizado: `npm install -g npm`
- No ejecutes desde carpetas con permisos restringidos
- Si cambias la URL de API, reinicia el servidor: `npm run dev`
- Limpia caché regularmente: `npm cache clean --force`

---

¡Espero que esto resuelva tu problema! 🎉

Si aún tienes dudas, consulta la documentación completa en **README.md** o **QUICK-START.md**
