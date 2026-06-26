import { BadRequestException, Injectable } from '@nestjs/common';
import { FakeContractAction, FakeContractService } from '../integrations/fake-contract.service';
import { FakeDocumentAction, FakeDocumentService } from '../integrations/fake-document.service';
import { FakePaymentAction, FakePaymentService } from '../integrations/fake-payment.service';
import { FakeWhatsAppService } from '../integrations/fake-whatsapp.service';
import { IntegrationLogService } from '../integrations/integration-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeSchoolConfig, SchoolConfigService } from '../school-config/school-config.service';

type LifecycleStatus =
  | 'DOCUMENTACAO_PENDENTE'
  | 'CONTRATO_PENDENTE'
  | 'PAGAMENTO_PENDENTE'
  | 'ACESSO_PENDENTE'
  | 'EM_ACOMPANHAMENTO'
  | 'RISCO_EVASAO'
  | 'ONBOARDING_CONCLUIDO';

type RiskLevel = 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';
type StepStatus = 'done' | 'pending' | 'blocked' | 'attention';
type PostSaleAction =
  | 'DOCUMENTS_RECEIVED'
  | 'CONTRACT_SENT'
  | 'CONTRACT_SIGNED'
  | 'PAYMENT_PAID'
  | 'ACCESS_RELEASED'
  | 'RISK_RESOLVED';

interface ChecklistStep {
  key: string;
  label: string;
  status: StepStatus;
  helper: string;
}

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  createdAt: Date;
  source: 'system' | 'manual';
}

interface StudentRulerStatus {
  status: 'PENDENTE' | 'AGENDADA' | 'CONCLUIDA';
  nextDay: number | null;
  nextTitle: string | null;
  nextMessage: string | null;
  sentDays: number[];
  sentCount: number;
  pendingCount: number;
  lastSentAt: Date | null;
}

interface LifecycleStudent {
  id: string;
  enrollmentId: string | null;
  studentName: string;
  course: string;
  startedAt: Date;
  status: LifecycleStatus;
  statusLabel: string;
  progress: number;
  riskScore: number;
  riskLevel: RiskLevel;
  documentStatus: string;
  contractStatus: string;
  paymentStatus: string;
  accessStatus: string;
  nextAction: string;
  ownerTeam: string;
  daysSinceEnrollment: number;
  lastContactAt: Date;
  upcomingDueAt: Date;
  checklist: ChecklistStep[];
  timeline: TimelineEvent[];
  ruler: StudentRulerStatus;
  isDemo: boolean;
}

@Injectable()
export class PostSaleService {
  constructor(
    private prisma: PrismaService,
    private integrationLogs: IntegrationLogService,
    private fakeWhatsApp: FakeWhatsAppService,
    private fakePayment: FakePaymentService,
    private fakeContract: FakeContractService,
    private fakeDocument: FakeDocumentService,
    private schoolConfig: SchoolConfigService,
  ) {}

  async overview(schoolId: string): Promise<Record<string, unknown>> {
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const students = enrollments.map((enrollment, index) => this.fromEnrollment(enrollment, index));
    const demoStudents = this.demoStudents().slice(0, Math.max(0, 6 - students.length));
    const baseLifecycle = [...students, ...demoStudents];
    const studentKeys = baseLifecycle.map((student) => student.id);
    const [states, events, storedTasks, integrationLogs] = await Promise.all([
      this.prisma.postSaleState.findMany({ where: { schoolId, studentKey: { in: studentKeys } } }),
      this.prisma.postSaleEvent.findMany({
        where: { schoolId, studentKey: { in: studentKeys } },
        orderBy: { createdAt: 'desc' },
        take: 160,
      }),
      this.prisma.postSaleTask.findMany({
        where: { schoolId, status: 'ABERTA' },
        orderBy: [{ createdAt: 'desc' }],
        take: 24,
      }),
      this.integrationLogs.recent(schoolId, 16),
    ]);
    const stateByStudent = new Map(states.map((state) => [state.studentKey, state]));
    const eventsByStudent = this.groupByStudent(events);
    const lifecycle = baseLifecycle.map((student) => {
      const withState = this.applyState(student, stateByStudent.get(student.id));
      const storedEvents = eventsByStudent.get(student.id) ?? [];
      return {
        ...withState,
        ruler: this.rulerStatus(withState, runtimeConfig, storedEvents),
        timeline: this.timelineFor(withState, storedEvents),
      };
    });

    return {
      generatedAt: new Date(),
      hasDemoData: demoStudents.length > 0,
      summary: this.summary(lifecycle),
      funnel: this.funnel(lifecycle),
      students: lifecycle,
      tasks: this.tasks(lifecycle, storedTasks),
      automations: this.automations(runtimeConfig, lifecycle),
      messageTemplates: this.messageTemplates(runtimeConfig),
      integrationLogs,
    };
  }

  listIntegrationLogs(schoolId: string): Promise<unknown> {
    return this.integrationLogs.recent(schoolId, 40);
  }

  async studentProfile(schoolId: string, studentKey: string): Promise<Record<string, unknown>> {
    const student = await this.findStudent(schoolId, studentKey);
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    const [enrollment, storedEvents, storedTasks, logs] = await Promise.all([
      student.enrollmentId
        ? this.prisma.enrollment.findFirst({
            where: { id: student.enrollmentId, schoolId },
            include: { documents: true },
          })
        : Promise.resolve(null),
      this.prisma.postSaleEvent.findMany({
        where: { schoolId, studentKey: student.id },
        orderBy: { createdAt: 'asc' },
        take: 200,
      }),
      this.prisma.postSaleTask.findMany({
        where: { schoolId, studentKey: student.id },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 40,
      }),
      this.integrationLogs.forStudent(schoolId, student.id, student.enrollmentId, 60),
    ]);
    const course = this.profileCourse(student, runtimeConfig);
    const paymentLogs = logs.filter((log) => log.service === 'PAGAMENTO');
    const contractLogs = logs.filter((log) => log.service === 'CONTRATO');
    const documentLogs = logs.filter((log) => log.service === 'DOCUMENTOS');
    const messages = logs.filter((log) => log.service === 'WHATSAPP');
    const enrollmentData = this.safeJson(enrollment?.data);
    const documentRequirements = this.documentRequirementRows(student, enrollment, runtimeConfig, storedEvents);
    const documentSummary = this.documentSummary(documentRequirements);
    const risk = this.profileRisk(student, documentRequirements);

    return {
      generatedAt: new Date(),
      student,
      enrollment: enrollment ? this.serializeEnrollment(enrollment) : null,
      personalData: this.personalDataRows(student, enrollment, enrollmentData),
      course,
      documents: {
        checklist: student.checklist,
        requirements: documentRequirements,
        summary: documentSummary,
        uploaded: (enrollment?.documents ?? []).map((document) => this.serializeEnrollmentDocument(document)),
        lastLog: documentLogs[0] ?? null,
      },
      payment: {
        status: student.paymentStatus,
        amount: enrollment?.paymentAmount != null ? Number(enrollment.paymentAmount) : course?.enrollmentFee ?? null,
        method: enrollment?.paymentMethod ?? null,
        reference: enrollment?.paymentRef ?? null,
        lastLog: paymentLogs[0] ?? null,
      },
      contract: {
        status: student.contractStatus,
        lastLog: contractLogs[0] ?? null,
      },
      messages,
      timeline: this.profileTimeline(student, enrollment, storedEvents, storedTasks),
      nextActions: this.profileActions(student, storedTasks),
      ruler: student.ruler,
      risk,
    };
  }

  async updateStudentStatus(
    schoolId: string,
    studentKey: string,
    input: { action?: string; note?: string },
  ): Promise<unknown> {
    const student = await this.findStudent(schoolId, studentKey);
    const action = input.action as PostSaleAction | undefined;
    const patch = this.actionPatch(action, student);

    await this.prisma.postSaleState.upsert({
      where: { schoolId_studentKey: { schoolId, studentKey } },
      create: {
        schoolId,
        studentKey,
        enrollmentId: student.enrollmentId,
        ...patch,
        notes: input.note?.trim() || null,
      },
      update: {
        ...patch,
        notes: input.note?.trim() || undefined,
      },
    });

    await this.recordEvent(schoolId, student, {
      type: 'STATUS_UPDATE',
      title: this.actionTitle(action),
      description: input.note?.trim() || this.actionDescription(action, student),
      metadata: { action },
    });

    return this.overview(schoolId);
  }

