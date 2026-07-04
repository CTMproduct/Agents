# Agentic Revenue OS — Fase 1 (MVP: Agentic Lead Intake)

Sistema de intake agéntico para CTM En Línea: recibe mensajes (WhatsApp/webchat), crea contacto y lead, clasifica tipo de cliente e intención, extrae destino/fechas/pax/presupuesto, asigna score, crea tarea y deja una respuesta sugerida **pendiente de aprobación humana**. Nada se envía sin aprobación (Autonomía L0).

## Requisitos

- Node.js 20+
- Docker (para PostgreSQL)
- Una API key de Anthropic (`https://console.anthropic.com`)

## Arranque en 5 pasos

```bash
cp .env.example .env      # 1. pega tu ANTHROPIC_API_KEY y cambia WEBHOOK_SHARED_SECRET
docker compose up -d      # 2. Postgres con pgvector
npm install               # 3. dependencias
npx prisma migrate dev --name init && npm run prisma:seed   # 4. DB + políticas L0
npm run start:dev         # 5. API en http://localhost:3000
```

Verifica: `curl http://localhost:3000/health`

## Estado en esta máquina (ya configurado)

Este entorno ya quedó listo — no repitas el arranque de 5 pasos:

- **Base de datos:** se usa el PostgreSQL 17 local (servicio `postgresql-x64-17`), **no Docker**. La DB `agentic_revenue_os` y el rol `ctm` ya existen; la migración `init` y el seed L0 ya corrieron.
- **`.env`:** ya creado con `WEBHOOK_SHARED_SECRET` propio y `ANTHROPIC_API_KEY` funcional (verificado en vivo el 2026-07-04: pipeline completo + evals con `claude-sonnet-5`). Si `ANTHROPIC_API_KEY` está vacía, el provider cae a `OPENAI_API_KEY`.
- **Scripts npm:** invocan los binarios con `node` directo porque la ruta de OneDrive contiene `&` y eso rompe los shims `.cmd` de Windows (`npx`, `nest`, `jest`… fallan con `'TOURIST' is not recognized`). No los cambies de vuelta.
- **Arrancar:** `npm run start:dev` (watch) o `npm run build && npm start` (el build emite a `dist/src/main.js`).
- **Pipeline completo sin API key:** `test/pipeline.e2e-spec.ts` stubbea el LLM y prueba webhook → lead → tarea → aprobación → envío, incluido el gate anti-cifras.

## Producción (Railway)

- **URL:** https://api-production-4d5c.up.railway.app (healthcheck en `/health`)
- Proyecto Railway `agentic-revenue-os` (workspace CTM's Projects): servicio `api` + Postgres. Las migraciones corren en cada arranque (`prisma:deploy` en el startCommand de `railway.json`).
- **Redesplegar:** `railway up --service api --detach` desde esta carpeta (CLI ya logueado).
- Variables (`ANTHROPIC_API_KEY`, `WEBHOOK_SHARED_SECRET` de producción, etc.) viven en Railway → servicio `api` → Variables. El secret de producción es distinto al local.

## Prueba manual del pipeline completo

```bash
# 1. Simula un mensaje entrante de webchat
curl -X POST http://localhost:3000/webhooks/webchat \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: TU_SECRET" \
  -d '{"sessionId":"demo-1","name":"Ana","message":"Hola, somos una agencia de Cali. Necesitamos Punta Cana para 2 adultos del 10 al 15 de septiembre"}'

# 2. Mira el lead creado (score, intent, customerType, campos extraídos)
curl http://localhost:3000/crm/leads

# 3. Mira las respuestas pendientes de aprobación
curl http://localhost:3000/approvals/pending

# 4. Aprueba (o edita) la respuesta — solo aquí se "envía"
curl -X POST http://localhost:3000/approvals/<REPLY_ID>/approve \
  -H "Content-Type: application/json" \
  -d '{"approvedBy":"mabel","editedBody":"(opcional: tu versión editada)"}'

# 5. Auditoría de corridas del agente (modelo, tokens, latencia, confianza, gates)
curl http://localhost:3000/crm/agent-runs
```

También puedes simular WhatsApp con el formato real de Cloud API en `POST /webhooks/whatsapp`.

## Evals (el corazón del proyecto)

1. Exporta conversaciones reales de CTM y etiquétalas en `evals/dataset.jsonl` (plantilla: `evals/dataset.example.jsonl`). Meta: 300–500 casos.
2. `npm run evals` — mide exactitud de intent, customerType, destino, pax y escalamiento.
3. Esos números son el **gate** para subir de nivel de autonomía. Todo cambio de prompt se mide aquí antes de desplegarse.

## Tests

```bash
npm test          # unit: contratos Zod, gates duros, normalización de conectores
npm run test:e2e  # webhook end-to-end (requiere DB levantada)
```

## Qué NO tiene esta fase (a propósito)

Router multi-LLM, TikTok/Instagram, voz, Kubernetes, monorepo de 14 packages. Cada una de esas piezas se agrega **solo cuando los datos de evals y la operación lo justifiquen**. Ver `CLAUDE.md` para el roadmap por gates.
