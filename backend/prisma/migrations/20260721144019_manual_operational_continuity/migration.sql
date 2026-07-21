-- AlterTable
ALTER TABLE "enrollment_documents" ADD COLUMN     "reviewNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "post_sale_states" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "lastHumanActionAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleReason" TEXT,
ADD COLUMN     "lifecycleStatus" TEXT NOT NULL DEFAULT 'ATIVO',
ADD COLUMN     "nextActionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "post_sale_tasks" ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "recurrenceIntervalDays" INTEGER,
ADD COLUMN     "updatedById" TEXT;

-- CreateIndex
CREATE INDEX "enrollment_documents_reviewedById_idx" ON "enrollment_documents"("reviewedById");

-- CreateIndex
CREATE INDEX "enrollments_assigneeId_idx" ON "enrollments"("assigneeId");

-- CreateIndex
CREATE INDEX "leads_createdById_idx" ON "leads"("createdById");

-- CreateIndex
CREATE INDEX "post_sale_states_assigneeId_idx" ON "post_sale_states"("assigneeId");

-- CreateIndex
CREATE INDEX "post_sale_states_schoolId_lifecycleStatus_nextActionAt_idx" ON "post_sale_states"("schoolId", "lifecycleStatus", "nextActionAt");

-- CreateIndex
CREATE INDEX "post_sale_tasks_createdById_idx" ON "post_sale_tasks"("createdById");

-- CreateIndex
CREATE INDEX "post_sale_tasks_updatedById_idx" ON "post_sale_tasks"("updatedById");

-- CreateIndex
CREATE INDEX "post_sale_tasks_completedById_idx" ON "post_sale_tasks"("completedById");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_documents" ADD CONSTRAINT "enrollment_documents_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_sale_states" ADD CONSTRAINT "post_sale_states_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_sale_tasks" ADD CONSTRAINT "post_sale_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_sale_tasks" ADD CONSTRAINT "post_sale_tasks_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_sale_tasks" ADD CONSTRAINT "post_sale_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
