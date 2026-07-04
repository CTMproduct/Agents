import { Controller, Get, Header } from '@nestjs/common';
import { SuggestedReplyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Consola minima en GET / para operar la Fase 1 sin herramientas externas:
 * estado del servicio + respuestas pendientes con aprobar/rechazar.
 * No es la "UI dedicada" del roadmap; es lo justo para el human-in-the-loop L0.
 */
@Controller()
export class RootController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  async console(): Promise<string> {
    const [pending, leads, runs] = await Promise.all([
      this.prisma.suggestedReply.findMany({
        where: { status: SuggestedReplyStatus.PENDING_APPROVAL },
        include: { conversation: { include: { contact: true } } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      this.prisma.lead.count(),
      this.prisma.agentRun.count(),
    ]);

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const rows = pending
      .map(
        (r) => `
      <div class="card" id="card-${r.id}">
        <div class="meta">${esc(r.conversation.contact.fullName ?? 'Sin nombre')} · ${r.conversation.channel} · ${new Date(r.createdAt).toLocaleString('es-CO')}</div>
        <textarea id="body-${r.id}">${esc(r.body)}</textarea>
        <div class="actions">
          <input id="who-${r.id}" placeholder="tu nombre" />
          <button onclick="act('${r.id}','approve')">Aprobar y enviar</button>
          <button class="reject" onclick="act('${r.id}','reject')">Rechazar</button>
        </div>
      </div>`,
      )
      .join('');

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><title>Agentic Revenue OS — Consola L0</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:780px;margin:2rem auto;padding:0 1rem;color:#1a1a2e}
  h1{font-size:1.3rem} .ok{color:#0a7d33} .stats{color:#555;margin-bottom:1.5rem}
  .card{border:1px solid #ddd;border-radius:8px;padding:1rem;margin-bottom:1rem;background:#fafafa}
  .meta{font-size:.85rem;color:#666;margin-bottom:.5rem}
  textarea{width:100%;min-height:90px;box-sizing:border-box;font:inherit;padding:.5rem}
  .actions{display:flex;gap:.5rem;margin-top:.5rem}
  input{flex:0 0 160px;padding:.4rem}
  button{padding:.45rem .9rem;border:0;border-radius:6px;background:#0a7d33;color:#fff;cursor:pointer}
  button.reject{background:#b3261e}
  a{color:#0b57d0}
</style></head><body>
  <h1>Agentic Revenue OS <span class="ok">● en linea</span></h1>
  <p class="stats">${leads} leads · ${runs} corridas de agente · ${pending.length} respuestas pendientes.
  API: <a href="/health">/health</a> · <a href="/crm/leads">/crm/leads</a> · <a href="/crm/agent-runs">/crm/agent-runs</a> · <a href="/approvals/pending">/approvals/pending</a></p>
  <h2>Pendientes de aprobación (Autonomía L0)</h2>
  ${rows || '<p>Nada pendiente. Los mensajes entrantes por /webhooks/webchat apareceran aqui.</p>'}
<script>
async function act(id, action){
  const who = document.getElementById('who-'+id).value.trim();
  if(!who){ alert('Escribe tu nombre para auditoria'); return; }
  const payload = { approvedBy: who };
  if(action==='approve') payload.editedBody = document.getElementById('body-'+id).value;
  const res = await fetch('/approvals/'+id+'/'+action, {
    method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload)
  });
  if(res.ok){ document.getElementById('card-'+id).remove(); }
  else { alert('Error: '+(await res.text())); }
}
</script>
</body></html>`;
  }
}
