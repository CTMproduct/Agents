-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_FOR_APPROVAL', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantAgentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publicId" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB,
    "nodeOutputs" JSONB,
    "output" JSONB,
    "error" TEXT,
    "pausedNodeId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantAgentId" TEXT,
    "executionId" TEXT,
    "agentRunId" TEXT,
    "channel" TEXT,
    "inputSummary" TEXT NOT NULL,
    "suggestedOutput" TEXT NOT NULL,
    "finalOutput" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "learningNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkillProposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantAgentId" TEXT NOT NULL,
    "proposalType" TEXT NOT NULL DEFAULT 'skill_update',
    "title" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkillProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutomationWorkflow_publicId_key" ON "AutomationWorkflow"("publicId");

-- CreateIndex
CREATE INDEX "AutomationWorkflow_tenantId_idx" ON "AutomationWorkflow"("tenantId");

-- CreateIndex
CREATE INDEX "AutomationExecution_tenantId_startedAt_idx" ON "AutomationExecution"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "PendingReview_tenantId_status_createdAt_idx" ON "PendingReview"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentSkillProposal_tenantId_status_idx" ON "AgentSkillProposal"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AutomationWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingReview" ADD CONSTRAINT "PendingReview_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