  async createTask(
    schoolId: string,
    studentKey: string,
    input: { title?: string; ownerTeam?: string; priority?: string; dueInDays?: number },
  ): Promise<unknown> {
    const student = await this.findStudent(schoolId, studentKey);
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Informe o título da tarefa.');

    const dueAt = this.addDays(new Date(), Number.isFinite(input.dueInDays) ? Number(input.dueInDays) : 1);
    await this.prisma.postSaleTask.create({
      data: {
        schoolId,
        studentKey,
        enrollmentId: student.enrollmentId,
        studentName: student.studentName,
        title,
        ownerTeam: input.ownerTeam?.trim() || student.ownerTeam,
        priority: input.priority?.trim() || 'Normal',
        automation: 'Criada pela equipe',
        dueAt,
      },
    });

    await this.recordEvent(schoolId, student, {
      type: 'TASK_CREATED',
      title: 'Tarefa criada',
      description: title,
      metadata: { ownerTeam: input.ownerTeam, priority: input.priority, dueAt },
    });

    return this.overview(schoolId);
  }

  async simulateMessage(
    schoolId: string,
    studentKey: string,
    input: { message?: string },
  ): Promise<{ message: string; log: unknown; overview: unknown }> {
    const student = await this.findStudent(schoolId, studentKey);
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    const message = this.cleanVisibleText(input.message?.trim() || this.suggestedMessage(student, runtimeConfig), student);
    const whatsapp = await this.fakeWhatsApp.sendMessage({
      context: this.integrationContext(schoolId, student),
      message,
    });

    await this.recordEvent(schoolId, student, {
      type: 'WHATSAPP_SIMULADO',
      title: 'WhatsApp fake registrado',
      description: message,
      metadata: { channel: 'WhatsApp', fake: true, providerMessageId: whatsapp.providerMessageId, logId: whatsapp.log.id },
    });

    return { message, log: whatsapp.log, overview: await this.overview(schoolId) };
  }

  async simulateRuler(
    schoolId: string,
    studentKey: string,
    input: { dayOffset?: number | null },
  ): Promise<{ result: Record<string, unknown>; overview: unknown }> {
    const student = await this.findStudent(schoolId, studentKey);
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    const template = this.pickRulerTemplate(student, runtimeConfig, input.dayOffset);
    if (!template) {
      throw new BadRequestException('Nenhum template ativo da régua foi encontrado para este aluno.');
    }

    const message = this.schoolConfig.renderTemplate(template.whatsappText, this.studentVariables(student, runtimeConfig));
    const whatsapp = await this.fakeWhatsApp.sendMessage({
      context: this.integrationContext(schoolId, student),
      message,
    });

    await this.recordEvent(schoolId, student, {
      type: 'REGUA_DISPARADA',
      title: `${template.title} disparada`,
      description: message,
      metadata: {
        dayOffset: template.dayOffset,
        templateKey: template.key,
        channel: 'WhatsApp',
        fake: true,
        providerMessageId: whatsapp.providerMessageId,
        logId: whatsapp.log.id,
      },
    });

    return {
      result: {
        day: template.dayOffset ?? 0,
        title: template.title,
        message,
        log: whatsapp.log,
      },
      overview: await this.overview(schoolId),
    };
  }

  async simulatePayment(
    schoolId: string,
    studentKey: string,
    input: { action?: FakePaymentAction; amount?: number },
  ): Promise<unknown> {
    const student = await this.findStudent(schoolId, studentKey);
    const action = input.action ?? 'MARK_PAID';
    const result = await this.fakePayment.simulate({
      context: this.integrationContext(schoolId, student),
      action,
      amount: input.amount,
    });

    await this.saveStatePatch(schoolId, student, this.paymentPatch(action, student, result.paymentStatus));
    await this.recordEvent(schoolId, student, {
      type: 'PAGAMENTO_FAKE',
      title: `Pagamento fake: ${result.paymentStatus}`,
      description: result.log.visibleMessage,
      metadata: { action, paymentRef: result.paymentRef, logId: result.log.id },
    });

    return { result, overview: await this.overview(schoolId) };
  }

  async simulateContract(
    schoolId: string,
    studentKey: string,
    input: { action?: FakeContractAction },
  ): Promise<unknown> {
    const student = await this.findStudent(schoolId, studentKey);
    const action = input.action ?? 'SEND';
    const result = await this.fakeContract.simulate({
      context: this.integrationContext(schoolId, student),
      action,
    });

    await this.saveStatePatch(schoolId, student, this.contractPatch(action, student, result.contractStatus));
    await this.recordEvent(schoolId, student, {
      type: 'CONTRATO_FAKE',
      title: `Contrato fake: ${result.contractStatus}`,
      description: result.log.visibleMessage,
      metadata: { action, contractUrl: result.contractUrl, logId: result.log.id },
    });

    return { result, overview: await this.overview(schoolId) };
  }

  async simulateDocument(
    schoolId: string,
    studentKey: string,
    input: { action?: FakeDocumentAction; documentType?: string; reason?: string; fileName?: string },
  ): Promise<unknown> {
    const student = await this.findStudent(schoolId, studentKey);
    const action = input.action ?? 'RECEIVE';
    const documentType = input.documentType?.trim() || 'Pacote de matrícula';
    const reason = input.reason?.trim();
    if (action === 'REJECT' && !reason) {
      throw new BadRequestException('Informe o motivo da recusa do documento.');
    }
    const fileName = input.fileName?.trim() || this.fakeDocumentFileName(documentType);
    const result = await this.fakeDocument.simulate({
      context: this.integrationContext(schoolId, student),
      action,
      documentType,
      reason,
    });

    await this.saveStatePatch(schoolId, student, this.documentPatch(action, student, result.documentStatus, documentType));
    await this.recordEvent(schoolId, student, {
      type: 'DOCUMENTO_FAKE',
      title: `${documentType}: ${result.documentStatus}`,
      description: result.log.visibleMessage,
      metadata: {
        action,
        documentType,
        documentStatus: result.log.responsePayload.status,
        reason: action === 'REJECT' ? reason : null,
        fileName: action === 'RECEIVE' ? fileName : null,
        logId: result.log.id,
      },
    });

    return { result, overview: await this.overview(schoolId) };
  }

  private fromEnrollment(enrollment: any, index: number): LifecycleStudent {
    const docs = enrollment.documents ?? [];
    const daysSinceEnrollment = this.daysBetween(enrollment.confirmedAt ?? enrollment.createdAt, new Date());
    const hasFullPackage = docs.some((doc) => doc.type === 'PACOTE_COMPLETO');
    const hasContract = docs.some((doc) => /CONTRATO|D4SIGN|ASSINADO/i.test(doc.type));
    const hasMinimumDocs = hasFullPackage || docs.length >= 3;
    const paymentApproved = enrollment.paymentStatus === 'APROVADO';
    const accessReady = hasMinimumDocs && hasContract && paymentApproved;

    let status: LifecycleStatus = 'EM_ACOMPANHAMENTO';
    if (!hasMinimumDocs) status = 'DOCUMENTACAO_PENDENTE';
    else if (!hasContract) status = 'CONTRATO_PENDENTE';
    else if (!paymentApproved) status = 'PAGAMENTO_PENDENTE';
    else if (!accessReady) status = 'ACESSO_PENDENTE';
    else if (daysSinceEnrollment >= 10 && index % 4 === 0) status = 'RISCO_EVASAO';
    else if (daysSinceEnrollment >= 45) status = 'ONBOARDING_CONCLUIDO';

    const checklist = this.checklist({
      hasMinimumDocs,
      hasContract,
      paymentApproved,
      accessReady,
      daysSinceEnrollment,
      risk: status === 'RISCO_EVASAO',
    });
    const progress = Math.round((checklist.filter((step) => step.status === 'done').length / checklist.length) * 100);
    const riskScore = this.riskScore(status, daysSinceEnrollment);

    return {
      id: enrollment.id,
      enrollmentId: enrollment.id,
      studentName: enrollment.studentName,
      course: enrollment.course ?? 'Curso não informado',
      startedAt: enrollment.confirmedAt ?? enrollment.createdAt,
      status,
      statusLabel: this.statusLabel(status),
      progress,
      riskScore,
      riskLevel: this.riskLevel(riskScore),
      documentStatus: hasMinimumDocs ? 'Recebida' : 'Pendente',
      contractStatus: hasContract ? 'Assinado' : 'Pendente',
      paymentStatus: paymentApproved ? 'Pago' : 'Pendente',
      accessStatus: accessReady ? 'Liberado' : 'Aguardando requisitos',
      nextAction: this.nextAction(status),
      ownerTeam: this.ownerTeam(status),
      daysSinceEnrollment,
      lastContactAt: this.addDays(enrollment.createdAt, Math.min(daysSinceEnrollment, 7)),
      upcomingDueAt: this.addDays(new Date(), this.nextDueOffset(status)),
      checklist,
      timeline: [],
      ruler: this.emptyRuler(),
      isDemo: false,
    };
  }

