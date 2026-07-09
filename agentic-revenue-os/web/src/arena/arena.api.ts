import { api } from '../api';

export interface AgentProfile {
  id: string;
  alias: string;
  avatarUrl: string;
  level: number;
  elo: number;
  xp: number;
  wins: number;
  losses: number;
}

export interface BattleParticipant {
  id: string;
  aliasSnapshot: string;
  modelSnapshot: string;
  outputData: unknown;
  errorMessage: string | null;
  inputTokens: number;
  outputTokens: number;
  tokenCost: string | number;
  latencyMs: number;
  approved: boolean | null;
  profile: AgentProfile;
}

export interface ArenaBattle {
  id: string;
  taskType: string;
  status: 'PENDING' | 'RESOLVED' | 'FAILED' | 'CANCELLED';
  winnerParticipantId: string | null;
  createdAt: string;
  participants: BattleParticipant[];
}

export const startArenaBattle = (agentAId: string, agentBId: string, context: string) =>
  api<ArenaBattle>('/arena/start', { method: 'POST', body: JSON.stringify({ agentAId, agentBId, context }) });

export const getArenaBattle = (id: string) => api<ArenaBattle>(`/arena/${id}`);

export const listArenaBattles = () => api<ArenaBattle[]>('/arena/battles');

export const getLeaderboard = () => api<AgentProfile[]>('/arena/leaderboard');

export const resolveArenaBattle = (battleId: string, winningParticipantId: string) =>
  api<ArenaBattle>(`/arena/${battleId}/resolve`, { method: 'POST', body: JSON.stringify({ winningParticipantId }) });
