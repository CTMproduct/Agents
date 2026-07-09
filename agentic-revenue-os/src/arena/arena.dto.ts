import { z } from 'zod';

/**
 * Validacion de entrada de la Arena. Ajuste vs el ZIP original: los IDs de
 * esta plataforma son cuid (no UUID), asi que se valida longitud, no formato UUID.
 */
const idSchema = z.string().trim().min(8).max(64);

export const StartBattleSchema = z
  .object({
    agentAId: idSchema,
    agentBId: idSchema,
    context: z.string().trim().min(10).max(50_000),
    taskType: z
      .enum(['PACKAGE_ASSEMBLY', 'PROMPT_EVALUATION', 'HUMAN_REVIEW', 'CUSTOM'])
      .default('PACKAGE_ASSEMBLY'),
  })
  .refine((data) => data.agentAId !== data.agentBId, {
    message: 'agentAId y agentBId deben ser diferentes.',
    path: ['agentBId'],
  });

export type StartBattleDto = z.infer<typeof StartBattleSchema>;

export const ResolveBattleSchema = z.object({
  winningParticipantId: idSchema,
});

export type ResolveBattleDto = z.infer<typeof ResolveBattleSchema>;
