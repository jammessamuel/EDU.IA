import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { getJwtSecret } from '../common/lib/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const { name, email, password, verticalId } = dto;
    const workspaceName = dto.workspaceName ?? dto.schoolName ?? 'Meu Workspace';

    // Valida vertical
    const vertical = await this.prisma.vertical.findUnique({ where: { id: verticalId } });
    if (!vertical) throw new BadRequestException('Vertical inválido. Selecione um setor válido.');

    // Gera subdomain a partir do nome do workspace
    const subdomain = this.generateSubdomain(workspaceName);

    // Verifica se subdomínio está disponível
    const existingSchool = await this.prisma.school.findUnique({ where: { subdomain } });
    if (existingSchool) {
      throw new ConflictException(`Workspace "${subdomain}" já existe. Escolha outro nome.`);
    }

    // Verifica unicidade do email (pode existir o mesmo email em escolas diferentes)
    const normalizedEmail = email.toLowerCase().trim();

    const passwordHash = await bcrypt.hash(password, 10);

    // Cria escola + role SCHOOL_ADMIN + usuário em transação
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cria o workspace com o vertical selecionado
      const school = await tx.school.create({
        data: { name: workspaceName, subdomain, verticalId: vertical.id },
      });

      // 2. Busca role SCHOOL_ADMIN (role global do sistema)
      let adminRole = await tx.role.findUnique({
        where: { name: 'SCHOOL_ADMIN' },
      });

      if (!adminRole) {
        adminRole = await tx.role.create({
          data: { name: 'SCHOOL_ADMIN' },
        });
      }

      // 3. Cria o usuário admin da escola
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
          schoolId: school.id,
          roleId: adminRole.id,
        },
      });

      return { school, user };
    });

    const token = this.generateToken(result.user);

    return {
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        schoolId: result.school.id,
        schoolName: result.school.name,
        subdomain: result.school.subdomain,
        verticalId: vertical.id,
        verticalSlug: vertical.slug,
      },
    };
  }

  async login(dto: LoginDto, schoolId: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Em dev: tenta no schoolId do middleware; se não achar, busca globalmente pelo email.
    // Em produção o subdomínio já resolve corretamente, então schoolId sempre bate.
    let user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, schoolId, isActive: true },
      include: { school: { select: { name: true, subdomain: true, vertical: { select: { slug: true } } } } },
    });

    if (!user && process.env.NODE_ENV !== 'production') {
      user = await this.prisma.user.findFirst({
        where: { email: normalizedEmail, isActive: true },
        include: { school: { select: { name: true, subdomain: true, vertical: { select: { slug: true } } } } },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!user) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        schoolId: user.schoolId,
        schoolName:   user.school.name,
        subdomain:    user.school.subdomain,
        verticalSlug: (user.school as any).vertical?.slug ?? null,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { ok: true };
  }

  private generateToken(user: { id: string; email: string; name: string; schoolId: string; tokenVersion: number }) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        schoolId: user.schoolId,
        tokenVersion: user.tokenVersion,
      },
      getJwtSecret(),
      { expiresIn: '7d' },
    );
  }

  private generateSubdomain(schoolName: string): string {
    return schoolName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  }
}
