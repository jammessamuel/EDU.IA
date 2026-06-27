import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AutomationRole =
  | 'comercial'
  | 'financeiro'
  | 'secretaria'
  | 'sucesso_do_aluno';
export type AutomationColumn =
  | 'a_fazer'
  | 'em_andamento'
  | 'aguardando_aluno'
  | 'aguardando_financeiro'
  | 'concluido';
export type AutomationOrigin =
  | 'ia'
  | 'matricula'
  | 'documento'
  | 'pagamento'
  | 'contrato'
  | 'risco_evasao'
  | 'lead';

export interface TaskAutomationStudent {
  id: string;
  enrollmentId: string | null;
  studentName: string;
  course: string;
  status: string;
  riskLevel: string;
  riskScore: number;
  documentStatus: string;
  contractStatus: string;
  paymentStatus: string;
  accessStatus: string;
  nextAction: string;
  ownerTeam: string;
  daysSinceEnrollment: number;
  upcomingDueAt: Date;
}

export interface TaskAutomationLead {
  id: string;
  name: string;
  status: string;
  data: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DesiredTask {
  schoolId: string;
  studentKey?: string | null;
  leadId?: string | null;
  enrollmentId?: string | null;
  studentName: string;
  title: string;
  role: AutomationRole;
  priority: 'Média' | 'Alta';
  dueInHours: number;
  origin: AutomationOrigin;
  column: AutomationColumn;
  relatedEntity: Record<string, unknown>;
  automation: string;
}

@Injectable()
export class TaskAutomationService {
  constructor(private prisma: PrismaService) {}

  async syncForOverview(
    schoolId: string,
    students: TaskAutomationStudent[],
    leads: TaskAutomationLead[] = [],
  ): Promise<void> {
    const desired = [
      ...students.flatMap((student) => this.tasksForStudent(schoolId, student)),
      ...leads.flatMap((lead) => this.tasksForLead(schoolId, lead)),
    ];
    const desiredKeys = new Set(desired.map((task) => this.taskKey(task)));

    await this.closeResolvedAutomationTasks(schoolId, desiredKeys);

    for (const task of desired) {
      await this.ensureTask(task);
    }
  }

