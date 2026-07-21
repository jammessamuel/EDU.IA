import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

type PrismaMock = {
  user: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  role: { findUnique: jest.Mock };
  lead: { count: jest.Mock; updateMany: jest.Mock };
  enrollment: { count: jest.Mock; updateMany: jest.Mock };
  postSaleState: { count: jest.Mock; updateMany: jest.Mock };
  postSaleTask: { count: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('UsersService', () => {
  const targetUser = {
    id: 'user-target',
    name: 'Atendente Teste',
    email: 'atendente@escola.test',
    passwordHash: 'hash',
    schoolId: 'school-a',
    roleId: 'role-consultant',
    tokenVersion: 1,
    isActive: true,
    createdAt: new Date('2026-07-21T10:00:00Z'),
    screenReader: false,
    highContrast: false,
    colorBlindMode: 'none',
    reduceMotion: false,
    simpleLanguage: false,
    fontScale: 1,
    role: { id: 'role-consultant', name: 'CONSULTANT' },
  };

  let prisma: PrismaMock;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      role: { findUnique: jest.fn() },
      lead: { count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
      enrollment: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn(),
      },
      postSaleState: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn(),
      },
      postSaleTask: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: PrismaMock) => unknown) =>
        Promise.resolve(callback(prisma)),
    );
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('lista somente usuários ativos da escola sem selecionar passwordHash', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.list('school-a');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { schoolId: 'school-a', isActive: true },
      select: { id: true, name: true, email: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  });

  it('não permite alcançar usuário de outra escola', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.update('user-from-school-b', 'school-a', 'admin-a', {
        name: 'Nome novo',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-from-school-b', schoolId: 'school-a' },
      }),
    );
  });

  it('impede que o administrador desative o próprio acesso', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...targetUser,
      id: 'admin-a',
      roleId: 'role-admin',
      role: { id: 'role-admin', name: 'SCHOOL_ADMIN' },
    });

    await expect(
      service.updateStatus('admin-a', 'school-a', 'admin-a', {
        isActive: false,
      }),
    ).rejects.toThrow('Você não pode desativar o próprio acesso.');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('exige substituto quando há trabalho ativo', async () => {
    prisma.user.findFirst.mockResolvedValue(targetUser);
    prisma.lead.count.mockResolvedValue(2);

    await expect(
      service.updateStatus('user-target', 'school-a', 'admin-a', {
        isActive: false,
      }),
    ).rejects.toThrow(
      'Este funcionário possui trabalho ativo. Escolha quem receberá as atribuições antes de desativá-lo.',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('redistribui trabalho ativo e encerra as sessões ao desativar', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(targetUser)
      .mockResolvedValueOnce({ id: 'replacement-user' })
      .mockResolvedValueOnce({ ...targetUser, isActive: false });
    prisma.postSaleTask.count.mockResolvedValue(1);

    await service.updateStatus('user-target', 'school-a', 'admin-a', {
      isActive: false,
      replacementUserId: 'replacement-user',
    });

    expect(prisma.postSaleTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assigneeId: 'replacement-user' } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-target' },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
  });

  it('mantém pelo menos um administrador ativo na escola', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...targetUser,
      roleId: 'role-admin',
      role: { id: 'role-admin', name: 'SCHOOL_ADMIN' },
    });
    prisma.user.count.mockResolvedValue(0);

    await expect(
      service.updateStatus('user-target', 'school-a', 'admin-a', {
        isActive: false,
      }),
    ).rejects.toThrow(
      'A escola precisa manter pelo menos um administrador ativo.',
    );
  });
});