  private demoStudents(): LifecycleStudent[] {
    const demos = [
      {
        studentName: 'Camila Souza',
        course: 'Enfermagem',
        status: 'DOCUMENTACAO_PENDENTE' as const,
        progress: 32,
        riskScore: 42,
        documentStatus: 'RG e comprovante pendentes',
        contractStatus: 'Aguardando documentos',
        paymentStatus: 'Pago',
        accessStatus: 'Bloqueado',
        daysSinceEnrollment: 1,
      },
      {
        studentName: 'Rafael Mendonça',
        course: 'Direito',
        status: 'CONTRATO_PENDENTE' as const,
        progress: 58,
        riskScore: 36,
        documentStatus: 'Recebida',
        contractStatus: 'Link reenviado',
        paymentStatus: 'Pago',
        accessStatus: 'Aguardando contrato',
        daysSinceEnrollment: 2,
      },
      {
        studentName: 'Mariana Costa',
        course: 'Enfermagem',
        status: 'RISCO_EVASAO' as const,
        progress: 76,
        riskScore: 78,
        documentStatus: 'Recebida',
        contractStatus: 'Assinado',
        paymentStatus: 'Pago',
        accessStatus: 'Sem primeiro acesso há 10 dias',
        daysSinceEnrollment: 10,
      },
      {
        studentName: 'Emily Carter',
        course: 'Administração',
        status: 'PAGAMENTO_PENDENTE' as const,
        progress: 66,
        riskScore: 48,
        documentStatus: 'Passaporte recebido',
        contractStatus: 'Assinado',
        paymentStatus: 'PIX pendente',
        accessStatus: 'Aguardando pagamento',
        daysSinceEnrollment: 3,
      },
      {
        studentName: 'Diego Almeida',
        course: 'Pedagogia',
        status: 'EM_ACOMPANHAMENTO' as const,
        progress: 82,
        riskScore: 28,
        documentStatus: 'Recebida',
        contractStatus: 'Assinado',
        paymentStatus: 'Pago',
        accessStatus: 'Liberado',
        daysSinceEnrollment: 7,
      },
      {
        studentName: 'Lucas Rodrigues',
        course: 'Direito',
        status: 'ONBOARDING_CONCLUIDO' as const,
        progress: 100,
        riskScore: 12,
        documentStatus: 'Recebida',
        contractStatus: 'Assinado',
        paymentStatus: 'Pago',
        accessStatus: 'Ativo no AVA',
        daysSinceEnrollment: 45,
      },
    ];

    return demos.map((demo, index) => ({
      id: `demo-post-sale-${index + 1}`,
      enrollmentId: null,
      studentName: demo.studentName,
      course: demo.course,
      startedAt: this.addDays(new Date(), -demo.daysSinceEnrollment),
      status: demo.status,
      statusLabel: this.statusLabel(demo.status),
      progress: demo.progress,
      riskScore: demo.riskScore,
      riskLevel: this.riskLevel(demo.riskScore),
      documentStatus: demo.documentStatus,
      contractStatus: demo.contractStatus,
      paymentStatus: demo.paymentStatus,
      accessStatus: demo.accessStatus,
      nextAction: this.nextAction(demo.status),
      ownerTeam: this.ownerTeam(demo.status),
      daysSinceEnrollment: demo.daysSinceEnrollment,
      lastContactAt: this.addDays(new Date(), -Math.min(demo.daysSinceEnrollment, 5)),
      upcomingDueAt: this.addDays(new Date(), this.nextDueOffset(demo.status)),
      checklist: this.demoChecklist(demo.status),
      timeline: [],
      ruler: this.emptyRuler(),
      isDemo: true,
    }));
  }

  private checklist(input: {
    hasMinimumDocs: boolean;
    hasContract: boolean;
    paymentApproved: boolean;
    accessReady: boolean;
    daysSinceEnrollment: number;
    risk: boolean;
  }): ChecklistStep[] {
    return [
      {
        key: 'boas_vindas',
        label: 'Boas-vindas enviadas',
        status: 'done',
        helper: 'Mensagem inicial com próximos passos e canais de suporte.',
      },
      {
        key: 'documentos',
        label: 'Documentação validada',
        status: input.hasMinimumDocs ? 'done' : 'pending',
        helper: 'CPF/RG ou passaporte, comprovante e histórico escolar.',
      },
      {
        key: 'contrato',
        label: 'Contrato assinado',
        status: input.hasContract ? 'done' : input.hasMinimumDocs ? 'pending' : 'blocked',
        helper: 'Integração futura com D4Sign para gerar e acompanhar assinatura.',
      },
      {
        key: 'pagamento',
        label: 'Pagamento confirmado',
        status: input.paymentApproved ? 'done' : 'attention',
        helper: 'Lembretes preventivos por boleto, PIX ou link de pagamento.',
      },
      {
        key: 'acesso',
        label: 'Acesso ao AVA liberado',
        status: input.accessReady ? 'done' : 'blocked',
        helper: 'Liberação depende de documentos, contrato e pagamento.',
      },
      {
        key: 'permanencia',
        label: 'Acompanhamento de permanência',
        status: input.risk ? 'attention' : input.daysSinceEnrollment >= 7 ? 'done' : 'pending',
        helper: 'Checagem de primeiro acesso, progresso e dificuldade do aluno.',
      },
    ];
  }

  private demoChecklist(status: LifecycleStatus): ChecklistStep[] {
    return this.checklist({
      hasMinimumDocs: !['DOCUMENTACAO_PENDENTE'].includes(status),
      hasContract: !['DOCUMENTACAO_PENDENTE', 'CONTRATO_PENDENTE'].includes(status),
      paymentApproved: !['PAGAMENTO_PENDENTE'].includes(status),
      accessReady: ['EM_ACOMPANHAMENTO', 'RISCO_EVASAO', 'ONBOARDING_CONCLUIDO'].includes(status),
      daysSinceEnrollment: status === 'ONBOARDING_CONCLUIDO' ? 45 : status === 'RISCO_EVASAO' ? 10 : 4,
      risk: status === 'RISCO_EVASAO',
    });
  }

  private applyState(student: LifecycleStudent, state?: any): LifecycleStudent {
    if (!state) {
      return {
        ...student,
        timeline: this.timelineFor(student, []),
      };
    }

    const next: LifecycleStudent = {
      ...student,
      status: (state.status || student.status) as LifecycleStatus,
      documentStatus: state.documentStatus || student.documentStatus,
      contractStatus: state.contractStatus || student.contractStatus,
      paymentStatus: state.paymentStatus || student.paymentStatus,
      accessStatus: state.accessStatus || student.accessStatus,
      riskScore: state.riskScore ?? student.riskScore,
      nextAction: state.nextAction || student.nextAction,
      ownerTeam: state.ownerTeam || student.ownerTeam,
    };
    next.statusLabel = this.statusLabel(next.status);
    next.riskLevel = this.riskLevel(next.riskScore);
    next.checklist = this.checklistFromStudent(next);
    next.progress = Math.round((next.checklist.filter((step) => step.status === 'done').length / next.checklist.length) * 100);
    return next;
  }

