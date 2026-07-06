-- AlterTable
ALTER TABLE "AgentDefinition" ADD COLUMN     "modelName" TEXT;

-- AlterTable
ALTER TABLE "TenantAgent" ADD COLUMN     "modelName" TEXT;

-- CreateTable
CREATE TABLE "TenantAgentSkill" (
    "id" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAgentKnowledge" (
    "id" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAgentKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantAgentSkill_tenantAgentId_position_idx" ON "TenantAgentSkill"("tenantAgentId", "position");

-- CreateIndex
CREATE INDEX "TenantAgentKnowledge_tenantAgentId_idx" ON "TenantAgentKnowledge"("tenantAgentId");

-- AddForeignKey
ALTER TABLE "TenantAgentSkill" ADD CONSTRAINT "TenantAgentSkill_tenantAgentId_fkey" FOREIGN KEY ("tenantAgentId") REFERENCES "TenantAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAgentKnowledge" ADD CONSTRAINT "TenantAgentKnowledge_tenantAgentId_fkey" FOREIGN KEY ("tenantAgentId") REFERENCES "TenantAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
