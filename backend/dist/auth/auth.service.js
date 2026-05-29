"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("../common/lib/jwt");
let AuthService = class AuthService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async register(dto) {
        const { name, email, password, schoolName } = dto;
        const subdomain = this.generateSubdomain(schoolName);
        const existingSchool = await this.prisma.school.findUnique({
            where: { subdomain },
        });
        if (existingSchool) {
            throw new common_1.ConflictException(`Escola com subdomain "${subdomain}" já existe. Escolha outro nome.`);
        }
        const normalizedEmail = email.toLowerCase().trim();
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await this.prisma.$transaction(async (tx) => {
            const school = await tx.school.create({
                data: { name: schoolName, subdomain },
            });
            let adminRole = await tx.role.findUnique({
                where: { name: 'SCHOOL_ADMIN' },
            });
            if (!adminRole) {
                adminRole = await tx.role.create({
                    data: { name: 'SCHOOL_ADMIN' },
                });
            }
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
            },
        };
    }
    async login(dto, schoolId) {
        const normalizedEmail = dto.email.toLowerCase().trim();
        const user = await this.prisma.user.findFirst({
            where: { email: normalizedEmail, schoolId, isActive: true },
            include: { school: { select: { name: true, subdomain: true } } },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Email ou senha incorretos');
        }
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid) {
            throw new common_1.UnauthorizedException('Email ou senha incorretos');
        }
        const token = this.generateToken(user);
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                schoolId: user.schoolId,
                schoolName: user.school.name,
                subdomain: user.school.subdomain,
            },
        };
    }
    async logout(userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } },
        });
        return { ok: true };
    }
    generateToken(user) {
        return jwt.sign({
            userId: user.id,
            email: user.email,
            name: user.name,
            schoolId: user.schoolId,
            tokenVersion: user.tokenVersion,
        }, (0, jwt_1.getJwtSecret)(), { expiresIn: '7d' });
    }
    generateSubdomain(schoolName) {
        return schoolName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 30);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map