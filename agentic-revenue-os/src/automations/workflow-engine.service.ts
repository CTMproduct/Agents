import { Injectable, Logger } from '@nestjs/common';
import { ExecutionStatus, Prisma, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AgentRunnerService } from '../agents/agent-runner.service';
import { randomUUID } from 'crypto';

export interface WorkflowNode {
  id: string;
  type: string; // trigger.manual | trigger.webhook | agent.run | condition.if | human.approval | webhook.response
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // para condition.if: "true" | "false"
}

interface NodeResult {
  status: 'success' | 'failed' | 'waiting';
  output?: unknown;
  error?: string;
  latencyMs?: number;
}

/**
 * Motor de ejecucion de workflows (patron n8n): recorre el grafo desde el
 * trigger siguiendo edges, guarda el output de cada nodo (ejecucion paso a
 * paso visible en la UI), pausa en human.approval creando un PendingReview,
 * y se reanuda cuando el humano decide. Nodos v1:
 *   trigger.manual / trigger.webhook  -> entregan el input inicial
 *   agent.run                         -> corre el TenantAgent del workflow
 *   condition.if                      -> evalua "contains" sobre un campo
 *   human.approval                    -> pausa hasta aprobar/rechazar
 *   webhook.response                  -> define la respuesta final
 */
