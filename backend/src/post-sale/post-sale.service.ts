import { Injectable } from '@nestjs/common';
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

interface ChecklistStep {
  key: string;
  label: string;
  status: StepStatus;
  helper: string;
}

interface LifecycleStudent {
  id: string;
  enrollmentId: string | null;
  studentName: string;
  course: string;
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
  isDemo: boolean;
}

@Injectable()
export class PostSaleService {
  constructor(private prisma: PrismaService) {}

  async overview(schoolId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { schoolId },
      include: { documents: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });

    const students = enrollments.map((enrollment, index) => this.fromEnrollment(enrollment, index));
    const demoStudents = this.demoStudents().slice(0, Math.max(0, 6 - students.length));
    const lifecycle = [...students, ...demoStudents];

    return {
      generatedAt: new Date(),
      hasDemoData: demoStudents.length > 0,
      summary: this.summary(lifecycle),
      funnel: this.funnel(lifecycle),
      students: lifecycle,
      tasks: this.tasks(lifecycle),
      automations: this.automations(),
      messageTemplates: this.messageTemplates(),
    };
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

  private tasks(students: LifecycleStudent[]) {
    return students
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
      }));
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
        text: 'Oi, {{nome}}! Sua matrícula foi registrada. Vou te acompanhar nos próximos passos: documentos, contrato, pagamento e acesso ao AVA.',
      },
      {
        title: 'Documento pendente',
        text: 'Para liberar sua matrícula, falta {{pendencia}}. Pode me enviar tudo em um único PDF ou arquivo por arquivo, como preferir.',
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
}
