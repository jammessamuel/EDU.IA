"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantMiddleware = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let TenantMiddleware = class TenantMiddleware {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async use(req, res, next) {
        try {
            const host = (req.get('host') || '').split(':')[0].toLowerCase();
            const isLocalhost = host === 'localhost' || host === '127.0.0.1';
            if (isLocalhost) {
                const schoolIdOverride = req.get('X-School-Id') || req.query?.schoolId;
                let school = null;
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
        }
        catch (error) {
            console.error('[Tenant] Erro ao resolver tenant:', error.message);
            return res.status(500).json({ error: 'Erro ao identificar escola', code: 'TENANT_ERROR' });
        }
    }
};
exports.TenantMiddleware = TenantMiddleware;
exports.TenantMiddleware = TenantMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantMiddleware);
//# sourceMappingURL=tenant.middleware.js.map