  private checklistFromStudent(student: LifecycleStudent): ChecklistStep[] {
    const hasMinimumDocs = /recebid|validada/i.test(student.documentStatus);
    const hasContract = /assinado/i.test(student.contractStatus);
    const paymentApproved = /pago|aprovado/i.test(student.paymentStatus);
    const accessReady = /liberado|ativo/i.test(student.accessStatus);
    return this.checklist({
      hasMinimumDocs,
      hasContract,
      paymentApproved,
      accessReady,
      daysSinceEnrollment: student.daysSinceEnrollment,
      risk: student.status === 'RISCO_EVASAO',
    });
  }

  private async findStudent(schoolId: string, studentKey: string): Promise<LifecycleStudent> {
    const overview = (await this.overview(schoolId)) as any;
    const student = overview.students?.find((item: LifecycleStudent) => item.id === studentKey);
    if (!student) throw new BadRequestException('Aluno não encontrado no pós-venda.');
    return student;
  }

  private integrationContext(schoolId: string, student: LifecycleStudent) {
    return {
      schoolId,
      studentKey: student.id,
      enrollmentId: student.enrollmentId,
      studentName: student.studentName,
    };
  }

  private profileCourse(student: LifecycleStudent, config: RuntimeSchoolConfig) {
    const course = config.courses.find((item) => item.name === student.course) ?? null;
    if (course) return course;
    return {
      id: null,
      schoolId: config.profile.schoolId,
      name: student.course,
      description: 'Curso registrado na matrícula.',
      duration: null,
      modality: null,
      shifts: [],
      enrollmentFee: null,
      monthlyFee: null,
      cashDiscountPercent: config.commercial.cashDiscountPercent,
      active: true,
      updatedAt: new Date(),
    };
  }

  private serializeEnrollment(enrollment: any) {
    const data = this.safeJson(enrollment.data);
    return {
      id: enrollment.id,
      number: enrollment.number,
      status: enrollment.status,
      studentName: enrollment.studentName,
      cpf: enrollment.cpf,
      documentType: enrollment.documentType,
      documentNumber: enrollment.documentNumber,
      preferredLanguage: enrollment.preferredLanguage,
      countryOfResidence: enrollment.countryOfResidence,
      email: enrollment.email,
      phone: enrollment.phone,
      course: enrollment.course,
      shift: enrollment.shift,
      unit: enrollment.unit,
      data,
      paymentStatus: enrollment.paymentStatus,
      paymentMethod: enrollment.paymentMethod,
      paymentAmount: enrollment.paymentAmount != null ? Number(enrollment.paymentAmount) : null,
      paymentRef: enrollment.paymentRef,
      authCode: enrollment.authCode,
      createdAt: enrollment.createdAt,
      confirmedAt: enrollment.confirmedAt,
    };
  }

  private serializeEnrollmentDocument(document: any) {
    return {
      id: document.id,
      enrollmentId: document.enrollmentId,
      type: document.type,
      fileName: document.fileName,
      storagePath: document.storagePath,
      mimeType: document.mimeType,
      size: document.size,
      uploadedAt: document.uploadedAt,
    };
  }

  private personalDataRows(student: LifecycleStudent, enrollment: any | null, data: Record<string, unknown>) {
    const rows = [
      { section: 'Identificação', label: 'Nome completo', value: enrollment?.studentName ?? student.studentName },
      { section: 'Identificação', label: 'Documento', value: this.documentLabel(enrollment, data) },
      { section: 'Identificação', label: 'País de residência', value: enrollment?.countryOfResidence ?? data.countryOfResidence },
      { section: 'Identificação', label: 'Idioma preferido', value: enrollment?.preferredLanguage ?? data.preferredLanguage },
      { section: 'Contato', label: 'E-mail', value: enrollment?.email ?? data.email },
      { section: 'Contato', label: 'Telefone', value: enrollment?.phone ?? data.phone },
      { section: 'Dados pessoais', label: 'Nascimento', value: data.birthDate },
      { section: 'Dados pessoais', label: 'Sexo', value: data.gender ?? data.sexo },
      { section: 'Dados pessoais', label: 'Nacionalidade', value: data.nationality ?? data.nacionalidade },
      { section: 'Endereço', label: 'CEP', value: data.cep },
      { section: 'Endereço', label: 'Endereço', value: this.addressLine(data) },
      { section: 'Responsável', label: 'Responsável', value: data.respName },
      { section: 'Responsável', label: 'CPF do responsável', value: data.respCpf },
    ];
    return rows.filter((row) => String(row.value ?? '').trim()).map((row) => ({
      section: row.section,
      label: row.label,
      value: String(row.value ?? '').trim(),
    }));
  }

  private documentRequirementRows(
    student: LifecycleStudent,
    enrollment: any | null,
    config: RuntimeSchoolConfig,
    storedEvents: any[] = [],
  ) {
    const audiences = this.documentAudiences(student, enrollment);
    const uploadedDocuments = enrollment?.documents ?? [];
    const hasPackage = uploadedDocuments.some((document) => this.normalizeKey(document.type) === 'pacotecompleto');
    const fakeStates = this.documentFakeStates(storedEvents);

    return config.documents
      .filter((requirement) => audiences.includes(requirement.audience))
      .map((requirement) => {
        const uploaded = uploadedDocuments.find((document) => this.sameDocumentType(document.type, requirement.documentType));
        const fake = fakeStates.get(this.normalizeKey(requirement.documentType));
        const baseStatus = hasPackage || uploaded ? 'RECEBIDO' : requirement.required ? 'PENDENTE' : 'OPCIONAL';
        return {
          audience: requirement.audience,
          documentType: requirement.documentType,
          instructions: requirement.instructions,
          required: requirement.required,
          status: fake?.status ?? baseStatus,
          reason: fake?.reason ?? null,
          fileName: fake?.fileName ?? uploaded?.fileName ?? (hasPackage ? 'Pacote completo enviado' : null),
          uploadedAt: fake?.createdAt ?? uploaded?.uploadedAt ?? null,
          updatedAt: fake?.createdAt ?? uploaded?.uploadedAt ?? null,
        };
      });
  }

  private documentFakeStates(storedEvents: any[]) {
    const map = new Map<
      string,
      { status: string; reason: string | null; fileName: string | null; createdAt: Date }
    >();
    for (const event of storedEvents) {
      if (event.type !== 'DOCUMENTO_FAKE') continue;
      const metadata = this.eventMetadata(event);
      const documentType = String(metadata.documentType ?? '').trim();
      if (!documentType) continue;
      const status = String(metadata.documentStatus ?? '').trim() || this.statusFromDocumentAction(String(metadata.action ?? ''));
      map.set(this.normalizeKey(documentType), {
        status,
        reason: metadata.reason ? String(metadata.reason) : null,
        fileName: metadata.fileName ? String(metadata.fileName) : null,
        createdAt: event.createdAt,
      });
    }
    return map;
  }

  private statusFromDocumentAction(action: string) {
    const normalized = action.toUpperCase();
    if (normalized === 'APPROVE') return 'APROVADO';
    if (normalized === 'REJECT') return 'RECUSADO';
    return 'RECEBIDO';
  }

  private documentSummary(rows: Array<{ status: string; required: boolean }>) {
    return {
      total: rows.length,
      required: rows.filter((row) => row.required).length,
      pending: rows.filter((row) => row.status === 'PENDENTE').length,
      received: rows.filter((row) => row.status === 'RECEBIDO').length,
      approved: rows.filter((row) => row.status === 'APROVADO').length,
      rejected: rows.filter((row) => row.status === 'RECUSADO').length,
    };
  }

