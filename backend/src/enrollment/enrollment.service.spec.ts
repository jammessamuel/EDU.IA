/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from './enrollment.service';

type PrismaMock = {
  enrollment: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  postSaleState: { upsert: jest.Mock };
  postSaleTask: { count: jest.Mock; createMany: jest.Mock };
  postSaleEvent: { create: jest.Mock };
  $transaction: jest.Mock;
};

describe('EnrollmentService - conferência humana', () => {
  const enrollment = {
    id: 'enrollment-a',
    schoolId: 'school-a',
    number: '2026-0001',
    status: 'AGUARDANDO_CONFERENCIA',
    studentName: 'Aluno A',
    assigneeId: 'thais',
    paymentStatus: 'APROVADO',
    data: '{}',
    createdAt: new Date('2026-07-20T10:00:00Z'),
    updatedAt: new Date('2026-07-20T10:00:00Z'),
  };

  let prisma: PrismaMock;
  let service: EnrollmentService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-21T12:00:00Z'));
    prisma = {
      enrollment: {
        findFirst: jest.fn().mockResolvedValue(enrollment),
        update: jest.fn().mockResolvedValue({
          ...enrollment,
          status: 'CONFIRMADA',
        }),
      },
      postSaleState: { upsert: jest.fn() },
      postSaleTask: {
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn(),
      },
      postSaleEvent: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: PrismaMock) => unknown) =>
        Promise.resolve(callback(prisma)),
    );
    service = new EnrollmentService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('não confirma matrícula inexistente', async () => {
    prisma.enrollment.findFirst.mockResolvedValue(null);

    await expect(
      service.confirmEnrollment('missing', 'school-a', 'admin-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('só confirma uma matrícula na fila de conferência', async () => {
    prisma.enrollment.findFirst.mockResolvedValue({
      ...enrollment,
      status: 'AGUARDANDO_PAGAMENTO',
    });

    await expect(
      service.confirmEnrollment('enrollment-a', 'school-a', 'admin-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('registra o humano, preserva o responsável e cria o plano inicial', async () => {
    await service.confirmEnrollment(
      'enrollment-a',
      'school-a',
      'admin-a',
      'Conferido pela secretaria',
    );

    expect(prisma.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-a' },
      data: expect.objectContaining({
        status: 'CONFIRMADA',
        humanConfirmedById: 'admin-a',
        assigneeId: 'thais',
        reviewNote: 'Conferido pela secretaria',
      }),
    });
    expect(prisma.postSaleState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          assigneeId: 'thais',
          nextActionAt: new Date('2026-07-22T12:00:00Z'),
        }),
      }),
    );
    const createManyCall = prisma.postSaleTask.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(4);
    expect(
      createManyCall.data.map(
        (task: { assigneeId: string }) => task.assigneeId,
      ),
    ).toEqual(['thais', 'thais', 'thais', 'thais']);
    expect(prisma.postSaleEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'HANDOFF_MATRICULA',
        metadata: JSON.stringify({
          ownerId: 'thais',
          confirmedById: 'admin-a',
        }),
      }),
    });
  });

  it('não duplica o plano inicial se tarefas de handoff já existem', async () => {
    prisma.postSaleTask.count.mockResolvedValue(4);

    await service.confirmEnrollment('enrollment-a', 'school-a', 'admin-a');

    expect(prisma.postSaleTask.createMany).not.toHaveBeenCalled();
    expect(prisma.postSaleEvent.create).toHaveBeenCalledTimes(1);
  });

  it('move o pagamento aprovado para a conferência humana', async () => {
    prisma.enrollment.update.mockResolvedValue({
      ...enrollment,
      paymentStatus: 'APROVADO',
    });

    await service.updatePaymentStatus('enrollment-a', 'school-a', {
      status: 'aprovado',
    });

    expect(prisma.enrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-a' },
      data: expect.objectContaining({
        paymentStatus: 'APROVADO',
        status: 'AGUARDANDO_CONFERENCIA',
      }),
    });
  });
});
