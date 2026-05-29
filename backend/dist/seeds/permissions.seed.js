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
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const PERMISSIONS = [
    { resource: 'leads', action: 'read', scope: 'school' },
    { resource: 'leads', action: 'create', scope: 'school' },
    { resource: 'leads', action: 'update', scope: 'school' },
    { resource: 'leads', action: 'delete', scope: 'school' },
    { resource: 'leads', action: 'read', scope: 'own' },
    { resource: 'leads', action: 'update', scope: 'own' },
    { resource: 'users', action: 'manage', scope: 'school' },
    { resource: 'reports', action: 'view', scope: 'school' },
    { resource: 'settings', action: 'update', scope: 'school' },
    { resource: '*', action: '*', scope: 'all' },
];
const ROLES_CONFIG = {
    SUPER_ADMIN: ['*:*:all'],
    SCHOOL_ADMIN: [
        'leads:read:school', 'leads:create:school', 'leads:update:school', 'leads:delete:school',
        'users:manage:school', 'reports:view:school', 'settings:update:school',
    ],
    CONSULTANT: [
        'leads:read:school', 'leads:create:school', 'leads:update:own', 'leads:read:own',
    ],
};
async function main() {
    console.log('🌱 Iniciando seed de permissões...');
    for (const p of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { resource_action_scope: { resource: p.resource, action: p.action, scope: p.scope } },
            create: p,
            update: {},
        });
    }
    console.log(`✅ ${PERMISSIONS.length} permissões criadas`);
    for (const [roleName, permKeys] of Object.entries(ROLES_CONFIG)) {
        const role = await prisma.role.upsert({
            where: { name: roleName },
            create: { name: roleName },
            update: {},
        });
        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
        for (const key of permKeys) {
            const [resource, action, scope] = key.split(':');
            const perm = await prisma.permission.findUnique({
                where: { resource_action_scope: { resource, action, scope } },
            });
            if (perm) {
                await prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: perm.id },
                });
            }
        }
    }
    console.log(`✅ ${Object.keys(ROLES_CONFIG).length} roles criadas com permissões`);
    const demoSchool = await prisma.school.upsert({
        where: { subdomain: 'demo' },
        create: { name: 'Escola Demo EDU.IA', subdomain: 'demo' },
        update: {},
    });
    console.log(`✅ Escola demo: ${demoSchool.name} (${demoSchool.id})`);
    const adminRole = await prisma.role.findUnique({ where: { name: 'SCHOOL_ADMIN' } });
    const passwordHash = await bcrypt.hash('Admin@1234', 10);
    await prisma.user.upsert({
        where: { schoolId_email: { schoolId: demoSchool.id, email: 'admin@demo.edu' } },
        create: { name: 'Admin Demo', email: 'admin@demo.edu', passwordHash, schoolId: demoSchool.id, roleId: adminRole?.id },
        update: {},
    });
    const superRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
    const superHash = await bcrypt.hash('Super@1234', 10);
    await prisma.user.upsert({
        where: { schoolId_email: { schoolId: demoSchool.id, email: 'super@eduia.com' } },
        create: { name: 'Super Admin', email: 'super@eduia.com', passwordHash: superHash, schoolId: demoSchool.id, roleId: superRole?.id },
        update: {},
    });
    console.log('\n📋 CREDENCIAIS:');
    console.log('   admin@demo.edu  / Admin@1234  (SCHOOL_ADMIN)');
    console.log('   super@eduia.com / Super@1234  (SUPER_ADMIN)');
    console.log('\n🎉 Seed concluído!');
}
main()
    .catch((e) => { console.error('❌ Erro no seed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=permissions.seed.js.map