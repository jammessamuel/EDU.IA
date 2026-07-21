-- CreateTable
CREATE TABLE "verticals" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "defaultFields" TEXT NOT NULL,
    "defaultStages" TEXT NOT NULL,
    "extractionPrompt" TEXT NOT NULL,

    CONSTRAINT "verticals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatbotName" TEXT NOT NULL DEFAULT 'IA Atendente',
    "verticalId" TEXT,
    "customFields" TEXT,
    "customStages" TEXT,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_profiles" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "businessHours" TEXT NOT NULL DEFAULT '{}',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "mapLink" TEXT NOT NULL DEFAULT '',
    "referencePoints" TEXT NOT NULL DEFAULT '',
    "transportInfo" TEXT NOT NULL DEFAULT '',
    "supportChannels" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_templates" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dayOffset" INTEGER,
    "whatsappText" TEXT NOT NULL,
    "defaultWhatsappText" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_offers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "duration" TEXT NOT NULL DEFAULT '',
    "modality" TEXT NOT NULL DEFAULT '',
    "shifts" TEXT NOT NULL DEFAULT '[]',
    "enrollmentFee" DECIMAL(10,2),
    "monthlyFee" DECIMAL(10,2),
    "cashDiscountPercent" DECIMAL(5,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requirements" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_conditions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cashDiscountPercent" DECIMAL(5,2),
    "campaignActive" BOOLEAN NOT NULL DEFAULT false,
    "campaignValidUntil" TIMESTAMP(3),
    "promotionText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "roleId" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screenReader" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "colorBlindMode" TEXT NOT NULL DEFAULT 'none',
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "simpleLanguage" BOOLEAN NOT NULL DEFAULT false,
    "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "data" TEXT NOT NULL DEFAULT '{}',
    "conversation" TEXT NOT NULL DEFAULT '[]',
    "qualified" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NOVO',
    "assigneeId" TEXT,
    "nextContactAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "leadId" TEXT,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "studentName" TEXT NOT NULL,
    "cpf" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "preferredLanguage" TEXT,
    "countryOfResidence" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "course" TEXT,
    "shift" TEXT,
    "unit" TEXT,
    "data" TEXT NOT NULL DEFAULT '{}',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDENTE',
    "paymentMethod" TEXT,
    "paymentAmount" DECIMAL(10,2),
    "paymentRef" TEXT,
    "authCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "humanConfirmedAt" TIMESTAMP(3),
    "humanConfirmedById" TEXT,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_documents" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "content" BYTEA,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_sale_states" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentKey" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "status" TEXT,
    "documentStatus" TEXT,
    "contractStatus" TEXT,
    "paymentStatus" TEXT,
    "accessStatus" TEXT,
    "riskScore" INTEGER,
    "nextAction" TEXT,
    "ownerTeam" TEXT,
    "notes" TEXT,
    "nextContactAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "lastContactChannel" TEXT,
    "lastContactOutcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_sale_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_sale_tasks" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentKey" TEXT,
    "leadId" TEXT,
    "enrollmentId" TEXT,
    "studentName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerTeam" TEXT NOT NULL,
    "assignee" TEXT NOT NULL DEFAULT '',
    "assigneeId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'secretaria',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "column" TEXT NOT NULL DEFAULT 'a_fazer',
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "createdBy" TEXT NOT NULL DEFAULT 'humano',
    "automation" TEXT,
    "relatedEntity" TEXT NOT NULL DEFAULT '{}',
    "autoResolve" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3),
    "firstMovedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_sale_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_attempts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentKey" TEXT,
    "leadId" TEXT,
    "channel" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "nextContactAt" TIMESTAMP(3),
    "contactedById" TEXT,
    "contactedByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_sale_events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentKey" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "studentName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_sale_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentKey" TEXT,
    "enrollmentId" TEXT,
    "studentName" TEXT,
    "service" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestPayload" TEXT NOT NULL DEFAULT '{}',
    "responsePayload" TEXT NOT NULL DEFAULT '{}',
    "visibleMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verticals_slug_key" ON "verticals"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "schools_subdomain_key" ON "schools"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "school_profiles_schoolId_key" ON "school_profiles"("schoolId");

