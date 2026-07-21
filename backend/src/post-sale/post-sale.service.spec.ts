/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { PrismaService } from '../prisma/prisma.service';
import { PostSaleService } from './post-sale.service';

type PrismaMock = {
  school: { findMany: jest.Mock };
  enrollment: { findMany: jest.Mock; update: jest.Mock };
  user: { findMany: jest.Mock };
  postSaleState: { findUnique: jest.Mock; upsert: jest.Mock };
  postSaleTask: {
    findFirst: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
  };
};

describe('PostSaleService - continuidade diária', () => {
  const confirmedEnrollment = {
    id: 'enrollment-a',
    studentName: 'Aluno A',
    assigneeId: null,
    confirmedAt: new Date('2026-07-19T10:00:00Z'),
  };
  const owner = { id: 'owner-a', name: 'Thaís' };

  let prisma: PrismaMock;
  let service: PostSaleService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-21T11:00:00Z'));
    prisma = {
      school: { findMany: jest.fn().mockResolvedValue([{ id: 'school-a' }]) },
      enrollment: {
        findMany: jest.fn().mockResolvedValue([confirmedEnrollment]),
        update: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([owner]) },
      postSaleState: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      postSaleTask: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    service = new PostSaleService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'overview').mockResolvedValue({});
  });

  afterEach(() => jest.useRealTimers());

  it('repara o caso, define responsável e cria tarefa quando o aluno ficou sem acompanhamento', async () => {
    const result = await service.runScheduledAutomation();

    expect(prisma.school.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
    });
    expect(prisma.postSaleState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          schoolId: 'school-a',
          studentKey: 'enrollment-a',
          assigneeId: 'owner-a',
          lifecycleStatus: 'ATIVO',
        }),
      }),
    );
    expect(prisma.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-a' },
      data: { assigneeId: 'owner-a' },
    });
    expect(prisma.postSaleTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        enrollmentId: 'enrollment-a',
        assigneeId: 'owner-a',
        origin: 'continuidade',
        createdBy: 'automacao',
      }),
    });
    expect(result.schools).toEqual([
      expect.objectContaining({
        repairedCases: 1,
        createdTasks: 1,
        escalatedTasks: 2,
        withoutAvailableOwner: 0,
      }),
    ]);
    expect(service.overview).toHaveBeenCalledWith('school-a', false);
  });

  it('não duplica estado nem tarefa quando a continuidade já está íntegra', async () => {
    prisma.postSaleState.findUnique.mockResolvedValue({
      assigneeId: 'owner-a',
      nextActionAt: new Date('2026-07-22T11:00:00Z'),
    });
    prisma.postSaleTask.findFirst.mockResolvedValue({ id: 'task-a' });
    prisma.postSaleTask.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.runScheduledAutomation('school-a');

    expect(prisma.school.findMany).toHaveBeenCalledWith({
      where: { isActive: true, id: 'school-a' },
      select: { id: true },
    });
    expect(prisma.postSaleState.upsert).not.toHaveBeenCalled();
    expect(prisma.enrollment.update).not.toHaveBeenCalled();
    expect(prisma.postSaleTask.create).not.toHaveBeenCalled();
    expect(result.schools[0]).toMatchObject({
      repairedCases: 0,
      createdTasks: 0,
    });
  });

  it('marca tarefas atrasadas há mais de 48 horas como urgentes', async () => {
    await service.runScheduledAutomation();

    expect(prisma.postSaleTask.updateMany).toHaveBeenCalledWith({
      where: {
        schoolId: 'school-a',
        status: 'ABERTA',
        dueAt: { lt: new Date('2026-07-19T11:00:00Z') },
        priority: { not: 'Urgente' },
      },
      data: { priority: 'Urgente' },
    });
  });

  it('mantém o caso visível mesmo quando não existe responsável ativo', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.postSaleTask.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.runScheduledAutomation();

    expect(prisma.postSaleState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ assigneeId: null }),
      }),
    );
    expect(prisma.enrollment.update).not.toHaveBeenCalled();
    expect(prisma.postSaleTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assignee: 'Secretaria',
        assigneeId: null,
      }),
    });
    expect(result.schools[0]).toMatchObject({ withoutAvailableOwner: 1 });
  });
});
