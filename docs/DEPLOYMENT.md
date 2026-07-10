# Despliegue de Nora Control

Railway es el destino principal. La aplicacion se publica como un solo servicio: Express sirve la API y el frontend compilado.

## 1. Validar antes de publicar

```powershell
npm ci --prefix backend
npm ci --prefix frontend
npm run check
```

No publiques si alguna comprobacion falla.

## 2. Conectar Railway

1. Crea o abre el proyecto en Railway.
2. Conecta el repositorio de GitHub `CTMproduct/Agents`.
3. Selecciona la rama `main`.
4. Railway detectara `railway.json`.
5. Agrega un servicio PostgreSQL al mismo proyecto.

## 3. Variables requeridas

Configura estas variables en el servicio web:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EVALUATION_MODEL=gpt-4o-mini
AGENT_ADMIN_KEY=...
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
FRONTEND_URL=https://your-service.up.railway.app
ALLOWED_ORIGINS=https://your-service.up.railway.app
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=30
```

Usa para `AGENT_ADMIN_KEY` un secreto largo y aleatorio. No lo guardes en el repositorio ni en archivos compartidos.

Si Railway crea una variable `DATABASE_URL` automaticamente, no es necesario agregar `POSTGRES_URL`.

## 4. Construccion e inicio

Railway puede ejecutar este repositorio desde la raiz, desde `/backend` o desde `/frontend`. El archivo `railway.json` detecta automaticamente la ubicacion:

- En `/`, compila frontend y backend como una aplicacion monolitica.
- En `/backend`, instala e inicia solo la API.
- En `/frontend`, compila e inicia el sitio estatico.

Para una instalacion nueva se recomienda un unico servicio con Root Directory `/`.

## 5. Verificacion posterior

Reemplaza el dominio de ejemplo por el dominio asignado por Railway:

```powershell
Invoke-RestMethod https://your-service.up.railway.app/health
Invoke-RestMethod https://your-service.up.railway.app/api/status
Invoke-RestMethod https://your-service.up.railway.app/api/agents
```

Despues abre la pagina principal y comprueba:

- El dashboard carga sin errores.
- La lista de agentes aparece.
- La seccion Agentes solicita la clave administrativa.
- Una clave incorrecta no habilita la edicion.
- La clave correcta permite guardar y probar.
- Las conversaciones siguen persistiendo despues de reiniciar el servicio.

## 6. Publicacion automatica

Cada cambio en las carpetas de Nora ejecuta la validacion de GitHub. Railway puede desplegar automaticamente cada actualizacion de `main`.

Antes de activar despliegue automatico, protege la rama `main` para exigir que la comprobacion `Nora quality checks` termine correctamente.

## 7. Recuperacion

Si una publicacion falla:

1. Revisa los registros del servicio y el resultado de `/health`.
2. En Railway, abre Deployments.
3. Restaura la ultima version estable.
4. Corrige el problema en una rama y vuelve a ejecutar `npm run check`.
5. Publica nuevamente cuando todas las comprobaciones pasen.

## 8. Render opcional

`render.yaml` define un servicio monolitico equivalente. Configura `OPENAI_API_KEY`, `AGENT_ADMIN_KEY` y `DATABASE_URL` como secretos antes de desplegarlo.