  private tasksForStudent(
    schoolId: string,
    student: TaskAutomationStudent,
  ): DesiredTask[] {
    const tasks: DesiredTask[] = [];
    const normalizedStatus = this.normalize(student.status);
    const documentStatus = this.normalize(student.documentStatus);
    const paymentStatus = this.normalize(student.paymentStatus);
    const contractStatus = this.normalize(student.contractStatus);
    const accessStatus = this.normalize(student.accessStatus);

    if (
      normalizedStatus === 'documentacao_pendente' ||
      this.hasPendingDocument(documentStatus)
    ) {
      if (this.shouldChargeSingleDocument(documentStatus)) {
        tasks.push({
          schoolId,
          studentKey: student.id,
          enrollmentId: student.enrollmentId,
          studentName: student.studentName,
          title: 'Cobrar documento do aluno',
          role: 'secretaria',
          priority: 'Média',
          dueInHours: 48,
          origin: 'documento',
          column: 'aguardando_aluno',
          relatedEntity: {
            rule: 'documento_pendente',
            documentStatus: student.documentStatus,
          },
          automation:
            'Gerada automaticamente porque há documento obrigatório pendente.',
        });
      } else {
        tasks.push({
          schoolId,
          studentKey: student.id,
          enrollmentId: student.enrollmentId,
          studentName: student.studentName,
          title: 'Validar documentos',
          role: 'secretaria',
          priority: 'Média',
          dueInHours: 48,
          origin: 'matricula',
          column: 'aguardando_aluno',
          relatedEntity: {
            rule: 'matricula_iniciada',
            documentStatus: student.documentStatus,
          },
          automation:
            'Gerada automaticamente pela matrícula iniciada com checklist documental aberto.',
        });
      }
    }

    if (
      normalizedStatus === 'pagamento_pendente' ||
      /pendente|atras|falhou|pix|boleto/.test(paymentStatus)
    ) {
      tasks.push({
        schoolId,
        studentKey: student.id,
        enrollmentId: student.enrollmentId,
        studentName: student.studentName,
        title: 'Tratar pagamento',
        role: 'financeiro',
        priority: 'Alta',
        dueInHours: 24,
        origin: 'pagamento',
        column: 'aguardando_financeiro',
        relatedEntity: {
          rule: 'pagamento_pendente',
          paymentStatus: student.paymentStatus,
        },
        automation:
          'Gerada automaticamente porque o pagamento ainda não foi confirmado.',
      });
    }

    if (
      normalizedStatus === 'contrato_pendente' ||
      /pendente|enviado|reenviado|aguard/.test(contractStatus)
    ) {
      tasks.push({
        schoolId,
        studentKey: student.id,
        enrollmentId: student.enrollmentId,
        studentName: student.studentName,
        title: 'Acompanhar assinatura',
        role: 'comercial',
        priority: 'Alta',
        dueInHours: 48,
        origin: 'contrato',
        column: 'a_fazer',
        relatedEntity: {
          rule: 'contrato_pendente',
          contractStatus: student.contractStatus,
        },
        automation:
          'Gerada automaticamente porque o contrato ainda não foi assinado.',
      });
    }

    if (
      normalizedStatus === 'risco_evasao' ||
      ['ALTO', 'CRITICO'].includes(student.riskLevel)
    ) {
      tasks.push({
        schoolId,
        studentKey: student.id,
        enrollmentId: student.enrollmentId,
        studentName: student.studentName,
        title: 'Contato de retenção',
        role: 'sucesso_do_aluno',
        priority: 'Alta',
        dueInHours: 24,
        origin: 'risco_evasao',
        column: 'a_fazer',
        relatedEntity: {
          rule: 'risco_alto',
          riskLevel: student.riskLevel,
          riskScore: student.riskScore,
        },
        automation:
          'Gerada automaticamente porque o aluno entrou em risco alto de evasão.',
      });
    }

    const daysWithoutAccess = this.daysWithoutAccess(accessStatus);
    if (daysWithoutAccess >= 7) {
      tasks.push({
        schoolId,
        studentKey: student.id,
        enrollmentId: student.enrollmentId,
        studentName: student.studentName,
        title: 'Reativar aluno',
        role: 'sucesso_do_aluno',
        priority: 'Média',
        dueInHours: 48,
        origin: 'ia',
        column: 'a_fazer',
        relatedEntity: { rule: 'sem_acesso', daysWithoutAccess },
        automation:
          'Gerada automaticamente porque o aluno está sem acessar há vários dias.',
      });
    }

    return tasks;
  }

  private tasksForLead(
    schoolId: string,
    lead: TaskAutomationLead,
  ): DesiredTask[] {
    if (lead.status !== 'NOVO') return [];

    const hoursSinceUpdate = this.hoursBetween(
      lead.updatedAt ?? lead.createdAt,
      new Date(),
    );
    const isStale = hoursSinceUpdate >= 24;

    return [
      {
        schoolId,
        leadId: lead.id,
        studentName: lead.name,
        title: isStale ? 'Lead sem contato' : 'Primeiro contato comercial',
        role: 'comercial',
        priority: 'Alta',
        dueInHours: 24,
        origin: 'lead',
        column: 'a_fazer',
        relatedEntity: {
          rule: isStale ? 'lead_sem_contato' : 'lead_novo',
          leadStatus: lead.status,
        },
        automation: isStale
          ? 'Gerada automaticamente porque o lead quente ficou sem contato por mais de 24h.'
          : 'Gerada automaticamente porque um lead novo entrou no funil.',
      },
    ];
  }

