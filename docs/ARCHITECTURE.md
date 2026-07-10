# Arquitectura de Nora Control

## Resumen

Nora Control es una aplicacion monolitica desplegable como un solo servicio.

```text
Navegador
   |
   | HTTPS
   v
Express
   |-- archivos compilados de React
   |-- API /api/*
   |-- control de acceso administrativo
   |-- limites para solicitudes de IA
   |
   +--> OpenAI
   |
   +--> PostgreSQL
        |-- conversations
        |-- agents
        +-- agent_versions
```

## Frontend

El frontend usa React, TypeScript y Vite.

- `App.tsx` controla el acceso de la plataforma y la navegacion.
- `Dashboard` presenta metricas, conversaciones y captura.
- `AgentStudio` permite crear, ajustar y probar agentes.
- Las vistas se cargan bajo demanda para reducir el tiempo inicial.
- La clave administrativa se guarda solo en `sessionStorage`.

## Backend

El backend usa Express y concentra actualmente las rutas en `backend/src/index.js`.

Responsabilidades:

- Servir el frontend compilado.
- Validar la clave administrativa.
- Resolver el agente y su version activa.
- Generar respuestas y evaluaciones con OpenAI.
- Capturar conversaciones y telemetria.
- Exponer metricas e historiales.
- Exportar datos en CSV y JSON.

Esta estructura es apropiada para el tamano actual. Si el backend sigue creciendo, la siguiente division recomendada es: rutas, servicios de agentes, servicio de conversaciones, servicio de OpenAI y middleware de seguridad.

## Agentes y versiones

`agents` contiene la identidad y el estado operativo.

`agent_versions` contiene:

- instrucciones del sistema;
- modelo;
- creatividad;
- longitud maxima;
- herramientas;
- reglas de seguridad.

Una nueva version se crea solo cuando cambia la configuracion. La escritura del agente y su version se ejecuta dentro de una transaccion de PostgreSQL.

Las respuestas publicas nunca incluyen las instrucciones internas del agente.

## Datos

`conversations` conserva pregunta, respuesta, usuario, clasificacion, agente, version y telemetria.

En produccion se usa `DATABASE_URL`. Sin PostgreSQL, el sistema usa un archivo JSON de respaldo pensado para desarrollo.

## Seguridad

- La aplicacion interna requiere `AGENT_ADMIN_KEY`.
- La comparacion de la clave usa tiempo constante.
- Conversaciones, metricas, historiales y exportaciones estan protegidos.
- Las instrucciones internas no se incluyen en respuestas publicas.
- Las rutas de IA tienen limite configurable por IP.
- El cuerpo JSON tiene un limite de tamano.
- Se eliminan detalles internos de los errores enviados al cliente.
- Se agregan cabeceras contra MIME sniffing, framing y permisos del navegador.

## Despliegue

Railway ejecuta una construccion reproducible con `npm ci`, compila React y luego inicia Express. `GET /health` es el chequeo de salud.

Render queda disponible como destino alternativo mediante `render.yaml`.

## Limites actuales y siguientes pasos

- El limite de solicitudes vive en memoria; para varias replicas debe migrarse a Redis.
- La clave compartida es adecuada para un equipo pequeno; el siguiente paso empresarial es inicio de sesion individual con roles y auditoria.
- Las herramientas y reglas se almacenan, pero requieren un ejecutor y una interfaz visual en una fase posterior.
- El costo se registra en la estructura de datos, pero falta calcularlo con una tabla de precios versionada.
- Se recomienda separar las migraciones SQL del arranque cuando el volumen y el equipo crezcan.