-- CreateIndex
CREATE INDEX "communication_templates_schoolId_active_idx" ON "communication_templates"("schoolId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "communication_templates_schoolId_key_key" ON "communication_templates"("schoolId", "key");

-- CreateIndex
CREATE INDEX "course_offers_schoolId_active_idx" ON "course_offers"("schoolId", "active");

-- CreateIndex
CREATE INDEX "document_requirements_schoolId_audience_active_idx" ON "document_requirements"("schoolId", "audience", "active");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_conditions_schoolId_key" ON "commercial_conditions"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_scope_key" ON "permissions"("resource", "action", "scope");

-- CreateIndex
CREATE INDEX "users_schoolId_idx" ON "users"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "users_schoolId_email_key" ON "users"("schoolId", "email");

-- CreateIndex
CREATE INDEX "leads_schoolId_idx" ON "leads"("schoolId");

-- CreateIndex
CREATE INDEX "leads_assigneeId_idx" ON "leads"("assigneeId");

-- CreateIndex
CREATE INDEX "leads_schoolId_nextContactAt_idx" ON "leads"("schoolId", "nextContactAt");

-- CreateIndex
CREATE INDEX "enrollments_schoolId_idx" ON "enrollments"("schoolId");

-- CreateIndex
CREATE INDEX "enrollments_humanConfirmedById_idx" ON "enrollments"("humanConfirmedById");

-- CreateIndex
CREATE INDEX "enrollments_cpf_idx" ON "enrollments"("cpf");

-- CreateIndex
CREATE INDEX "enrollments_documentNumber_idx" ON "enrollments"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_schoolId_number_key" ON "enrollments"("schoolId", "number");

-- CreateIndex
CREATE INDEX "enrollment_documents_enrollmentId_idx" ON "enrollment_documents"("enrollmentId");

-- CreateIndex
CREATE INDEX "post_sale_states_schoolId_idx" ON "post_sale_states"("schoolId");

-- CreateIndex
CREATE INDEX "post_sale_states_enrollmentId_idx" ON "post_sale_states"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "post_sale_states_schoolId_studentKey_key" ON "post_sale_states"("schoolId", "studentKey");

-- CreateIndex
CREATE INDEX "post_sale_tasks_schoolId_idx" ON "post_sale_tasks"("schoolId");

-- CreateIndex
CREATE INDEX "post_sale_tasks_assigneeId_idx" ON "post_sale_tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "post_sale_tasks_studentKey_idx" ON "post_sale_tasks"("studentKey");

-- CreateIndex
CREATE INDEX "post_sale_tasks_leadId_idx" ON "post_sale_tasks"("leadId");

-- CreateIndex
CREATE INDEX "post_sale_tasks_enrollmentId_idx" ON "post_sale_tasks"("enrollmentId");

-- CreateIndex
CREATE INDEX "post_sale_tasks_schoolId_status_idx" ON "post_sale_tasks"("schoolId", "status");

-- CreateIndex
CREATE INDEX "post_sale_tasks_schoolId_column_idx" ON "post_sale_tasks"("schoolId", "column");

-- CreateIndex
CREATE INDEX "post_sale_tasks_schoolId_origin_idx" ON "post_sale_tasks"("schoolId", "origin");

-- CreateIndex
CREATE INDEX "contact_attempts_schoolId_idx" ON "contact_attempts"("schoolId");

-- CreateIndex
CREATE INDEX "contact_attempts_studentKey_idx" ON "contact_attempts"("studentKey");

-- CreateIndex
CREATE INDEX "contact_attempts_leadId_idx" ON "contact_attempts"("leadId");

-- CreateIndex
CREATE INDEX "contact_attempts_schoolId_nextContactAt_idx" ON "contact_attempts"("schoolId", "nextContactAt");

-- CreateIndex
CREATE INDEX "post_sale_events_schoolId_idx" ON "post_sale_events"("schoolId");

-- CreateIndex
CREATE INDEX "post_sale_events_studentKey_idx" ON "post_sale_events"("studentKey");

-- CreateIndex
CREATE INDEX "post_sale_events_enrollmentId_idx" ON "post_sale_events"("enrollmentId");

-- CreateIndex
CREATE INDEX "integration_logs_schoolId_createdAt_idx" ON "integration_logs"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "integration_logs_studentKey_idx" ON "integration_logs"("studentKey");

-- CreateIndex
CREATE INDEX "integration_logs_enrollmentId_idx" ON "integration_logs"("enrollmentId");

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "verticals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_profiles" ADD CONSTRAINT "school_profiles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offers" ADD CONSTRAINT "course_offers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requirements" ADD CONSTRAINT "document_requirements_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_conditions" ADD CONSTRAINT "commercial_conditions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_humanConfirmedById_fkey" FOREIGN KEY ("humanConfirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_documents" ADD CONSTRAINT "enrollment_documents_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_sale_tasks" ADD CONSTRAINT "post_sale_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attempts" ADD CONSTRAINT "contact_attempts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attempts" ADD CONSTRAINT "contact_attempts_contactedById_fkey" FOREIGN KEY ("contactedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
