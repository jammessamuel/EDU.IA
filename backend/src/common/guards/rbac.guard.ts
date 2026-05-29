import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

// Cache de permissões em memória (5 minutos)
const permissionsCache = new Map<string, { permissions: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    const req = context.switchToHttp().getRequest<any>();
    const userId = req.user?.id;

    if (!userId) throw new ForbiddenException('Não autenticado');

    const [resource, action, scope] = required.split(':');
    const perms = await this.loadPermissions(userId);

    if (!this.hasPermission(perms, resource, action, scope)) {
      throw new ForbiddenException(`Acesso negado: ${required}`);
    }

    return true;
  }

  private async loadPermissions(userId: string): Promise<string[]> {
    const cached = permissionsCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.permissions;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissions =
      user?.role?.permissions.map(
        (rp) => `${rp.permission.resource}:${rp.permission.action}:${rp.permission.scope}`,
      ) ?? [];

    permissionsCache.set(userId, { permissions, timestamp: Date.now() });
    return permissions;
  }

  private hasPermission(perms: string[], resource: string, action: string, scope: string): boolean {
    if (perms.includes('*:*:all')) return true;
    const scopes = scope === 'school' ? [scope, 'all'] : [scope];
    return scopes.some(
      (s) =>
        perms.includes(`${resource}:${action}:${s}`) ||
        perms.includes(`${resource}:*:${s}`),
    );
  }
}
