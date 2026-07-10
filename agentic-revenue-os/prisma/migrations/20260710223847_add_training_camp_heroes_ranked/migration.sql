-- AlterTable
ALTER TABLE "AgentDailyMetric" ADD COLUMN     "churnCaused" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "churnPrevented" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conversations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hallucinations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revenueAttributed" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AgentProfile" ADD COLUMN     "revenueGenerated" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'IRON',
ADD COLUMN     "tierDivision" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "coachFeedback" TEXT,
    "rating" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "memoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "splashUrl" TEXT NOT NULL DEFAULT '',
    "model3dUrl" TEXT NOT NULL DEFAULT '',
    "passive" TEXT NOT NULL DEFAULT '',
    "ultimate" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeroTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillNode" (
    "id" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abilitySlot" TEXT NOT NULL,
    "skillMd" TEXT NOT NULL,
    "xpCost" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "SkillNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAgentHero" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "activeSkinId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAgentHero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "skillNodeId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueAttribution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "amountUsd" DECIMAL(14,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'deal_won',
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentMemory_tenantAgentId_type_idx" ON "AgentMemory"("tenantAgentId", "type");

-- CreateIndex
CREATE INDEX "AgentMemory_tenantId_idx" ON "AgentMemory"("tenantId");

-- CreateIndex
CREATE INDEX "TrainingSession_tenantAgentId_status_idx" ON "TrainingSession"("tenantAgentId", "status");

-- CreateIndex
CREATE INDEX "TrainingSession_tenantId_idx" ON "TrainingSession"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "HeroTemplate_slug_key" ON "HeroTemplate"("slug");

-- CreateIndex
CREATE INDEX "SkillNode_heroId_idx" ON "SkillNode"("heroId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAgentHero_tenantAgentId_key" ON "TenantAgentHero"("tenantAgentId");

-- CreateIndex
CREATE INDEX "TenantAgentHero_tenantId_idx" ON "TenantAgentHero"("tenantId");

-- CreateIndex
CREATE INDEX "AgentSkill_tenantId_idx" ON "AgentSkill"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkill_tenantAgentId_skillNodeId_key" ON "AgentSkill"("tenantAgentId", "skillNodeId");

-- CreateIndex
CREATE INDEX "RevenueAttribution_tenantId_idx" ON "RevenueAttribution"("tenantId");

-- CreateIndex
CREATE INDEX "RevenueAttribution_tenantAgentId_idx" ON "RevenueAttribution"("tenantAgentId");

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_tenantAgentId_fkey" FOREIGN KEY ("tenantAgentId") REFERENCES "TenantAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_tenantAgentId_fkey" FOREIGN KEY ("tenantAgentId") REFERENCES "TenantAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillNode" ADD CONSTRAINT "SkillNode_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "HeroTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillNode" ADD CONSTRAINT "SkillNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SkillNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAgentHero" ADD CONSTRAINT "TenantAgentHero_tenantAgentId_fkey" FOREIGN KEY ("tenantAgentId") REFERENCES "TenantAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAgentHero" ADD CONSTRAINT "TenantAgentHero_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "HeroTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_tenantAgentId_fkey" FOREIGN KEY ("tenantAgentId") REFERENCES "TenantAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_skillNodeId_fkey" FOREIGN KEY ("skillNodeId") REFERENCES "SkillNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
