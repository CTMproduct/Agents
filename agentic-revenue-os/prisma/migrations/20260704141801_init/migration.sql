-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('DIRECT_CLIENT', 'AGENCY', 'FREELANCER', 'CORPORATE', 'GROUP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'WEBCHAT', 'EMAIL', 'INSTAGRAM', 'FACEBOOK', 'PHONE');

-- CreateEnum
CREATE TYPE "LeadIntent" AS ENUM ('INFORMATION', 'QUOTE_REQUEST', 'READY_TO_BOOK', 'POST_SALE', 'COMPLAINT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'IN_PROGRESS', 'ESCALATED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "SuggestedReplyStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT');

-- CreateEnum
CREATE TYPE "AutonomyLevel" AS ENUM ('L0_HUMAN_APPROVES_ALL', 'L1_AUTO_INFORMATIONAL', 'L2_AUTO_FOLLOWUP', 'L3_AUTO_QUOTE_DRAFT');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'UNKNOWN',
    "nit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "customerType" "CustomerType" NOT NULL DEFAULT 'UNKNOWN',
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelIdentity" (
    "id" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "intent" "LeadIntent" NOT NULL DEFAULT 'UNKNOWN',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "destination" TEXT,
    "travelDateFrom" TIMESTAMP(3),
    "travelDateTo" TIMESTAMP(3),
    "paxAdults" INTEGER,
    "paxChildren" INTEGER,
    "budgetAmount" DECIMAL(14,2),
    "budgetCurrency" TEXT,
    "score" DOUBLE PRECISION,
    "scoreReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "body" TEXT NOT NULL,
    "rawPayload" JSONB,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputJson" JSONB NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "confidenceScore" DOUBLE PRECISION,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "traceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedReply" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SuggestedReplyStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "agentRunId" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestedReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "actor" TEXT NOT NULL,
    "payload" JSONB,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "supplier" TEXT,
    "market" TEXT,
    "currency" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "customerTypeVisibility" "CustomerType"[],
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomyPolicy" (
    "id" TEXT NOT NULL,
    "taskCategory" TEXT NOT NULL,
    "level" "AutonomyLevel" NOT NULL DEFAULT 'L0_HUMAN_APPROVES_ALL',
    "evalErrorPct" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutonomyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_nit_key" ON "Account"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelIdentity_channel_externalId_key" ON "ChannelIdentity"("channel", "externalId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_agentName_createdAt_idx" ON "AgentRun"("agentName", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_createdAt_idx" ON "AuditEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_validFrom_validTo_idx" ON "KnowledgeDocument"("validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomyPolicy_taskCategory_key" ON "AutonomyPolicy"("taskCategory");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelIdentity" ADD CONSTRAINT "ChannelIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedReply" ADD CONSTRAINT "SuggestedReply_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
