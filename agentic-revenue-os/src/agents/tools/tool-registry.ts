import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ToolContext {
  contactId?: string;
  leadId?: string | null;
  /** Presente cuando corre un agente del marketplace: aisla su knowledge base. */
  tenantAgentId?: string;
  traceId: string;
}

/** Contrato de un conector: nombre, schema JSON de entrada, ejecucion. */
export interface AgentTool {
  key: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** true = seguro para agentes de tenants externos del marketplace (no toca datos internos de CTM). */
  marketplacePublic: boolean;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

/** Declaracion de una herramienta ejecutada por Anthropic (no por nuestro codigo). */
export interface ServerTool {
  key: string;
  anthropicType: string;
  anthropicName: string;
  marketplacePublic: boolean;
}

/**
 * Registro de conectores. Agregar una API nueva = agregar una entrada aqui
 * (o inyectar un provider externo) y referenciarla por key en AgentDefinition.toolKeys
 * (agentes internos de CTM) o TenantAgent.toolKeys (agentes del marketplace).
 * knowledge_search/crm_lookup leen datos internos de CTM: NO son marketplacePublic,
 * asi un tenant externo nunca puede alcanzar el CRM de otro tenant por error.
 */
@Injectable()
export class ToolRegistry {
  private readonly clientTools = new Map<string, AgentTool>();
  private readonly serverTools = new Map<string, ServerTool>();

  constructor(private readonly prisma: PrismaService) {
    this.register(this.buildKnowledgeSearchTool());
    this.register(this.buildCrmLookupTool());
    this.register(this.buildAgentKnowledgeTool());
    this.registerServerTool({
      key: 'web_search',
      anthropicType: 'web_search_20260209',
      anthropicName: 'web_search',
      marketplacePublic: true,
    });
  }

  register(tool: AgentTool) {
    this.clientTools.set(tool.key, tool);
  }

  registerServerTool(tool: ServerTool) {
    this.serverTools.set(tool.key, tool);
  }

  resolveClientTools(keys: string[]): AgentTool[] {
    return keys.map((k) => this.clientTools.get(k)).filter((t): t is AgentTool => !!t);
  }

  resolveServerTools(keys: string[]): ServerTool[] {
    return keys.map((k) => this.serverTools.get(k)).filter((t): t is ServerTool => !!t);
  }

  /** Conectores que un tenant del marketplace puede habilitar en su propio agente. */
  listMarketplacePublic(): Array<{ key: string; name: string; description: string }> {
    const client = [...this.clientTools.values()]
      .filter((t) => t.marketplacePublic)
      .map((t) => ({ key: t.key, name: t.name, description: t.description }));
    const server = [...this.serverTools.values()]
      .filter((t) => t.marketplacePublic)
      .map((t) => ({ key: t.key, name: t.anthropicName, description: 'Herramienta de servidor (Anthropic).' }));
    return [...client, ...server];
  }

  /** Filtra una lista de toolKeys dejando solo los seguros para tenants externos. */
  filterMarketplacePublic(keys: string[]): string[] {
    const publicKeys = new Set(this.listMarketplacePublic().map((t) => t.key));
    return keys.filter((k) => publicKeys.has(k));
  }

  /** Consulta tarifarios/documentos VIGENTES. El gate "sin documento vigente no se cotiza" vive aqui. */
  private buildKnowledgeSearchTool(): AgentTool {
    return {
      key: 'knowledge_search',
      name: 'knowledge_search',
      description:
        'Busca documentos de conocimiento (tarifarios, politicas) VIGENTES por destino/mercado. ' +
        'Si no hay resultados, no existe informacion vigente y no se debe cotizar.',
      inputSchema: {
        type: 'object',
        properties: {
          market: { type: 'string', description: 'Mercado o destino, ej. CARIBE, EUROPA, Punta Cana' },
        },
        required: ['market'],
      },
      marketplacePublic: false,
      execute: async (input) => {
        const market = String(input.market ?? '');
        const now = new Date();
        const docs = await this.prisma.knowledgeDocument.findMany({
          where: {
            market: { contains: market, mode: 'insensitive' },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
            AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }],
          },
          take: 3,
          select: { title: true, supplier: true, currency: true, validTo: true, content: true },
        });
        return docs.length
          ? { found: true, documents: docs }
          : { found: false, message: `Sin documentos vigentes para "${market}". No cotizar.` };
      },
    };
  }

  /**
   * Knowledge base propia del agente del marketplace: busca SOLO en los
   * documentos del TenantAgent que esta corriendo (ctx.tenantAgentId).
   * Es marketplacePublic porque no puede tocar datos de otros tenants.
   */
  private buildAgentKnowledgeTool(): AgentTool {
    return {
      key: 'agent_knowledge',
      name: 'agent_knowledge',
      description:
        'Busca en la base de conocimiento propia de este agente (documentos que subio la empresa: ' +
        'catalogos, politicas, precios, FAQs). Usala antes de responder preguntas sobre la empresa.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Palabras clave a buscar en titulo o contenido' },
        },
        required: ['query'],
      },
      marketplacePublic: true,
      execute: async (input, ctx) => {
        if (!ctx.tenantAgentId) return { found: false, message: 'Este agente no tiene knowledge base.' };
        const query = String(input.query ?? '').trim();
        const docs = await this.prisma.tenantAgentKnowledge.findMany({
          where: {
            tenantAgentId: ctx.tenantAgentId,
            active: true,
            ...(query
              ? {
                  OR: [
                    { title: { contains: query, mode: 'insensitive' } },
                    { content: { contains: query, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          take: 3,
          select: { title: true, content: true },
        });
        return docs.length
          ? { found: true, documents: docs.map((d) => ({ title: d.title, content: d.content.slice(0, 4000) })) }
          : { found: false, message: `Sin documentos que coincidan con "${query}".` };
      },
    };
  }

  /** Historial del contacto en el propio CRM de CTM: leads previos, tareas abiertas. */
  private buildCrmLookupTool(): AgentTool {
    return {
      key: 'crm_lookup',
      name: 'crm_lookup',
      description: 'Consulta el historial de leads y tareas abiertas del contacto actual en el CRM.',
      inputSchema: { type: 'object', properties: {} },
      marketplacePublic: false,
      execute: async (_input, ctx) => {
        if (!ctx.contactId) return { leads: [] };
        const leads = await this.prisma.lead.findMany({
          where: { contactId: ctx.contactId },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { intent: true, status: true, destination: true, score: true, updatedAt: true },
        });
        return { leads };
      },
    };
  }
}
