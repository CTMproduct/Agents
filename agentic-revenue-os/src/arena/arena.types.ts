/** Forma minima que la Arena necesita de un agente (subset de TenantAgent). */
export type ArenaAgentConfig = {
  id: string;
  tenantId: string;
  name?: string | null;
  modelName?: string | null; // null = modelo por defecto de la plataforma
  skillMd?: string | null;
};

/** Resultado de ejecutar un agente en batalla: exito o fallo, nunca rompe la batalla. */
export type AgentRunResult =
  | {
      ok: true;
      output: unknown;
      inputTokens: number;
      outputTokens: number;
      tokenCost: number;
      latencyMs: number;
      modelUsed: string;
    }
  | {
      ok: false;
      errorMessage: string;
      inputTokens: number;
      outputTokens: number;
      tokenCost: number;
      latencyMs: number;
      modelUsed: string;
    };

/** Actualizacion de ranking tras resolver una batalla. */
export type EloUpdate = {
  profileId: string;
  oldElo: number;
  newElo: number;
  isWinner: boolean;
  xpGain: number;
  newXp: number;
  newLevel: number;
};
