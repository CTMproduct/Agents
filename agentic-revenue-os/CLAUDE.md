# Agentic Revenue OS — CTM En Línea

Plataforma agéntica de intake y calificación de leads turísticos para CTM En Línea (mayorista B2B, Bogotá). Este repo es la **Fase 1** de un roadmap empírico: cada expansión se gana con datos de evals, nunca con arquitectura aspiracional.

## Filosofía (no negociable)

1. **El CRM guarda la verdad. Los agentes solo proponen.** Nada de texto libre actualiza el CRM: todo output de agente pasa por Zod (`src/agents/schemas.ts`).
2. **Los gates de seguridad viven en código, no en el prompt.** Ver `applyHardGates()`. El prompt puede fallar; el código no negocia.
3. **Los prompts son código.** Todo cambio a `intake-agent.prompt.ts` se mide con `npm run evals` ANTES de desplegarse. Sin excepción.
4. **Autonomía escalonada (Responsible Scaling interno).** Arrancamos en L0 (humano aprueba el 100%). Subir de nivel requiere <2% de error en evals durante 4 semanas en esa categoría. Ver `AutonomyPolicy` en Prisma.
5. **Sin documento vigente, jamás se cotiza.** `KnowledgeDocument` exige `validFrom/validTo/supplier/currency`. Un agente nunca inventa tarifas — el gate anti-cifras en `applyHardGates` lo refuerza.
6. **Una abstracción se gana con el segundo caso de uso real.** No agregar routers multi-LLM, colas, k8s ni conectores nuevos "por si acaso".

## Arquitectura actual (Fase 1)

```
webhook (WhatsApp/webchat) → normalización → CRM (contacto/conversación/mensaje)
  → evento message.received → IntakeAgent (1 llamada a Claude, tool_use + Zod)
  → lead + score + tarea → SuggestedReply PENDING_APPROVAL
  → asesor aprueba/edita/rechaza en /approvals → recién ahí se envía
```

- `src/channels/` — conectores sin lógica comercial (reciben, normalizan, envían)
- `src/crm/` — verdad del negocio, sin IA adentro
- `src/agents/` — IntakeAgent + provider Anthropic + contratos Zod
- `src/workflows/` — orquestación por eventos (nunca en controllers)
- `src/approval/` — human-in-the-loop
- `evals/` — harness de medición (el corazón del proyecto)

## Comandos

```bash
docker compose up -d          # Postgres
npm install
npx prisma migrate dev        # migraciones
npm run prisma:seed           # políticas de autonomía en L0
npm run start:dev             # API en :3000
npm test                      # unit tests (siempre deben pasar)
npm run test:e2e              # requiere DB levantada
npm run evals                 # requiere ANTHROPIC_API_KEY
```

## Reglas de trabajo para Claude

- Haz cambios por fases; antes de escribir código, di qué archivos vas a tocar.
- Después de cada cambio: `npm run build && npm test` deben pasar.
- No inventes credenciales; todo por variables de entorno.
- No mezcles lógica de IA en controllers ni lógica comercial en conectores.
- Todo evento importante crea `AuditEvent`.
- No avances de fase sin que la fase actual compile, pase tests y esté medida.

## Roadmap (gates, no fechas)

- **Fase 0 (en paralelo, la más importante):** Mabel exporta 300–500 conversaciones reales de WhatsApp de CTM y las etiqueta en `evals/dataset.jsonl` (formato en `dataset.example.jsonl`).
- **Fase 2:** correr evals semanales; registrar tasa de rechazo/edición de los asesores como métrica de calidad de `suggestedReply`.
- **Fase 3:** RAG sobre tarifarios con proveniencia estricta (pgvector ya está en la imagen de Docker). Gate: extracción de intent/customerType >90% en evals.
- **Fase 4:** subir `informational_reply` a L1 solo si error <2% por 4 semanas.
- **Después (solo con datos que lo justifiquen):** WhatsApp Cloud API real, Instagram/email, copiloto de llamadas (transcribir → resumir → tareas), UI dedicada.
