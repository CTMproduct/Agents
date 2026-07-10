# Nora Control

Plataforma de CTM para crear, ajustar, probar y supervisar agentes de inteligencia artificial desde una interfaz visual.

## Funcionalidades

- Estudio visual de agentes con nombre, estado, prompt, modelo, temperatura y limite de respuesta.
- Versionado automatico cuando cambia la configuracion del agente.
- Prueba rapida de cada agente antes de publicarlo.
- Dashboard de conversaciones, calidad, rendimiento y alucinaciones.
- Captura y exportacion de conversaciones en CSV o JSON.
- Persistencia en PostgreSQL con almacenamiento local de respaldo.
- Proteccion administrativa para crear, editar y probar agentes.
- Limites de solicitudes y cabeceras de seguridad para produccion.
- Despliegue monolitico: el backend sirve tambien el frontend compilado.

## Requisitos

- Node.js 22
- npm 10 o superior
- PostgreSQL recomendado para produccion
- Una clave de OpenAI

## Instalacion local

```powershell
npm run install:all
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Configura como minimo en `backend/.env`:

```env
OPENAI_API_KEY=your-openai-key
AGENT_ADMIN_KEY=your-long-random-admin-key
DATABASE_URL=postgresql://user:password@host:5432/database
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Inicia el backend y el frontend en terminales separadas:

```powershell
npm run dev:backend
npm run dev:frontend
```

Abre `http://localhost:5173`.

## Validacion

```powershell
npm run check
```

La validacion comprueba sintaxis del backend, reglas del frontend, tipos de TypeScript y compilacion de produccion.

## Produccion

Railway usa `railway.json` para instalar dependencias, compilar el frontend, iniciar el backend y verificar `/health`.

Variables requeridas:

```env
OPENAI_API_KEY=...
AGENT_ADMIN_KEY=...
DATABASE_URL=...
NODE_ENV=production
FRONTEND_URL=https://your-service.up.railway.app
ALLOWED_ORIGINS=https://your-service.up.railway.app
```

El valor de `AGENT_ADMIN_KEY` nunca debe guardarse en Git. Debe configurarse como secreto en la plataforma de despliegue.

Consulta [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) para el proceso completo y [docs/API.md](./docs/API.md) para los endpoints.

## Estructura

```text
backend/                 API Express y PostgreSQL
frontend/                React, TypeScript y Vite
frontend/src/components/agents/
                         Estudio visual de agentes
docs/                    Arquitectura, API y despliegue
openapi/                 Esquema para integraciones
railway.json             Despliegue principal
render.yaml              Despliegue alternativo
```

## Seguridad

- El acceso al dashboard y a los datos internos requiere la clave administrativa.
- Crear, modificar y probar agentes requiere `X-Agent-Admin-Key`.
- La clave administrativa se conserva en `sessionStorage`, no de forma permanente.
- Las rutas que consumen IA tienen limite configurable por IP.
- En produccion, si falta `AGENT_ADMIN_KEY`, la edicion queda bloqueada.

Proyecto propietario de CTM Engineering.
