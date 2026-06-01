/**
 * Cria um workspace demo para cada vertical com login pré-definido.
 * Rodar: pnpm exec ts-node -r tsconfig-paths/register src/seeds/demo-workspaces.seed.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const WORKSPACES = [
  {
    slug:          'education',
    workspaceName: 'Faculdade São Paulo',
    email:         'admin@faculdade.demo',
    leads: [
      { name: 'Ana Paula Lima',    data: { course: 'Enfermagem',    unit: 'Centro', shift: 'manhã'  }, status: 'NOVO'        },
      { name: 'Carlos Mendes',     data: { course: 'Direito',       unit: 'Norte',  shift: 'noite'  }, status: 'NOVO'        },
      { name: 'Fernanda Rocha',    data: { course: 'Pedagogia',     unit: 'Sul',    shift: 'tarde'  }, status: 'CONTATO'     },
      { name: 'Diego Castro',      data: { course: 'Administração', unit: 'Centro', shift: 'manhã'  }, status: 'INSCRITO'    },
      { name: 'Juliana Freitas',   data: { course: 'Enfermagem',    unit: 'Norte',  shift: 'noite'  }, status: 'MATRICULADO' },
    ],
  },
  {
    slug:          'legal',
    workspaceName: 'Escritório Silva & Advogados',
    email:         'admin@advocacia.demo',
    leads: [
      { name: 'Roberto Alves',     data: { area_direito: 'Trabalhista',  tipo_caso: 'Demissão sem justa causa', cidade: 'São Paulo', urgencia: 'Normal'   }, status: 'NOVO'       },
      { name: 'Marcia Souza',      data: { area_direito: 'Família',      tipo_caso: 'Divórcio consensual',      cidade: 'Campinas',  urgencia: 'Normal'   }, status: 'NOVO'       },
      { name: 'Paulo Gomes',       data: { area_direito: 'Civil',        tipo_caso: 'Cobrança indevida',        cidade: 'Santos',    urgencia: 'Sem pressa' }, status: 'ANALISE'  },
      { name: 'Cristina Melo',     data: { area_direito: 'Empresarial',  tipo_caso: 'Contrato societário',      cidade: 'São Paulo', urgencia: 'Normal'   }, status: 'PROPOSTA'   },
      { name: 'Eduardo Nunes',     data: { area_direito: 'Criminal',     tipo_caso: 'Defesa criminal',          cidade: 'Guarulhos', urgencia: 'Urgente (prazo judicial)' }, status: 'CONTRATADO' },
    ],
  },
  {
    slug:          'real-estate',
    workspaceName: 'Imobiliária Lar Feliz',
    email:         'admin@imobiliaria.demo',
    leads: [
      { name: 'Thiago Barbosa',    data: { interesse: 'Comprar',         tipo_imovel: 'Apartamento', localizacao: 'Moema, SP',      faixa_preco: 'R$600k–1M'   }, status: 'NOVO'      },
      { name: 'Patricia Vargas',   data: { interesse: 'Alugar',          tipo_imovel: 'Casa',        localizacao: 'Alphaville, SP', faixa_preco: 'R$300k–600k' }, status: 'NOVO'      },
      { name: 'Lucas Figueiredo',  data: { interesse: 'Comprar',         tipo_imovel: 'Comercial',   localizacao: 'Centro, SP',     faixa_preco: 'Acima de R$1M' }, status: 'INTERESSE' },
      { name: 'Bianca Monteiro',   data: { interesse: 'Comprar ou Alugar',tipo_imovel: 'Apartamento',localizacao: 'Pinheiros, SP',  faixa_preco: 'R$300k–600k' }, status: 'VISITA'    },
      { name: 'André Lacerda',     data: { interesse: 'Comprar',         tipo_imovel: 'Casa',        localizacao: 'Cotia, SP',      faixa_preco: 'R$600k–1M'   }, status: 'FECHADO'   },
    ],
  },
  {
    slug:          'health',
    workspaceName: 'Clínica Bem Estar',
    email:         'admin@clinica.demo',
    leads: [
      { name: 'Camila Torres',     data: { especialidade: 'Pediatria',      tipo_atendimento: 'Consulta',    convenio: 'Unimed',             urgencia: 'Esta semana' }, status: 'NOVO'      },
      { name: 'Marcos Pereira',    data: { especialidade: 'Cardiologia',    tipo_atendimento: 'Exame',       convenio: 'Bradesco Saúde',     urgencia: 'Urgente'     }, status: 'AGENDADO'  },
      { name: 'Vanessa Oliveira',  data: { especialidade: 'Dermatologia',   tipo_atendimento: 'Consulta',    convenio: 'Particular',         urgencia: 'Sem urgência'}, status: 'CONFIRMADO'},
      { name: 'Renato Cardoso',    data: { especialidade: 'Ortopedia',      tipo_atendimento: 'Procedimento',convenio: 'Amil',               urgencia: 'Esta semana' }, status: 'ATENDIDO'  },
    ],
  },
  {
    slug:          'sales',
    workspaceName: 'TechVendas Soluções',
    email:         'admin@vendas.demo',
    leads: [
      { name: 'Igor Sampaio',      data: { produto_interesse: 'CRM Enterprise', orcamento: 'R$5k–20k',      prazo_decisao: 'Este mês'         }, status: 'NOVO'      },
      { name: 'Leticia Azevedo',   data: { produto_interesse: 'ERP Cloud',      orcamento: 'Acima de R$20k', prazo_decisao: 'Imediato'         }, status: 'INTERESSE' },
      { name: 'Gustavo Pinto',     data: { produto_interesse: 'Automação RH',   orcamento: 'R$1k–5k',       prazo_decisao: 'Esta semana'      }, status: 'PROPOSTA'  },
      { name: 'Natalia Braga',     data: { produto_interesse: 'BI Dashboard',   orcamento: 'R$5k–20k',      prazo_decisao: 'Este mês'         }, status: 'NEGOCIACAO'},
      { name: 'Felipe Corrêa',     data: { produto_interesse: 'Chatbot IA',     orcamento: 'R$1k–5k',       prazo_decisao: 'Imediato'         }, status: 'FECHADO'   },
    ],
  },
];

const PASSWORD = 'Demo@1234';

async function main() {
  console.log('🌱 Criando workspaces demo para todos os verticals...\n');

  const hash = await bcrypt.hash(PASSWORD, 10);

  for (const ws of WORKSPACES) {
    const vertical = await prisma.vertical.findUnique({ where: { slug: ws.slug } });
    if (!vertical) { console.log(`  ⚠ Vertical "${ws.slug}" não encontrado — rode verticals.seed primeiro`); continue; }

    // Cria ou reutiliza o workspace
    const subdomain = ws.workspaceName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 30);

    let school = await prisma.school.findUnique({ where: { subdomain } });
    if (!school) {
      school = await prisma.school.create({
        data: { name: ws.workspaceName, subdomain, verticalId: vertical.id },
      });
    }

    // Cria ou reutiliza o role SCHOOL_ADMIN
    let role = await prisma.role.findUnique({ where: { name: 'SCHOOL_ADMIN' } });
    if (!role) role = await prisma.role.create({ data: { name: 'SCHOOL_ADMIN' } });

    // Cria usuário demo se não existir
    const existingUser = await prisma.user.findFirst({ where: { email: ws.email, schoolId: school.id } });
    if (!existingUser) {
      await prisma.user.create({
        data: { name: 'Admin Demo', email: ws.email, passwordHash: hash, schoolId: school.id, roleId: role.id },
      });
    }

    // Recria os leads
    await prisma.lead.deleteMany({ where: { schoolId: school.id } });
    for (const lead of ws.leads) {
      await prisma.lead.create({
        data: { schoolId: school.id, name: lead.name, data: JSON.stringify(lead.data), qualified: true, status: lead.status },
      });
    }

    console.log(`  ${vertical.icon} ${ws.workspaceName}`);
    console.log(`     Login: ${ws.email} / ${PASSWORD}`);
    console.log(`     Leads: ${ws.leads.length} (${ws.leads.map(l => l.status).join(', ')})\n`);
  }

  console.log('─'.repeat(55));
  console.log('✅ Pronto! Use os logins acima para ver cada vertical.');
  console.log('   Cada um tem pipeline, cores e campos diferentes.\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
