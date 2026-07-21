/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { PrismaService } from '../prisma/prisma.service';
import {
  TaskAutomationService,
  TaskAutomationStudent,
} from './task-automation.service';

type PrismaMock = {
  postSaleTask: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe('TaskAutomationService', () => {
  let prisma: PrismaMock;
  let service: TaskAutomationService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-21T12:00:00Z'));
    prisma = {
      postSaleTask: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new TaskAutomationService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.useRealTimers());

  it('cria primeiro contato para lead novo e mantém o responsável', async () => {
    await service.syncForOverview(
      'school-a',
      [],
      [
        {
          id: 'lead-a',
          name: 'Lead A',
          status: 'NOVO',
          data: '{}',
          createdAt: new Date('2026-07-21T11:00:00Z'),
          updatedAt: new Date('2026-07-21T11:00:00Z'),
          assigneeId: 'thais',
        },
      ],
    );

    expect(prisma.postSaleTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead-a',
        title: 'Primeiro contato comercial',
        assigneeId: 'thais',
        dueAt: new Date('2026-07-22T12:00:00Z'),
        autoResolve: true,
      }),
    });
  });

  it('identifica lead novo sem contato há 24 horas', async () => {
    await service.syncForOverview(
      'school-a',
      [],
      [
        {
          id: 'lead-stale',
          name: 'Lead atrasado',
          status: 'NOVO',
          data: '{}',
          createdAt: new Date('2026-07-20T11:00:00Z'),
          updatedAt: new Date('2026-07-20T11:00:00Z'),
        },
      ],
    );

    expect(prisma.postSaleTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Lead sem contato',
        relatedEntity: JSON.stringify({
          leadStatus: 'NOVO',
          rule: 'lead_sem_contato',
        }),
      }),
    });
  });

  it('atualiza a tarefa automática existente sem criar duplicata', async () => {
    prisma.postSaleTask.findFirst.mockResolvedValue({
      id: 'task-existing',
      status: 'ABERTA',
      assignee: 'Comercial',
      assigneeId: null,
    });

    await service.syncForOverview(
      'school-a',
      [],
      [
        {
          id: 'lead-a',
          name: 'Lead A',
          status: 'NOVO',
          data: '{}',
          createdAt: new Date('2026-07-21T11:00:00Z'),
          updatedAt: new Date('2026-07-21T11:00:00Z'),
          assigneeId: 'thais',
        },
      ],
    );

    expect(prisma.postSaleTask.create).not.toHaveBeenCalled();
    expect(prisma.postSaleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-existing' },
      data: expect.objectContaining({
        assigneeId: 'thais',
        autoResolve: true,
      }),
    });
  });

  it('conclui automaticamente uma pendência cuja regra deixou de existir', async () => {
    prisma.postSaleTask.findMany.mockResolvedValue([
      {
        id: 'task-resolved',
        studentKey: null,
        leadId: 'lead-old',
        origin: 'lead',
        relatedEntity: '{"leadStatus":"NOVO","rule":"lead_novo"}',
      },
    ]);

    await service.syncForOverview('school-a', [], []);

    expect(prisma.postSaleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-resolved' },
      data: expect.objectContaining({
        status: 'CONCLUIDA',
        column: 'concluido',
        resolvedAt: expect.any(Date),
      }),
    });
  });

  it('gera pendências independentes para documentos, pagamento, contrato, risco e acesso', async () => {
    const student: TaskAutomationStudent = {
      id: 'student-a',
      enrollmentId: 'enrollment-a',
      studentName: 'Aluno A',
      course: 'Administração',
      status: 'RISCO_EVASAO',
      riskLevel: 'ALTO',
      riskScore: 80,
      documentStatus: 'Histórico pendente',
      contractStatus: 'Pendente',
      paymentStatus: 'Pendente',
      accessStatus: 'Sem acessar há 8 dias',
      nextAction: 'Contatar aluno',
      ownerTeam: 'Secretaria',
      daysSinceEnrollment: 8,
      upcomingDueAt: new Date('2026-07-22T12:00:00Z'),
      assigneeId: 'thais',
    };

    await service.syncForOverview('school-a', [student], []);

    expect(prisma.postSaleTask.create).toHaveBeenCalledTimes(5);
    expect(
      prisma.postSaleTask.create.mock.calls.map(
        ([call]) => call.data.title as string,
      ),
    ).toEqual([
      'Validar documentos',
      'Tratar pagamento',
      'Acompanhar assinatura',
      'Contato de retenção',
      'Reativar aluno',
    ]);
  });
});
