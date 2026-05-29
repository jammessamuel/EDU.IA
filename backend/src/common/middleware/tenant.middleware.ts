import { Injectable, NestMiddleware } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: any, res: any, next: () => void) {
    try {
      const host = (req.get('host') || '').split(':')[0].toLowerCase();
      const isLocalhost = host === 'localhost' || host === '127.0.0.1';

      if (isLocalhost) {
        const schoolIdOverride =
          req.get('X-School-Id') || (req.query?.schoolId as string);

        let school: { id: string; name: string; subdomain: string } | null = null;

        if (schoolIdOverride) {
          school = await this.prisma.school.findUnique({
            where: { id: schoolIdOverride, isActive: true },
            select: { id: true, name: true, subdomain: true },
          });
        }

        if (!school) {
          school = await this.prisma.school.findFirst({
            where: { isActive: true },
            select: { id: true, name: true, subdomain: true },
          });
        }

        if (!school) {
          return res
            .status(503)
            .json({ error: 'Nenhuma escola configurada no sistema', code: 'NO_SCHOOL_CONFIGURED' });
        }

        req.schoolId = school.id;
        req.school = school;
        return next();
      }

      // Produção: resolve pelo subdomínio
      const subdomain = host.split('.')[0];

      const school = await this.prisma.school.findUnique({
        where: { subdomain },
        select: { id: true, name: true, subdomain: true, isActive: true },
      });

      if (!school) {
        return res.status(404).json({ error: 'Escola não encontrada', code: 'SCHOOL_NOT_FOUND' });
      }

      if (!school.isActive) {
        return res.status(403).json({ error: 'Escola desativada', code: 'SCHOOL_INACTIVE' });
      }

      req.schoolId = school.id;
      req.school = { id: school.id, name: school.name, subdomain: school.subdomain };
      next();
    } catch (error: any) {
      console.error('[Tenant] Erro ao resolver tenant:', error.message);
      return res.status(500).json({ error: 'Erro ao identificar escola', code: 'TENANT_ERROR' });
    }
  }
}
