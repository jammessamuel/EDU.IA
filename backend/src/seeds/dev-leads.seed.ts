import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const leads = [
  // NOVO — recentes
  { name: 'Camila Souza',        course: 'Enfermagem',    unit: 'Centro', shift: 'manhã',  status: 'NOVO',        daysAgo: 0 },
  { name: 'Rafael Mendonça',     course: 'Direito',       unit: 'Norte',  shift: 'noite',  status: 'NOVO',        daysAgo: 0 },
  { name: 'Juliana Ferreira',    course: 'Pedagogia',     unit: 'Sul',    shift: 'tarde',  status: 'NOVO',        daysAgo: 1 },

  // NOVO — velhos (vão aparecer como alerta ⚠)
  { name: 'Bruno Carvalho',      course: 'Administração', unit: 'Centro', shift: 'noite',  status: 'NOVO',        daysAgo: 2 },
  { name: 'Tatiane Oliveira',    course: 'Enfermagem',    unit: 'Norte',  shift: 'manhã',  status: 'NOVO',        daysAgo: 3 },

  // EM CONTATO
  { name: 'Lucas Rodrigues',     course: 'Direito',       unit: 'Sul',    shift: 'tarde',  status: 'CONTATO',     daysAgo: 4 },
  { name: 'Fernanda Lima',       course: 'Enfermagem',    unit: 'Centro', shift: 'noite',  status: 'CONTATO',     daysAgo: 3 },
  { name: 'Diego Almeida',       course: 'Pedagogia',     unit: 'Norte',  shift: 'manhã',  status: 'CONTATO',     daysAgo: 5 },

  // INSCRITO
  { name: 'Mariana Costa',       course: 'Administração', unit: 'Sul',    shift: 'tarde',  status: 'INSCRITO',    daysAgo: 6 },
  { name: 'Felipe Nascimento',   course: 'Enfermagem',    unit: 'Centro', shift: 'manhã',  status: 'INSCRITO',    daysAgo: 7 },
  { name: 'Amanda Ribeiro',      course: 'Direito',       unit: 'Norte',  shift: 'noite',  status: 'INSCRITO',    daysAgo: 5 },

  // MATRICULADO
  { name: 'Thiago Martins',      course: 'Enfermagem',    unit: 'Sul',    shift: 'tarde',  status: 'MATRICULADO', daysAgo: 9 },
  { name: 'Patrícia Gomes',      course: 'Direito',       unit: 'Centro', shift: 'manhã',  status: 'MATRICULADO', daysAgo: 10 },
  { name: 'Gustavo Pereira',     course: 'Pedagogia',     unit: 'Norte',  shift: 'noite',  status: 'MATRICULADO', daysAgo: 8 },
  { name: 'Isabela Santos',      course: 'Administração', unit: 'Sul',    shift: 'tarde',  status: 'MATRICULADO', daysAgo: 12 },

  // PERDIDO
  { name: 'André Azevedo',       course: 'Direito',       unit: 'Centro', shift: 'noite',  status: 'PERDIDO',     daysAgo: 14 },
  { name: 'Priscila Monteiro',   course: 'Enfermagem',    unit: 'Norte',  shift: 'manhã',  status: 'PERDIDO',     daysAgo: 11 },
];

async function main() {
  const school = await prisma.school.findFirst();
  if (!school) {
    console.error('❌ Nenhuma escola encontrada. Rode primeiro: node dist/seeds/permissions.seed.js');
    process.exit(1);
  }

  console.log(`🏫 Usando escola: ${school.name} (${school.id})`);

  // Remove leads anteriores do dev para não duplicar
  await prisma.lead.deleteMany({ where: { schoolId: school.id } });

  for (const lead of leads) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - lead.daysAgo);
    createdAt.setHours(Math.floor(Math.random() * 10) + 8); // entre 8h e 18h

    await prisma.lead.create({
      data: {
        schoolId: school.id,
        name: lead.name,
        course: lead.course,
        unit: lead.unit,
        shift: lead.shift,
        qualified: true,
        status: lead.status,
        createdAt,
      },
    });

    console.log(`  ✅ ${lead.status.padEnd(11)} — ${lead.name}`);
  }

  console.log(`\n🎉 ${leads.length} leads criados com sucesso!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