  private async ensureTask(task: DesiredTask): Promise<void> {
    const relatedEntity = this.stableJson(task.relatedEntity);
    const existing = await this.prisma.postSaleTask.findFirst({
      where: {
        schoolId: task.schoolId,
        studentKey: task.studentKey ?? null,
        leadId: task.leadId ?? null,
        origin: task.origin,
        relatedEntity,
        status: { not: 'CONCLUIDA' },
      },
    });

    if (existing) {
      await this.prisma.postSaleTask.update({
        where: { id: existing.id },
        data: {
          title: task.title,
          studentName: task.studentName,
          ownerTeam: this.teamLabel(task.role),
          assignee: existing.assignee || this.teamLabel(task.role),
          role: task.role,
          priority: task.priority,
          automation: task.automation,
          autoResolve: true,
        },
      });
      return;
    }

    await this.prisma.postSaleTask.create({
      data: {
        schoolId: task.schoolId,
        studentKey: task.studentKey ?? null,
        leadId: task.leadId ?? null,
        enrollmentId: task.enrollmentId ?? null,
        studentName: task.studentName,
        title: task.title,
        ownerTeam: this.teamLabel(task.role),
        assignee: this.teamLabel(task.role),
        role: task.role,
        priority: task.priority,
        status: 'ABERTA',
        column: task.column,
        origin: task.origin,
        createdBy: 'automacao',
        automation: task.automation,
        relatedEntity,
        autoResolve: true,
        dueAt: this.addHours(new Date(), task.dueInHours),
      },
    });
  }

  private async closeResolvedAutomationTasks(
    schoolId: string,
    desiredKeys: Set<string>,
  ): Promise<void> {
    const openTasks = await this.prisma.postSaleTask.findMany({
      where: {
        schoolId,
        autoResolve: true,
        createdBy: 'automacao',
        status: { not: 'CONCLUIDA' },
      },
    });

    for (const task of openTasks) {
      if (desiredKeys.has(this.existingTaskKey(schoolId, task))) continue;
      await this.prisma.postSaleTask.update({
        where: { id: task.id },
        data: {
          status: 'CONCLUIDA',
          column: 'concluido',
          resolvedAt: new Date(),
        },
      });
    }
  }

  private taskKey(task: DesiredTask): string {
    return [
      task.schoolId,
      task.studentKey
        ? `student:${task.studentKey}`
        : `lead:${task.leadId ?? ''}`,
      task.origin,
      this.stableJson(task.relatedEntity),
    ].join(':');
  }

  private existingTaskKey(
    schoolId: string,
    task: {
      studentKey: string | null;
      leadId: string | null;
      origin: string;
      relatedEntity: string;
    },
  ): string {
    return [
      schoolId,
      task.studentKey
        ? `student:${task.studentKey}`
        : `lead:${task.leadId ?? ''}`,
      task.origin,
      task.relatedEntity || '{}',
    ].join(':');
  }

  private stableJson(value: Record<string, unknown>): string {
    const sorted = Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = value[key];
        return acc;
      }, {});
    return JSON.stringify(sorted);
  }

  private hasPendingDocument(documentStatus: string): boolean {
    return /pendente|faltando|aguardando|recusad/.test(documentStatus);
  }

  private shouldChargeSingleDocument(documentStatus: string): boolean {
    return (
      /comprovante/.test(documentStatus) &&
      !/historico|hist[oó]rico|autoriz|responsavel|respons[aá]vel|passaporte|migratorio|migrat[oó]rio/.test(
        documentStatus,
      )
    );
  }

  private daysWithoutAccess(accessStatus: string): number {
    const match = accessStatus.match(
      /sem acessar ha\s+(\d+)\s+dias|sem primeiro acesso ha\s+(\d+)\s+dias/,
    );
    if (!match) return 0;
    return Number(match[1] ?? match[2] ?? 0);
  }

  private normalize(value: string | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private teamLabel(role: AutomationRole): string {
    const labels: Record<AutomationRole, string> = {
      comercial: 'Comercial',
      financeiro: 'Financeiro',
      secretaria: 'Secretaria',
      sucesso_do_aluno: 'Sucesso do aluno',
    };
    return labels[role];
  }

  private hoursBetween(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / 36e5);
  }

  private addHours(date: Date, hours: number): Date {
    const next = new Date(date);
    next.setHours(next.getHours() + hours);
    return next;
  }
}
