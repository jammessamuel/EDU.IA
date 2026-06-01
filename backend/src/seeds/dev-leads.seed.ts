import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const leads = [
  // Educação — NOVO
  { name: 'Camila Souza',      data: { course: 'Enfermagem',    unit: 'Centro', shift: 'manhã'  }, status: 'NOVO',        daysAgo: 0  },
  { name: 'Rafael Mendonça',   data: { course: 'Direito',       unit: 'Norte',  shift: 'noite'  }, status: 'NOVO',        daysAgo: 0  },
  { name: 'Juliana Ferreira',  data: { course: 'Pedagogia',     unit: 'Sul',    shift: 'tarde'  }, status: 'NOVO',        daysAgo: 1  },
  // NOVO — velhos (alerta ⚠)
  { name: 'Bruno Carvalho',    data: { course: 'Administração', unit: 'Centro', shift: 'noite'  }, status: 'NOVO',        daysAgo: 2  },
  { name: 'Tatiane Oliveira',  data: { course: 'Enfermagem',    unit: 'Norte',  shift: 'manhã'  }, status: 'NOVO',        daysAgo: 3  },
  // EM CONTATO
  { name: 'Lucas Rodrigues',   data: { course: 'Direito',       unit: 'Sul',    shift: 'tarde'  }, status: 'CONTATO',     daysAgo: 4  },
  { name: 'Fernanda Lima',     data: { course: 'Enfermagem',    unit: 'Centro', shift: 'noite'  }, status: 'CONTATO',     daysAgo: 3  },
  { name: 'Diego Almeida',     data: { course: 'Pedagogia',     unit: 'Norte',  shift: 'manhã'  }, status: 'CONTATO',     daysAgo: 5  },
  // INSCRITO
  { name: 'Mariana Costa',     data: { course: 'Administração', unit: 'Sul',    shift: 'tarde'  }, status: 'INSCRITO',    daysAgo: 6  },
  { name: 'Felipe Nascimento', data: { course: 'Enfermagem',    unit: 'Centro', shift: 'manhã'  }, status: 'INSCRITO',    daysAgo: 7  },
  { name: 'Amanda Ribeiro',    data: { course: 'Direito',       unit: 'Norte',  shift: 'noite'  }, status: 'INSCRITO',    daysAgo: 5  },
  // MATRICULADO
  { name: 'Thiago Martins',    data: { course: 'Enfermagem',    unit: 'Sul',    shift: 'tarde'  }, status: 'MATRICULADO', daysAgo: 9  },
  { name: 'Patrícia Gomes',    data: { course: 'Direito',       unit: 'Centro', shift: 'manhã'  }, status: 'MATRICULADO', daysAgo: 10 },
  { name: 'Gustavo Pereira',   data: { course: 'Pedagogia',     unit: 'Norte',  shift: 'noite'  }, status: 'MATRICULADO', daysAgo: 8  },
  { name: 'Isabela Santos',    data: { course: 'Administração', unit: 'Sul',    shift: 'tarde'  }, status: 'MATRICULADO', daysAgo: 12 },
  // PERDIDO
  { name: 'André Azevedo',     data: { course: 'Direito',       unit: 'Centro', shift: 'noite'  }, status: 'PERDIDO',     daysAgo: 14 },
  { name: 'Priscila Monteiro', data: { course: 'Enfermagem',    unit: 'Norte',  shift: 'manhã'  }, status: 'PERDIDO',     daysAgo: 11 },
];

async function main() {
  const school = await prisma.school.findFirst();
  if (!school) {
    console.error('❌ Nenhuma escola encontrada. Rode primeiro o permissions.seed.');
    process.exit(1);
  }

  console.log(`🏫 Usando workspace: ${school.name}`);

  await prisma.lead.deleteMany({ where: { schoolId: school.id } });

  for (const lead of leads) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - lead.daysAgo);
    createdAt.setHours(Math.floor(Math.random() * 10) + 8);

    await prisma.lead.create({
      data: {
        schoolId: school.id,
        name: lead.name,
        data: JSON.stringify(lead.data),
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