  private documentAudiences(student: LifecycleStudent, enrollment: any | null) {
    const data = this.safeJson(enrollment?.data);
    const docType = `${enrollment?.documentType ?? data.documentType ?? student.documentStatus}`;
    const country = `${enrollment?.countryOfResidence ?? data.countryOfResidence ?? ''}`;
    const isInternational =
      /passaporte|passport|ssn|driver|state id|nie|dni|estrangeir|internacional/i.test(docType) ||
      (!!country && !/brasil|brazil/i.test(country));
    const audiences = [isInternational ? 'estrangeiro' : 'brasileiro'];
    const age = data.birthDate ? this.ageFromBirthDate(String(data.birthDate)) : null;
    if (age !== null && age < 18) audiences.push('menor_idade');
    return audiences;
  }

  private profileTimeline(student: LifecycleStudent, enrollment: any | null, storedEvents: any[], storedTasks: any[]) {
    const entries: TimelineEvent[] = [
      {
        id: `profile-${student.id}-matricula`,
        type: 'MATRICULA',
        title: 'Matrícula registrada',
        description: enrollment
          ? `Matrícula ${enrollment.number} criada para ${student.studentName}.`
          : `${student.studentName} entrou na jornada de pós-venda como aluno de exemplo.`,
        createdAt: student.startedAt,
        source: 'system',
      },
    ];

    for (const document of enrollment?.documents ?? []) {
      entries.push({
        id: `profile-${document.id}-upload`,
        type: 'DOCUMENTO_UPLOAD',
        title: 'Documento recebido',
        description: `${document.type}: ${document.fileName}`,
        createdAt: document.uploadedAt,
        source: 'manual',
      });
    }

    for (const task of storedTasks) {
      entries.push({
        id: `profile-${task.id}-task`,
        type: 'TASK_CREATED',
        title: task.status === 'ABERTA' ? 'Tarefa em aberto' : 'Tarefa registrada',
        description: `${task.title} (${task.ownerTeam})`,
        createdAt: task.createdAt,
        source: 'manual',
      });
    }

    entries.push(...storedEvents.map((event) => this.serializeEvent(event)));
    return entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  private profileActions(student: LifecycleStudent, storedTasks: any[]) {
    const recommended = {
      id: `recommended-${student.id}`,
      studentId: student.id,
      title: student.nextAction,
      studentName: student.studentName,
      ownerTeam: student.ownerTeam,
      priority: student.riskLevel === 'CRITICO' ? 'Urgente' : student.riskLevel === 'ALTO' ? 'Alta' : 'Normal',
      dueAt: student.upcomingDueAt,
      automation: this.automationFor(student.status),
      status: student.status === 'ONBOARDING_CONCLUIDO' ? 'CONCLUIDA' : 'RECOMENDADA',
      source: 'automatic',
    };
    const tasks = storedTasks.map((task) => ({
      id: task.id,
      studentId: task.studentKey,
      title: task.title,
      studentName: task.studentName,
      ownerTeam: task.ownerTeam,
      priority: task.priority,
      dueAt: task.dueAt,
      automation: this.cleanVisibleText(task.automation ?? 'Criada pela equipe'),
      status: task.status,
      source: 'manual',
    }));
    return [recommended, ...tasks];
  }

  private profileRisk(student: LifecycleStudent, documents: Array<{ status: string; required: boolean; documentType: string }>) {
    const pendingRequired = documents.filter((document) => document.required && document.status === 'PENDENTE');
    const rejected = documents.filter((document) => document.status === 'RECUSADO');
    const documentPenalty = pendingRequired.length * 5 + rejected.length * 12;
    const score = Math.min(100, student.riskScore + documentPenalty);
    return {
      score,
      level: this.riskLevel(score),
      label: student.statusLabel,
      reasons: this.riskReasons(student, documents),
    };
  }

  private riskReasons(student: LifecycleStudent, documents: Array<{ status: string; required: boolean; documentType: string }> = []) {
    const reasons: string[] = [];
    const pendingRequired = documents.filter((document) => document.required && document.status === 'PENDENTE');
    const rejected = documents.filter((document) => document.status === 'RECUSADO');
    if (student.status === 'DOCUMENTACAO_PENDENTE') reasons.push('Documentação ainda bloqueia contrato e acesso.');
    if (pendingRequired.length) reasons.push(`${pendingRequired.length} documento(s) obrigatório(s) ainda estão pendentes.`);
    if (rejected.length) reasons.push(`${rejected.length} documento(s) recusado(s) precisam ser reenviados.`);
    if (student.status === 'CONTRATO_PENDENTE') reasons.push('Contrato não está concluído.');
    if (student.status === 'PAGAMENTO_PENDENTE') reasons.push('Pagamento da matrícula está pendente.');
    if (student.status === 'ACESSO_PENDENTE') reasons.push('Acesso ao AVA ainda não foi liberado.');
    if (student.status === 'RISCO_EVASAO') reasons.push('Aluno precisa de intervenção de permanência.');
    if (student.ruler.pendingCount > 0) reasons.push(`${student.ruler.pendingCount} mensagem(ns) da régua estão pendentes.`);
    if (student.daysSinceEnrollment >= 7 && student.progress < 80) reasons.push('Jornada com mais de 7 dias e avanço abaixo do esperado.');
    if (!reasons.length) reasons.push('Sem bloqueios críticos no momento.');
    return reasons;
  }

  private async saveStatePatch(
    schoolId: string,
    student: LifecycleStudent,
    patch: Record<string, string | number | null | undefined>,
  ) {
    await this.prisma.postSaleState.upsert({
      where: { schoolId_studentKey: { schoolId, studentKey: student.id } },
      create: {
        schoolId,
        studentKey: student.id,
        enrollmentId: student.enrollmentId,
        ...patch,
      },
      update: patch,
    });
  }

  private paymentPatch(action: FakePaymentAction, student: LifecycleStudent, paymentStatus: string) {
    switch (action) {
      case 'MARK_PAID':
        return this.actionPatch('PAYMENT_PAID', student);
      case 'FAIL':
        return {
          status: 'PAGAMENTO_PENDENTE',
          paymentStatus,
          nextAction: 'Reenviar cobrança ou oferecer outra forma de pagamento',
          ownerTeam: 'Financeiro',
          riskScore: Math.min(100, student.riskScore + 8),
        };
      case 'REFUND':
        return {
          status: 'PAGAMENTO_PENDENTE',
          paymentStatus,
          nextAction: 'Confirmar nova forma de pagamento',
          ownerTeam: 'Financeiro',
          riskScore: Math.min(100, student.riskScore + 10),
        };
      case 'PENDING':
        return {
          status: 'PAGAMENTO_PENDENTE',
          paymentStatus,
          nextAction: 'Acompanhar cobrança em aberto',
          ownerTeam: 'Financeiro',
          riskScore: Math.min(100, student.riskScore + 3),
        };
      default:
        throw new BadRequestException('Ação de pagamento fake não suportada.');
    }
  }

  private contractPatch(action: FakeContractAction, student: LifecycleStudent, contractStatus: string) {
    switch (action) {
      case 'SEND':
        return this.actionPatch('CONTRACT_SENT', student);
      case 'VIEW':
        return {
          status: 'CONTRATO_PENDENTE',
          contractStatus,
          nextAction: 'Aguardar assinatura do contrato',
          ownerTeam: 'Secretaria',
          riskScore: Math.min(student.riskScore, 35),
        };
      case 'SIGN':
        return this.actionPatch('CONTRACT_SIGNED', student);
      case 'EXPIRE':
        return {
          status: 'CONTRATO_PENDENTE',
          contractStatus,
          nextAction: 'Reenviar link de assinatura',
          ownerTeam: 'Secretaria',
          riskScore: Math.min(100, student.riskScore + 8),
        };
      default:
        throw new BadRequestException('Ação de contrato fake não suportada.');
    }
  }

  private documentPatch(action: FakeDocumentAction, student: LifecycleStudent, documentStatus: string, documentType: string) {
    const isPackage = /pacote|completo|matr[ií]cula/i.test(documentType);
    switch (action) {
      case 'RECEIVE':
        return isPackage
          ? this.actionPatch('DOCUMENTS_RECEIVED', student)
          : {
              status: 'DOCUMENTACAO_PENDENTE',
              documentStatus: `${documentType} recebido`,
              nextAction: 'Conferir documentos pendentes',
              ownerTeam: 'Secretaria',
              riskScore: Math.max(18, student.riskScore - 4),
            };
      case 'APPROVE':
        return isPackage
          ? {
              ...this.actionPatch('DOCUMENTS_RECEIVED', student),
              documentStatus,
            }
          : {
              status: 'DOCUMENTACAO_PENDENTE',
              documentStatus: `${documentType} aprovado`,
              nextAction: 'Validar documentos restantes',
              ownerTeam: 'Secretaria',
              riskScore: Math.max(16, student.riskScore - 6),
            };
      case 'REJECT':
        return {
          status: 'DOCUMENTACAO_PENDENTE',
          documentStatus,
          contractStatus: 'Aguardando documentos',
          accessStatus: 'Bloqueado',
          nextAction: 'Solicitar reenvio de documentos',
          ownerTeam: 'Secretaria',
          riskScore: Math.min(100, student.riskScore + 8),
        };
      default:
        throw new BadRequestException('Ação de documento fake não suportada.');
    }
  }

  private actionPatch(action: PostSaleAction | undefined, student: LifecycleStudent) {
    if (!action) throw new BadRequestException('Informe uma ação válida.');

    switch (action) {
      case 'DOCUMENTS_RECEIVED':
        return {
          status: 'CONTRATO_PENDENTE',
          documentStatus: 'Recebida',
          nextAction: 'Enviar contrato para assinatura',
          ownerTeam: 'Secretaria',
          riskScore: Math.min(student.riskScore, 34),
        };
      case 'CONTRACT_SENT':
        return {
          status: 'CONTRATO_PENDENTE',
          contractStatus: 'Enviado',
          nextAction: 'Acompanhar assinatura do contrato',
          ownerTeam: 'Secretaria',
          riskScore: Math.min(student.riskScore, 36),
        };
      case 'CONTRACT_SIGNED':
        return {
          status: student.paymentStatus === 'Pago' ? 'ACESSO_PENDENTE' : 'PAGAMENTO_PENDENTE',
          contractStatus: 'Assinado',
          nextAction: student.paymentStatus === 'Pago' ? 'Liberar acesso ao AVA' : 'Enviar lembrete de pagamento',
          ownerTeam: student.paymentStatus === 'Pago' ? 'Suporte AVA' : 'Financeiro',
          riskScore: Math.min(student.riskScore, 32),
        };
      case 'PAYMENT_PAID':
        return {
          status: /assinado/i.test(student.contractStatus) ? 'ACESSO_PENDENTE' : 'CONTRATO_PENDENTE',
          paymentStatus: 'Pago',
          nextAction: /assinado/i.test(student.contractStatus) ? 'Liberar acesso ao AVA' : 'Acompanhar assinatura do contrato',
          ownerTeam: /assinado/i.test(student.contractStatus) ? 'Suporte AVA' : 'Secretaria',
          riskScore: Math.min(student.riskScore, 30),
        };
      case 'ACCESS_RELEASED':
        return {
          status: 'EM_ACOMPANHAMENTO',
          accessStatus: 'Liberado',
          nextAction: 'Checar primeiro acesso e experiência',
          ownerTeam: 'Sucesso do Aluno',
          riskScore: Math.min(student.riskScore, 24),
        };
      case 'RISK_RESOLVED':
        return {
          status: 'EM_ACOMPANHAMENTO',
          accessStatus: /sem primeiro acesso/i.test(student.accessStatus) ? 'Liberado' : student.accessStatus,
          nextAction: 'Checar experiência do aluno em 3 dias',
          ownerTeam: 'Sucesso do Aluno',
          riskScore: 22,
        };
      default:
        throw new BadRequestException('Ação não suportada.');
    }
  }

  private actionTitle(action?: PostSaleAction) {
    const titles: Record<PostSaleAction, string> = {
      DOCUMENTS_RECEIVED: 'Documentos marcados como recebidos',
      CONTRACT_SENT: 'Contrato marcado como enviado',
      CONTRACT_SIGNED: 'Contrato marcado como assinado',
      PAYMENT_PAID: 'Pagamento marcado como pago',
      ACCESS_RELEASED: 'Acesso ao AVA liberado',
      RISK_RESOLVED: 'Risco tratado',
    };
    if (!action) return 'Status atualizado';
    return titles[action] ?? 'Status atualizado';
  }

  private actionDescription(action: PostSaleAction | undefined, student: LifecycleStudent) {
    const descriptions: Record<PostSaleAction, string> = {
      DOCUMENTS_RECEIVED: `${student.studentName} teve a documentação marcada como recebida.`,
      CONTRACT_SENT: `Link de contrato marcado como enviado para ${student.studentName}.`,
      CONTRACT_SIGNED: `${student.studentName} teve o contrato marcado como assinado.`,
      PAYMENT_PAID: `${student.studentName} teve o pagamento marcado como confirmado.`,
      ACCESS_RELEASED: `Acesso ao AVA liberado para ${student.studentName}.`,
      RISK_RESOLVED: `Risco de evasão tratado e aluno voltou para acompanhamento.`,
    };
    if (!action) return 'Status atualizado pela equipe.';
    return descriptions[action] ?? 'Status atualizado pela equipe.';
  }

  private async recordEvent(
    schoolId: string,
    student: LifecycleStudent,
    event: { type: string; title: string; description: string; metadata?: Record<string, unknown> },
  ) {
    return this.prisma.postSaleEvent.create({
      data: {
        schoolId,
        studentKey: student.id,
        enrollmentId: student.enrollmentId,
        studentName: student.studentName,
        type: event.type,
        title: event.title,
        description: this.cleanVisibleText(event.description, student),
        metadata: JSON.stringify(event.metadata ?? {}),
      },
    });
  }

  private timelineFor(student: LifecycleStudent, storedEvents: any[]): TimelineEvent[] {
    const base: TimelineEvent[] = [
      {
        id: `base-${student.id}-matricula`,
        type: 'MATRICULA',
        title: 'Matrícula registrada',
        description: `${student.studentName} entrou na jornada de pós-venda.`,
        createdAt: student.startedAt,
        source: 'system',
      },
      {
        id: `base-${student.id}-boas-vindas`,
        type: 'BOAS_VINDAS',
        title: 'Boas-vindas programadas',
        description: 'Mensagem inicial com documentos, contrato, pagamento e acesso ao AVA.',
        createdAt: this.timelineDate(student.startedAt, 0),
        source: 'system',
      },
    ];

    if (/recebid|validada/i.test(student.documentStatus)) {
      base.push({
        id: `base-${student.id}-docs`,
        type: 'DOCUMENTOS',
        title: 'Documentação em análise',
        description: student.documentStatus,
        createdAt: this.timelineDate(student.startedAt, 1),
        source: 'system',
      });
    }
    if (/assinado|enviado/i.test(student.contractStatus)) {
      base.push({
        id: `base-${student.id}-contrato`,
        type: 'CONTRATO',
        title: 'Contrato acompanhado',
        description: student.contractStatus,
        createdAt: this.timelineDate(student.startedAt, 2),
        source: 'system',
      });
    }
    if (/pago|pendente/i.test(student.paymentStatus)) {
      base.push({
        id: `base-${student.id}-financeiro`,
        type: 'FINANCEIRO',
        title: 'Financeiro monitorado',
        description: student.paymentStatus,
        createdAt: this.timelineDate(student.startedAt, 3),
        source: 'system',
      });
    }

    const manual = storedEvents.map((event) => this.serializeEvent(event));
    return [...manual, ...base].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
  }

  private serializeEvent(event: any): TimelineEvent {
    return {
      id: event.id,
      type: event.type,
      title: this.cleanVisibleText(event.title),
      description: this.cleanVisibleText(event.description),
      createdAt: event.createdAt,
      source: 'manual',
    };
  }

  private eventMetadata(event: any): Record<string, unknown> {
    try {
      return JSON.parse(event.metadata ?? '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private groupByStudent(items: any[]) {
    const map = new Map<string, any[]>();
    for (const item of items) {
      const current = map.get(item.studentKey) ?? [];
      current.push(item);
      map.set(item.studentKey, current);
    }
    return map;
  }

  private summary(students: LifecycleStudent[]) {
    return {
      totalStudents: students.length,
      documentsPending: students.filter((student) => student.status === 'DOCUMENTACAO_PENDENTE').length,
      contractsPending: students.filter((student) => student.status === 'CONTRATO_PENDENTE').length,
      paymentsPending: students.filter((student) => student.status === 'PAGAMENTO_PENDENTE').length,
      accessPending: students.filter((student) => student.status === 'ACESSO_PENDENTE').length,
      highRisk: students.filter((student) => ['ALTO', 'CRITICO'].includes(student.riskLevel)).length,
      onboardingComplete: students.filter((student) => student.status === 'ONBOARDING_CONCLUIDO').length,
      automationsQueued: students.reduce((sum, student) => sum + student.ruler.pendingCount, 0),
      averageProgress: students.length
        ? Math.round(students.reduce((sum, student) => sum + student.progress, 0) / students.length)
        : 0,
    };
  }

  private funnel(students: LifecycleStudent[]) {
    const stages: Array<{ key: LifecycleStatus; label: string; color: string }> = [
      { key: 'DOCUMENTACAO_PENDENTE', label: 'Documentos', color: '#f0a020' },
      { key: 'CONTRATO_PENDENTE', label: 'Contrato', color: '#8b5cf6' },
      { key: 'PAGAMENTO_PENDENTE', label: 'Pagamento', color: '#2563eb' },
      { key: 'ACESSO_PENDENTE', label: 'Acesso', color: '#0f766e' },
      { key: 'EM_ACOMPANHAMENTO', label: 'Acompanhamento', color: '#14a85a' },
      { key: 'RISCO_EVASAO', label: 'Risco', color: '#d03050' },
      { key: 'ONBOARDING_CONCLUIDO', label: 'Concluído', color: '#075e54' },
    ];

    return stages.map((stage) => ({
      ...stage,
      count: students.filter((student) => student.status === stage.key).length,
    }));
  }

  private tasks(students: LifecycleStudent[], storedTasks: any[] = []) {
    const manualTasks = storedTasks.map((task) => ({
      id: task.id,
      studentId: task.studentKey,
      title: task.title,
      studentName: task.studentName,
      ownerTeam: task.ownerTeam,
      priority: task.priority,
      dueAt: task.dueAt,
      automation: this.cleanVisibleText(task.automation ?? 'Criada pela equipe'),
      status: task.status,
      source: 'manual',
    }));

    const automaticTasks = students
      .filter((student) => student.status !== 'ONBOARDING_CONCLUIDO')
      .slice(0, 8)
      .map((student) => ({
        id: `task-${student.id}`,
        studentId: student.id,
        title: student.nextAction,
        studentName: student.studentName,
        ownerTeam: student.ownerTeam,
        priority: student.riskLevel === 'CRITICO' ? 'Urgente' : student.riskLevel === 'ALTO' ? 'Alta' : 'Normal',
        dueAt: student.upcomingDueAt,
        automation: this.automationFor(student.status),
        status: 'ABERTA',
        source: 'automatic',
      }));
    return [...manualTasks, ...automaticTasks].slice(0, 14);
  }

  private automations(config: RuntimeSchoolConfig, students: LifecycleStudent[]) {
    return this.rulerTemplates(config)
      .map((template) => ({
        day: template.dayOffset ?? 0,
        title: template.title,
        channel: 'WhatsApp',
        trigger: template.stage,
        message: this.schoolConfig.renderTemplate(template.whatsappText, this.schoolConfig.defaultVariables(config)),
        status: template.active ? 'Ativa' : 'Inativa',
        sentCount: students.filter((student) => student.ruler.sentDays.includes(template.dayOffset ?? 0)).length,
        pendingCount: students.filter(
          (student) => student.ruler.nextDay === template.dayOffset && student.ruler.status === 'PENDENTE',
        ).length,
        scheduledCount: students.filter(
          (student) => student.ruler.nextDay === template.dayOffset && student.ruler.status === 'AGENDADA',
        ).length,
      }));
  }

  private rulerTemplates(config: RuntimeSchoolConfig) {
    return config.templates
      .filter((template) => template.category === 'regua' && template.dayOffset !== null)
      .sort((a, b) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0));
  }

  private rulerStatus(student: LifecycleStudent, config: RuntimeSchoolConfig, storedEvents: any[]): StudentRulerStatus {
    const templates = this.rulerTemplates(config);
    const sentEntries = storedEvents
      .filter((event) => event.type === 'REGUA_DISPARADA')
      .map((event) => ({
        day: Number(this.eventMetadata(event).dayOffset),
        createdAt: event.createdAt as Date,
      }))
      .filter((entry) => Number.isFinite(entry.day));
    const sentDays = [...new Set(sentEntries.map((entry) => entry.day))].sort((a, b) => a - b);
    const unsentTemplates = templates.filter((template) => !sentDays.includes(template.dayOffset ?? -1));
    const dueTemplates = unsentTemplates.filter((template) => (template.dayOffset ?? 0) <= student.daysSinceEnrollment);
    const nextTemplate = dueTemplates[0] ?? unsentTemplates[0] ?? null;
    const lastSentAt =
      sentEntries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt ?? null;

    return {
      status: dueTemplates.length > 0 ? 'PENDENTE' : nextTemplate ? 'AGENDADA' : 'CONCLUIDA',
      nextDay: nextTemplate?.dayOffset ?? null,
      nextTitle: nextTemplate?.title ?? null,
      nextMessage: nextTemplate
        ? this.schoolConfig.renderTemplate(nextTemplate.whatsappText, this.studentVariables(student, config))
        : null,
      sentDays,
      sentCount: sentDays.length,
      pendingCount: dueTemplates.length,
      lastSentAt,
    };
  }

  private pickRulerTemplate(student: LifecycleStudent, config: RuntimeSchoolConfig, requestedDay?: number | null) {
    const templates = this.rulerTemplates(config);
    if (typeof requestedDay === 'number' && Number.isFinite(requestedDay)) {
      return templates.find((template) => template.dayOffset === requestedDay) ?? null;
    }
    if (typeof student.ruler.nextDay === 'number') {
      return templates.find((template) => template.dayOffset === student.ruler.nextDay) ?? null;
    }
    return templates[0] ?? null;
  }

  private emptyRuler(): StudentRulerStatus {
    return {
      status: 'AGENDADA',
      nextDay: null,
      nextTitle: null,
      nextMessage: null,
      sentDays: [],
      sentCount: 0,
      pendingCount: 0,
      lastSentAt: null,
    };
  }

  private messageTemplates(config: RuntimeSchoolConfig) {
    return config.templates
      .filter((template) => template.category !== 'regua')
      .sort((a, b) => a.order - b.order)
      .map((template) => ({
        title: template.title,
        text: this.schoolConfig.renderTemplate(template.whatsappText, this.schoolConfig.defaultVariables(config)),
      }));
  }

  private suggestedMessage(student: LifecycleStudent, config: RuntimeSchoolConfig) {
    const keyByStatus: Partial<Record<LifecycleStatus, string>> = {
      DOCUMENTACAO_PENDENTE: 'document_pending',
      CONTRATO_PENDENTE: 'contract_pending',
      PAGAMENTO_PENDENTE: 'payment_pending',
      ACESSO_PENDENTE: 'first_access',
      EM_ACOMPANHAMENTO: 'first_access',
      RISCO_EVASAO: 'evasion_risk',
      ONBOARDING_CONCLUIDO: 'reactivation',
    };
    const template = this.schoolConfig.templateByKey(config, keyByStatus[student.status] ?? 'welcome');
    if (template) {
      return this.schoolConfig.renderTemplate(template.whatsappText, this.studentVariables(student, config));
    }

    const firstName = this.firstName(student);
    const nextAction = student.nextAction.toLowerCase();

    if (student.status === 'DOCUMENTACAO_PENDENTE') {
      return `Oi, ${firstName}! Para liberar sua matrícula, ainda preciso te ajudar com ${nextAction}. Pode me enviar tudo em um único PDF ou arquivo por arquivo, como ficar mais fácil para você.`;
    }
    if (student.status === 'CONTRATO_PENDENTE') {
      return `Oi, ${firstName}! Seu contrato está em andamento. Vou te acompanhar por aqui até a assinatura ficar concluída.`;
    }
    if (student.status === 'PAGAMENTO_PENDENTE') {
      return `Oi, ${firstName}! Estou passando para te ajudar com o pagamento da matrícula. Se preferir, posso reenviar PIX, boleto ou link.`;
    }
    if (student.status === 'RISCO_EVASAO') {
      return `Oi, ${firstName}! Notei que seu acesso ainda não avançou como esperado. Quer que eu te ajude agora com o passo a passo?`;
    }
    return `Oi, ${firstName}! Estou passando para acompanhar sua experiência e ver se ficou alguma dúvida sobre acesso, aulas ou documentos.`;
  }

  private studentVariables(student: LifecycleStudent, config: RuntimeSchoolConfig) {
    const course = config.courses.find((item) => item.name === student.course) ?? config.courses[0];
    return this.schoolConfig.defaultVariables(config, {
      nome: this.firstName(student),
      curso: student.course,
      valor: this.formatCurrency(course?.enrollmentFee ?? 150),
      pendencia: student.nextAction.toLowerCase(),
    });
  }

  private firstName(student: LifecycleStudent) {
    return student.studentName.trim().split(/\s+/)[0] || student.studentName;
  }

  private documentLabel(enrollment: any | null, data: Record<string, unknown>) {
    const type = enrollment?.documentType ?? data.documentType ?? (enrollment?.cpf ? 'CPF' : null);
    const number = enrollment?.documentNumber ?? data.documentNumber ?? enrollment?.cpf;
    if (!type && !number) return '';
    return [type, number].filter(Boolean).join(' ');
  }

  private addressLine(data: Record<string, unknown>) {
    const parts = [
      data.address ?? data.logradouro,
      data.addressNumber ?? data.numero,
      data.complement,
      data.neighborhood ?? data.bairro,
      data.city ?? data.cidade,
      data.state ?? data.uf,
    ];
    return parts.filter((part) => String(part ?? '').trim()).join(', ');
  }

  private sameDocumentType(left: string, right: string) {
    const a = this.normalizeKey(left);
    const b = this.normalizeKey(right);
    return a === b || a.includes(b) || b.includes(a);
  }

  private normalizeKey(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
  }

  private fakeDocumentFileName(documentType: string) {
    const slug = documentType
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    return `${slug || 'documento'}-fake.pdf`;
  }

  private ageFromBirthDate(value: string) {
    const birth = new Date(value);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
    return age;
  }

  private safeJson(value: string | null | undefined): Record<string, unknown> {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private cleanVisibleText(text: string, student?: LifecycleStudent) {
    const name = student ? this.firstName(student) : 'aluno';
    const pending = student?.nextAction.toLowerCase() ?? 'a próxima pendência';

    return text
      .replace(/\{\{\s*nome\s*\}\}/gi, name)
      .replace(/\{\{\s*pendencia\s*\}\}/gi, pending)
      .replace(/\{\{\s*[^}]+\s*\}\}/g, '')
      .replace(/\{\s*nome\s*\}/gi, name)
      .replace(/\{\s*pendencia\s*\}/gi, pending)
      .replace(/\bWhatsApp\s+simulado\b/gi, 'Prévia de WhatsApp')
      .replace(/\bTarefa\s+manual\b/gi, 'Criada pela equipe')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private statusLabel(status: LifecycleStatus) {
    const labels: Record<LifecycleStatus, string> = {
      DOCUMENTACAO_PENDENTE: 'Documentação pendente',
      CONTRATO_PENDENTE: 'Contrato pendente',
      PAGAMENTO_PENDENTE: 'Pagamento pendente',
      ACESSO_PENDENTE: 'Acesso pendente',
      EM_ACOMPANHAMENTO: 'Em acompanhamento',
      RISCO_EVASAO: 'Risco de evasão',
      ONBOARDING_CONCLUIDO: 'Onboarding concluído',
    };
    return labels[status];
  }

  private nextAction(status: LifecycleStatus) {
    const actions: Record<LifecycleStatus, string> = {
      DOCUMENTACAO_PENDENTE: 'Solicitar documentação faltante',
      CONTRATO_PENDENTE: 'Reenviar link de assinatura',
      PAGAMENTO_PENDENTE: 'Enviar lembrete de pagamento',
      ACESSO_PENDENTE: 'Liberar acesso após requisitos',
      EM_ACOMPANHAMENTO: 'Checar experiência do aluno',
      RISCO_EVASAO: 'Abrir intervenção de permanência',
      ONBOARDING_CONCLUIDO: 'Nenhuma pendência',
    };
    return actions[status];
  }

  private ownerTeam(status: LifecycleStatus) {
    const owners: Record<LifecycleStatus, string> = {
      DOCUMENTACAO_PENDENTE: 'Secretaria',
      CONTRATO_PENDENTE: 'Secretaria',
      PAGAMENTO_PENDENTE: 'Financeiro',
      ACESSO_PENDENTE: 'Suporte AVA',
      EM_ACOMPANHAMENTO: 'Sucesso do Aluno',
      RISCO_EVASAO: 'Retenção',
      ONBOARDING_CONCLUIDO: 'Sucesso do Aluno',
    };
    return owners[status];
  }

  private automationFor(status: LifecycleStatus) {
    const automations: Record<LifecycleStatus, string> = {
      DOCUMENTACAO_PENDENTE: 'Dia 1 - Documentação',
      CONTRATO_PENDENTE: 'Dia 2 - Contrato',
      PAGAMENTO_PENDENTE: 'Dia 3 - Financeiro',
      ACESSO_PENDENTE: 'Dia 5 - Primeiro acesso',
      EM_ACOMPANHAMENTO: 'Dia 7 - Experiência',
      RISCO_EVASAO: 'Motor antievasão',
      ONBOARDING_CONCLUIDO: 'Encerrado',
    };
    return automations[status];
  }

  private riskScore(status: LifecycleStatus, daysSinceEnrollment: number) {
    const base: Record<LifecycleStatus, number> = {
      DOCUMENTACAO_PENDENTE: 38,
      CONTRATO_PENDENTE: 34,
      PAGAMENTO_PENDENTE: 48,
      ACESSO_PENDENTE: 42,
      EM_ACOMPANHAMENTO: 24,
      RISCO_EVASAO: 78,
      ONBOARDING_CONCLUIDO: 10,
    };
    return Math.min(100, base[status] + Math.max(0, daysSinceEnrollment - 7) * 2);
  }

  private riskLevel(score: number): RiskLevel {
    if (score >= 80) return 'CRITICO';
    if (score >= 65) return 'ALTO';
    if (score >= 35) return 'MEDIO';
    return 'BAIXO';
  }

  private nextDueOffset(status: LifecycleStatus) {
    const offsets: Record<LifecycleStatus, number> = {
      DOCUMENTACAO_PENDENTE: 1,
      CONTRATO_PENDENTE: 1,
      PAGAMENTO_PENDENTE: 0,
      ACESSO_PENDENTE: 1,
      EM_ACOMPANHAMENTO: 3,
      RISCO_EVASAO: 0,
      ONBOARDING_CONCLUIDO: 7,
    };
    return offsets[status];
  }

  private daysBetween(start: Date | string, end: Date) {
    const startedAt = new Date(start).getTime();
    return Math.max(0, Math.floor((end.getTime() - startedAt) / 86_400_000));
  }

  private addDays(date: Date | string, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private timelineDate(date: Date | string, days: number) {
    const candidate = this.addDays(date, days);
    const now = new Date();
    return candidate.getTime() > now.getTime() ? now : candidate;
  }

  private formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0);
  }
}
