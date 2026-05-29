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
exports.RbacGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("../../prisma/prisma.service");
const require_permission_decorator_1 = require("../decorators/require-permission.decorator");
const permissionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
let RbacGuard = class RbacGuard {
    reflector;
    prisma;
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const required = this.reflector.getAllAndOverride(require_permission_decorator_1.PERMISSION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!required)
            return true;
        const req = context.switchToHttp().getRequest();
        const userId = req.user?.id;
        if (!userId)
            throw new common_1.ForbiddenException('Não autenticado');
        const [resource, action, scope] = required.split(':');
        const perms = await this.loadPermissions(userId);
        if (!this.hasPermission(perms, resource, action, scope)) {
            throw new common_1.ForbiddenException(`Acesso negado: ${required}`);
        }
        return true;
    }
    async loadPermissions(userId) {
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
        const permissions = user?.role?.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}:${rp.permission.scope}`) ?? [];
        permissionsCache.set(userId, { permissions, timestamp: Date.now() });
        return permissions;
    }
    hasPermission(perms, resource, action, scope) {
        if (perms.includes('*:*:all'))
            return true;
        const scopes = scope === 'school' ? [scope, 'all'] : [scope];
        return scopes.some((s) => perms.includes(`${resource}:${action}:${s}`) ||
            perms.includes(`${resource}:*:${s}`));
    }
};
exports.RbacGuard = RbacGuard;
exports.RbacGuard = RbacGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        prisma_service_1.PrismaService])
], RbacGuard);
//# sourceMappingURL=rbac.guard.js.map