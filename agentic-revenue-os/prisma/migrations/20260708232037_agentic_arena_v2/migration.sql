-- CreateEnum
CREATE TYPE "ArenaBattleStatus" AS ENUM ('PENDING', 'RESOLVED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ArenaTaskType" AS ENUM ('PACKAGE_ASSEMBLY', 'PROMPT_EVALUATION', 'HUMAN_REVIEW', 'CUSTOM');

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "avatarUrl" TEXT NOT NULL DEFAULT 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskType" "ArenaTaskType" NOT NULL DEFAULT 'PACKAGE_ASSEMBLY',
    "status" "ArenaBattleStatus" NOT NULL DEFAULT 'PENDING',
    "winnerParticipantId" TEXT,
    "createdByUserId" TEXT,
    "promptHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleParticipant" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "agentIdSnapshot" TEXT NOT NULL,
    "aliasSnapshot" TEXT NOT NULL,
    "modelSnapshot" TEXT NOT NULL,
    "outputData" JSONB,
    "errorMessage" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "tokenCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "approved" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentProfile_tenantId_idx" ON "AgentProfile"("tenantId");

-- CreateIndex
CREATE INDEX "AgentProfile_tenantId_elo_idx" ON "AgentProfile"("tenantId", "elo");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_tenantId_agentId_key" ON "AgentProfile"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "Battle_tenantId_status_createdAt_idx" ON "Battle"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BattleParticipant_profileId_idx" ON "BattleParticipant"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleParticipant_battleId_profileId_key" ON "BattleParticipant"("battleId", "profileId");

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AgentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
