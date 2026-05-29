import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { resource: 'leads',    action: 'read',   scope: 'school' },
  { resource: 'leads',    action: 'create', scope: 'school' },
  { resource: 'leads',    action: 'update', scope: 'school' },
  { resource: 'leads',    action: 'delete', scope: 'school' },
  { resource: 'leads',    action: 'read',   scope: 'own' },
  { resource: 'leads',    action: 'update', scope: 'own' },
  { resource: 'users',    action: 'manage', scope: 'school' },
  { resource: 'reports',  action: 'view',   scope: 'school' },
  { resource: 'settings', action: 'update', scope: 'school' },
  { resource: '*',        action: '*',      scope: 'all' },
];

const ROLES_CONFIG: Record<string, string[]> = {
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

  // 1. Cria/atualiza todas as permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { resource_action_scope: { resource: p.resource, action: p.action, scope: p.scope } },
      create: p,
      update: {},
    });
  }
  console.log(`✅ ${PERMISSIONS.length} permissões criadas`);

  // 2. Cria roles globais e vincula permissões
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

  // 3. Cria escola demo
  const demoSchool = await prisma.school.upsert({
    where: { subdomain: 'demo' },
    create: { name: 'Escola Demo EDU.IA', subdomain: 'demo' },
    update: {},
  });
  console.log(`✅ Escola demo: ${demoSchool.name} (${demoSchool.id})`);

  // 4. Admin da escola demo
  const adminRole = await prisma.role.findUnique({ where: { name: 'SCHOOL_ADMIN' } });
  const passwordHash = await bcrypt.hash('Admin@1234', 10);

  await prisma.user.upsert({
    where: { schoolId_email: { schoolId: demoSchool.id, email: 'admin@demo.edu' } },
    create: { name: 'Admin Demo', email: 'admin@demo.edu', passwordHash, schoolId: demoSchool.id, roleId: adminRole?.id },
    update: {},
  });

  // 5. Super admin
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
