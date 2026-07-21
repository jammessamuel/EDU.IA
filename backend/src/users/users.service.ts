import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { invalidatePermissionsCache } from '../common/guards/rbac.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const ROLE_DEFINITIONS = [
  {
    name: 'SCHOOL_ADMIN',
    label: 'Administrador',
    description:
      'Acesso completo à operação, configurações e gestão da equipe.',
  },
  {
    name: 'CONSULTANT',
    label: 'Atendente',
    description:
      'Atende leads e alunos, registra contatos e executa as próprias tarefas.',
  },
] as const;

const TERMINAL_LEAD_STATUSES = ['MATRICULADO', 'PERDIDO'];
const TERMINAL_ENROLLMENT_STATUSES = ['CANCELADA', 'REJEITADA'];
const TERMINAL_TASK_STATUSES = ['CONCLUIDA', 'CANCELADA'];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true, email: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async management(schoolId: string, currentUserId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        schoolId,
        role: { name: { in: ROLE_DEFINITIONS.map((role) => role.name) } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return {
      roles: ROLE_DEFINITIONS,
      users: await Promise.all(
        users.map(async (user) => ({
          ...user,
          roleLabel: this.roleDefinition(user.role?.name).label,
          isCurrentUser: user.id === currentUserId,
          workload: await this.workload(schoolId, user.id),
        })),
      ),
    };
  }

  async create(schoolId: string, currentUserId: string, input: CreateUserDto) {
    const email = input.email.toLowerCase().trim();
    const name = input.name.trim();
    const role = await this.findManageableRole(input.roleName);

    const existing = await this.prisma.user.findUnique({
      where: { schoolId_email: { schoolId, email } },
    });
    if (existing)
      throw new ConflictException(
        'Já existe um usuário com este email nesta escola.',
      );

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(input.password, 10),
        schoolId,
        roleId: role.id,
      },
    });

    return this.managedUser(user.id, schoolId, currentUserId);
  }

  async update(
    id: string,
    schoolId: string,
    currentUserId: string,
    input: UpdateUserDto,
  ) {
    const user = await this.findSchoolUser(id, schoolId);
    const nextRole = input.roleName
      ? await this.findManageableRole(input.roleName)
      : null;
    const roleChanged = Boolean(nextRole && nextRole.id !== user.roleId);

    if (roleChanged && id === currentUserId) {
      throw new BadRequestException(
        'Você não pode alterar o próprio perfil de acesso.',
      );
    }
    if (roleChanged && user.role?.name === 'SCHOOL_ADMIN') {
      await this.ensureAnotherActiveAdmin(schoolId, id);
    }

    const email = input.email?.toLowerCase().trim();
    if (email && email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { schoolId_email: { schoolId, email } },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Já existe um usuário com este email nesta escola.',
        );
      }
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(nextRole ? { roleId: nextRole.id } : {}),
        ...(roleChanged ? { tokenVersion: { increment: 1 } } : {}),
      },
    });

    if (roleChanged) invalidatePermissionsCache(id);
    return this.managedUser(id, schoolId, currentUserId);
  }

  async updateStatus(
    id: string,
    schoolId: string,
    currentUserId: string,
    input: UpdateUserStatusDto,
  ) {
    const user = await this.findSchoolUser(id, schoolId);
    if (user.isActive === input.isActive) {
      return this.managedUser(id, schoolId, currentUserId);
    }
    if (!input.isActive && id === currentUserId) {
      throw new BadRequestException(
        'Você não pode desativar o próprio acesso.',
      );
    }
    if (!input.isActive && user.role?.name === 'SCHOOL_ADMIN') {
      await this.ensureAnotherActiveAdmin(schoolId, id);
    }

    const workload = await this.workload(schoolId, id);
    let replacementUserId: string | undefined;
    if (!input.isActive && workload.total > 0) {
      if (!input.replacementUserId) {
        throw new BadRequestException(
          'Este funcionário possui trabalho ativo. Escolha quem receberá as atribuições antes de desativá-lo.',
        );
      }
      if (input.replacementUserId === id) {
        throw new BadRequestException(
          'Escolha outro funcionário para receber as atribuições.',
        );
      }
      const replacement = await this.prisma.user.findFirst({
        where: { id: input.replacementUserId, schoolId, isActive: true },
        select: { id: true },
      });
      if (!replacement)
        throw new BadRequestException(
          'Funcionário substituto inválido ou inativo.',
        );
      replacementUserId = replacement.id;
    }

    await this.prisma.$transaction(async (tx) => {
      if (!input.isActive && replacementUserId) {
        await Promise.all([
          tx.lead.updateMany({
            where: {
              schoolId,
              assigneeId: id,
              status: { notIn: TERMINAL_LEAD_STATUSES },
            },
            data: { assigneeId: replacementUserId },
          }),
          tx.enrollment.updateMany({
            where: {
              schoolId,
              assigneeId: id,
              status: { notIn: TERMINAL_ENROLLMENT_STATUSES },
            },
            data: { assigneeId: replacementUserId },
          }),
          tx.postSaleState.updateMany({
            where: {
              schoolId,
              assigneeId: id,
              lifecycleStatus: { in: ['ATIVO', 'PAUSADO'] },
            },
            data: { assigneeId: replacementUserId },
          }),
          tx.postSaleTask.updateMany({
            where: {
              schoolId,
              assigneeId: id,
              status: { notIn: TERMINAL_TASK_STATUSES },
            },
            data: { assigneeId: replacementUserId },
          }),
        ]);
      }

      await tx.user.update({
        where: { id },
        data: {
          isActive: input.isActive,
          tokenVersion: { increment: 1 },
        },
      });
    });

    invalidatePermissionsCache(id);
    return this.managedUser(id, schoolId, currentUserId);
  }

  async resetPassword(id: string, schoolId: string, password: string) {
    await this.findSchoolUser(id, schoolId);
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        tokenVersion: { increment: 1 },
      },
    });
    invalidatePermissionsCache(id);
    return { ok: true };
  }

  private async managedUser(
    id: string,
    schoolId: string,
    currentUserId: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, schoolId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException('Funcionário não encontrado.');
    return {
      ...user,
      roleLabel: this.roleDefinition(user.role?.name).label,
      isCurrentUser: user.id === currentUserId,
      workload: await this.workload(schoolId, user.id),
    };
  }

  private async workload(schoolId: string, userId: string) {
    const [assignedLeads, openTasks, activeCases, pendingEnrollments] =
      await Promise.all([
        this.prisma.lead.count({
          where: {
            schoolId,
            assigneeId: userId,
            status: { notIn: TERMINAL_LEAD_STATUSES },
          },
        }),
        this.prisma.postSaleTask.count({
          where: {
            schoolId,
            assigneeId: userId,
            status: { notIn: TERMINAL_TASK_STATUSES },
          },
        }),
        this.prisma.postSaleState.count({
          where: {
            schoolId,
            assigneeId: userId,
            lifecycleStatus: { in: ['ATIVO', 'PAUSADO'] },
          },
        }),
        this.prisma.enrollment.count({
          where: {
            schoolId,
            assigneeId: userId,
            status: { notIn: TERMINAL_ENROLLMENT_STATUSES },
          },
        }),
      ]);
    return {
      assignedLeads,
      openTasks,
      activeCases,
      pendingEnrollments,
      total: assignedLeads + openTasks + activeCases + pendingEnrollments,
    };
  }

  private async findSchoolUser(id: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, schoolId },
      include: { role: { select: { id: true, name: true } } },
    });
    if (!user) throw new NotFoundException('Funcionário não encontrado.');
    return user;
  }

  private async findManageableRole(name: string) {
    this.roleDefinition(name);
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role)
      throw new BadRequestException('Perfil de acesso não configurado.');
    return role;
  }

  private roleDefinition(name?: string | null) {
    const role = ROLE_DEFINITIONS.find((item) => item.name === name);
    if (!role) throw new BadRequestException('Perfil de acesso inválido.');
    return role;
  }

  private async ensureAnotherActiveAdmin(
    schoolId: string,
    excludedUserId: string,
  ) {
    const otherAdmins = await this.prisma.user.count({
      where: {
        schoolId,
        isActive: true,
        id: { not: excludedUserId },
        role: { name: 'SCHOOL_ADMIN' },
      },
    });
    if (!otherAdmins) {
      throw new BadRequestException(
        'A escola precisa manter pelo menos um administrador ativo.',
      );
    }
  }
}