@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private readonly MAX_STEPS = Number(process.env.MAX_WORKFLOW_STEPS ?? 50);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRunner: AgentRunnerService,
    private readonly audit: AuditService,
  ) {}

  /** Arranca una ejecucion desde el trigger. */
  async execute(workflowId: string, tenantId: string, input: unknown): Promise<{ executionId: string }> {
    const workflow = await this.prisma.automationWorkflow.findFirst({ where: { id: workflowId, tenantId } });
    if (!workflow) throw new Error('Workflow no encontrado en tu empresa');

    const execution = await this.prisma.automationExecution.create({
      data: { workflowId: workflow.id, tenantId, status: ExecutionStatus.RUNNING, input: (input ?? {}) as Prisma.InputJsonValue },
    });
    await this.prisma.automationWorkflow.update({ where: { id: workflow.id }, data: { lastRunAt: new Date() } });

    const nodes = workflow.nodes as unknown as WorkflowNode[];
    const trigger = nodes.find((n) => n.type.startsWith('trigger.'));
    if (!trigger) {
      await this.finish(execution.id, ExecutionStatus.FAILED, {}, undefined, 'El workflow no tiene nodo trigger');
      return { executionId: execution.id };
    }

    const nodeOutputs: Record<string, NodeResult> = {
      [trigger.id]: { status: 'success', output: input ?? {} },
    };
    await this.runFrom(execution.id, workflow.id, tenantId, trigger.id, nodeOutputs, 0);
    return { executionId: execution.id };
  }

  /** Reanuda una ejecucion pausada en human.approval (llamado por la Review Console). */
  async resume(executionId: string, tenantId: string, approved: boolean, finalText?: string): Promise<void> {
    const execution = await this.prisma.automationExecution.findFirst({
      where: { id: executionId, tenantId, status: ExecutionStatus.WAITING_FOR_APPROVAL },
      include: { workflow: true },
    });
    if (!execution || !execution.pausedNodeId) return;

    const nodeOutputs = (execution.nodeOutputs ?? {}) as unknown as Record<string, NodeResult>;
    if (!approved) {
      nodeOutputs[execution.pausedNodeId] = { status: 'failed', error: 'Rechazado por el revisor' };
      await this.finish(execution.id, ExecutionStatus.CANCELLED, nodeOutputs, undefined, 'Rechazado en revision humana');
      return;
    }

    nodeOutputs[execution.pausedNodeId] = {
      status: 'success',
      output: { approved: true, text: finalText ?? this.approvalDraft(nodeOutputs, execution.pausedNodeId) },
    };
    await this.prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: ExecutionStatus.RUNNING, pausedNodeId: null, nodeOutputs: nodeOutputs as unknown as Prisma.InputJsonValue },
    });
    await this.runFrom(execution.id, execution.workflowId, tenantId, execution.pausedNodeId, nodeOutputs, 0);
  }

  private approvalDraft(outputs: Record<string, NodeResult>, approvalNodeId: string): string {
    // El borrador que se aprobo: el output del agent.run previo si existe.
    for (const r of Object.values(outputs)) {
      const out = r.output as { text?: string } | undefined;
      if (out?.text) return out.text;
    }
    return '';
  }

  /** Ejecuta el grafo desde los sucesores de fromNodeId. */
  private async runFrom(
    executionId: string,
    workflowId: string,
    tenantId: string,
    fromNodeId: string,
    nodeOutputs: Record<string, NodeResult>,
    depth: number,
  ): Promise<void> {
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id: workflowId } });
    if (!workflow) return;
    const nodes = workflow.nodes as unknown as WorkflowNode[];
    const edges = workflow.edges as unknown as WorkflowEdge[];

    let current = this.nextNode(fromNodeId, nodes, edges, nodeOutputs);
    let steps = depth;
    let finalOutput: unknown = undefined;

    while (current && steps < this.MAX_STEPS) {
      steps++;
      const started = Date.now();
      try {
        const result = await this.executeNode(current, nodeOutputs, workflow.tenantAgentId, tenantId, executionId);
        result.latencyMs = Date.now() - started;
        nodeOutputs[current.id] = result;

        if (result.status === 'waiting') {
          await this.prisma.automationExecution.update({
            where: { id: executionId },
            data: {
              status: ExecutionStatus.WAITING_FOR_APPROVAL,
              pausedNodeId: current.id,
              nodeOutputs: nodeOutputs as unknown as Prisma.InputJsonValue,
            },
          });
          return; // se reanuda via resume()
        }
        if (result.status === 'failed') {
          await this.finish(executionId, ExecutionStatus.FAILED, nodeOutputs, undefined, result.error);
          return;
        }
        if (current.type === 'webhook.response') {
          finalOutput = result.output;
        }
      } catch (e) {
        nodeOutputs[current.id] = { status: 'failed', error: (e as Error).message, latencyMs: Date.now() - started };
        await this.finish(executionId, ExecutionStatus.FAILED, nodeOutputs, undefined, (e as Error).message);
        return;
      }
      current = this.nextNode(current.id, nodes, edges, nodeOutputs);
    }

    await this.finish(executionId, ExecutionStatus.SUCCESS, nodeOutputs, finalOutput);
  }

  private nextNode(
    fromId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    outputs: Record<string, NodeResult>,
  ): WorkflowNode | undefined {
    const from = nodes.find((n) => n.id === fromId);
    const outgoing = edges.filter((e) => e.source === fromId);
    if (!outgoing.length) return undefined;

    // condition.if: sigue el edge cuyo sourceHandle coincide con el resultado
    if (from?.type === 'condition.if') {
      const branch = ((outputs[fromId]?.output as { result?: boolean })?.result ?? false) ? 'true' : 'false';
      const edge = outgoing.find((e) => (e.sourceHandle ?? 'true') === branch) ?? outgoing[0];
      return nodes.find((n) => n.id === edge.target);
    }
    return nodes.find((n) => n.id === outgoing[0].target);
  }

  private async executeNode(
    node: WorkflowNode,
    outputs: Record<string, NodeResult>,
    defaultAgentId: string | null,
    tenantId: string,
    executionId: string,
  ): Promise<NodeResult> {
    const triggerOutput = Object.values(outputs)[0]?.output as Record<string, unknown> | undefined;
    const lastText = (): string => {
      for (const r of [...Object.values(outputs)].reverse()) {
        const out = r.output as { text?: string; message?: string } | undefined;
        if (out?.text) return out.text;
        if (out?.message) return String(out.message);
      }
      return JSON.stringify(triggerOutput ?? {});
    };

    switch (node.type) {
      case 'agent.run': {
        const agentId = (node.data.agentId as string) || defaultAgentId;
        if (!agentId) return { status: 'failed', error: 'El nodo agent.run no tiene agente asignado' };
        const message =
          (node.data.messageTemplate as string)?.replace('{{input}}', lastText()) ||
          (triggerOutput?.message as string) ||
          lastText();
        const result = await this.agentRunner.runTenantAgent(agentId, tenantId, {
          conversationText: message,
          traceId: randomUUID(),
        });
        if (!result) return { status: 'failed', error: 'El agente no existe o esta inactivo' };
        return { status: 'success', output: { text: result.text, agentRunId: result.agentRunId, toolCalls: result.toolCalls } };
      }

      case 'condition.if': {
        const field = String(node.data.field ?? 'text');
        const contains = String(node.data.contains ?? '');
        const haystack = field === 'text' ? lastText() : JSON.stringify(triggerOutput?.[field] ?? '');
        const result = contains ? haystack.toLowerCase().includes(contains.toLowerCase()) : true;
        return { status: 'success', output: { result } };
      }

      case 'human.approval': {
        const review = await this.prisma.pendingReview.create({
          data: {
            tenantId,
            tenantAgentId: defaultAgentId,
            executionId,
            channel: 'workflow',
            inputSummary: JSON.stringify(triggerOutput ?? {}).slice(0, 500),
            suggestedOutput: lastText().slice(0, 4000),
            status: ReviewStatus.PENDING,
          },
        });
        await this.audit.log({
          eventType: 'workflow.paused_for_approval',
          actor: 'system',
          entity: 'PendingReview',
          entityId: review.id,
          traceId: executionId,
        });
        return { status: 'waiting' };
      }

      case 'webhook.response': {
        const template = (node.data.template as string) || '{{text}}';
        return { status: 'success', output: { text: template.replace('{{text}}', lastText()) } };
      }

      default:
        // Nodo desconocido: pasa el flujo sin efecto (forward-compatible).
        return { status: 'success', output: outputs[node.id]?.output ?? {} };
    }
  }

  private async finish(
    executionId: string,
    status: ExecutionStatus,
    nodeOutputs: Record<string, NodeResult>,
    output?: unknown,
    error?: string,
  ): Promise<void> {
    await this.prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        status,
        nodeOutputs: nodeOutputs as unknown as Prisma.InputJsonValue,
        output: (output ?? null) as Prisma.InputJsonValue,
        error: error ?? null,
        finishedAt: new Date(),
      },
    });
    this.logger.log(`execution=${executionId} -> ${status}${error ? ` (${error})` : ''}`);
  }
}
