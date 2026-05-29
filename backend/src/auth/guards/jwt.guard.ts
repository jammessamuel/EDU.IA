import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { getJwtSecret } from '../../common/lib/jwt';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rotas marcadas com @Public() passam sem token
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<any>();
    const token = req.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Token não fornecido');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expirado');
      }
      throw new UnauthorizedException('Token inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        schoolId: true,
        tokenVersion: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inválido ou desativado');
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Sessão encerrada. Faça login novamente.');
    }

    req.user = user;
    req.schoolId = user.schoolId;
    return true;
  }
}
