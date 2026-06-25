import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  isDemo: boolean;
}

@Injectable()
export class PostSaleService {
  constructor(private prisma: PrismaService) {}

  async overview(schoolId: string): Promise<Record<string, unknown>> {
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
    const [states, events, storedTasks] = await Promise.all([
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
    ]);
    const stateByStudent = new Map(states.map((state) => [state.studentKey, state]));
    const eventsByStudent = this.groupByStudent(events);
    const lifecycle = baseLifecycle.map((student) => {
      const withState = this.applyState(student, stateByStudent.get(student.id));
      return {
        ...withState,
        timeline: this.timelineFor(withState, eventsByStudent.get(student.id) ?? []),
      };
    });

    return {
      generatedAt: new Date(),
      hasDemoData: demoStudents.length > 0,
      summary: this.summary(lifecycle),
      funnel: this.funnel(lifecycle),
      students: lifecycle,
      tasks: this.tasks(lifecycle, storedTasks),
      automations: this.automations(),
      messageTemplates: this.messageTemplates(),
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
  ): Promise<{ message: string; overview: unknown }> {
    const student = await this.findStudent(schoolId, studentKey);
    const message = this.cleanVisibleText(input.message?.trim() || this.suggestedMessage(student), student);

    await this.recordEvent(schoolId, student, {
      type: 'WHATSAPP_SIMULADO',
      title: 'Prévia de WhatsApp gerada',
      description: message,
      metadata: { channel: 'WhatsApp', simulated: true },
    });

    return { message, overview: await this.overview(schoolId) };
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
      automationsQueued: students.filter((student) => student.status !== 'ONBOARDING_CONCLUIDO').length * 2,
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

  private automations() {
    return [
      {
        day: 0,
        title: 'Boas-vindas',
        channel: 'WhatsApp',
        trigger: 'Matrícula confirmada',
        message: 'Enviar boas-vindas, calendário, acesso e apresentação da assistente virtual.',
        status: 'Ativa',
      },
      {
        day: 1,
        title: 'Documentação',
        channel: 'WhatsApp',
        trigger: 'Documentos pendentes',
        message: 'Solicitar documentos faltantes e aceitar PDF único ou arquivos separados.',
        status: 'Ativa',
      },
      {
        day: 2,
        title: 'Contrato',
        channel: 'D4Sign',
        trigger: 'Contrato sem assinatura',
        message: 'Gerar contrato, enviar link e lembrar em 24h, 72h e 5 dias.',
        status: 'Preparada',
      },
      {
        day: 3,
        title: 'Financeiro',
        channel: 'PIX/Boleto',
        trigger: 'Pagamento pendente',
        message: 'Enviar cobrança e lembretes antes/depois do vencimento.',
        status: 'Preparada',
      },
      {
        day: 5,
        title: 'Primeiro acesso',
        channel: 'AVA',
        trigger: 'Aluno sem acesso',
        message: 'Checar login no AVA e mandar tutorial se ainda não entrou.',
        status: 'Preparada',
      },
      {
        day: 15,
        title: 'Permanência',
        channel: 'IA',
        trigger: 'Baixo engajamento',
        message: 'Enviar incentivo personalizado ou abrir tarefa para equipe.',
        status: 'Preparada',
      },
    ];
  }

  private messageTemplates() {
    return [
      {
        title: 'Boas-vindas',
        text: 'Oi! Que bom ter você com a gente. Sua matrícula já foi registrada e eu vou te acompanhar nos próximos passos: documentos, contrato, pagamento e acesso ao AVA.',
      },
      {
        title: 'Documento pendente',
        text: 'Para liberar sua matrícula, ainda preciso dos documentos pendentes. Você pode enviar tudo em um único PDF ou arquivo por arquivo, como ficar mais fácil.',
      },
      {
        title: 'Contrato',
        text: 'Seu contrato está pronto para assinatura. Vou te enviar o link e acompanhar por aqui até ficar tudo certo.',
      },
      {
        title: 'Primeiro acesso',
        text: 'Vi que seu acesso ao AVA ainda não apareceu por aqui. Quer que eu te mande o passo a passo para entrar?',
      },
    ];
  }

  private suggestedMessage(student: LifecycleStudent) {
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

  private firstName(student: LifecycleStudent) {
    return student.studentName.trim().split(/\s+/)[0] || student.studentName;
  }

  private cleanVisibleText(text: string, student?: LifecycleStudent) {
    const name = student ? this.firstName(student) : 'aluno';
    const pending = student?.nextAction.toLowerCase() ?? 'a próxima pendência';

    return text
      .replace(/\{\{\s*nome\s*\}\}/gi, name)
      .replace(/\{\{\s*pendencia\s*\}\}/gi, pending)
      .replace(/\{\{\s*[^}]+\s*\}\}/g, '')
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
}
