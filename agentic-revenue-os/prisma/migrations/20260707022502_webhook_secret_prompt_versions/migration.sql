-- AlterTable
ALTER TABLE "AutomationWorkflow" ADD COLUMN     "webhookSecret" TEXT;

-- CreateTable
CREATE TABLE "TenantAgentPromptVersion" (
    "id" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "skillMd" TEXT NOT NULL,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAgentPromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantAgentPromptVersion_tenantAgentId_version_idx" ON "TenantAgentPromptVersion"("tenantAgentId", "version");
