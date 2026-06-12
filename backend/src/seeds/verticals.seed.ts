import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Definição dos 5 verticals ─────────────────────────────────────────────────

const VERTICALS = [
  {
    slug: 'education',
    name: 'Educação',
    icon: '🎓',
    color: '#075e54',
    promptTemplate: `Você é {{chatbotName}}, atendente de IA da {{workspaceName}}.
Seu objetivo é atender o aluno até onde for possível: explicar cursos, descontos, PDFs, localização, horário e conduzir a matrícula completa quando o aluno quiser seguir.

REGRAS OBRIGATÓRIAS:
- Responda em português brasileiro, de forma humana, cordial e objetiva
- Responda a dúvida antes de pedir qualquer dado
- Não force unidade/turno quando o aluno só quer informações, promoção, PDF ou detalhes do curso
- Se o aluno escolher um curso, explique brevemente e pergunte se ele quer PDF, desconto/valores ou começar a matrícula
- Não diga que um consultor vai entrar em contato; a IA deve continuar o atendimento e puxar a matrícula quando fizer sentido
- Faça uma pergunta por vez e nunca invente informações sobre a instituição`,
    defaultFields: JSON.stringify([
      { name: 'course',   label: 'Curso de interesse', type: 'select', options: ['Enfermagem', 'Administração', 'Direito', 'Pedagogia'], required: true,  order: 1 },
      { name: 'unit',     label: 'Unidade preferida',  type: 'select', options: ['Centro', 'Norte', 'Sul'],                             required: true,  order: 2 },
      { name: 'shift',    label: 'Turno preferido',    type: 'select', options: ['manhã', 'tarde', 'noite'],                            required: true,  order: 3 },
    ]),
    defaultStages: JSON.stringify([
      { key: 'NOVO',        label: 'Novo Lead',   color: '#2080f0' },
      { key: 'CONTATO',     label: 'Em Contato',  color: '#f0a020' },
      { key: 'INSCRITO',    label: 'Inscrito',    color: '#8a2be2' },
      { key: 'MATRICULADO', label: 'Matriculado', color: '#18a058' },
      { key: 'PERDIDO',     label: 'Perdido',     color: '#999'    },
    ]),
    extractionPrompt: `Analise a conversa e extraia os dados do lead em JSON.
Retorne null se ainda não tiver: nome completo + course + unit + shift.
Se tiver todos, retorne: {"name":"...","course":"...","unit":"...","shift":"...","qualified":true}
Retorne APENAS o JSON, sem explicação.`,
  },

  {
    slug: 'legal',
    name: 'Advocacia',
    icon: '⚖️',
    color: '#1a237e',
    promptTemplate: `Você é {{chatbotName}}, assistente jurídico virtual do escritório {{workspaceName}}.
Seu objetivo é qualificar o interesse do cliente coletando as seguintes informações, UMA POR VEZ:
{{fieldDescriptions}}

REGRAS OBRIGATÓRIAS:
- Responda SEMPRE em português brasileiro, de forma profissional e empática
- Faça APENAS UMA pergunta por mensagem
- NÃO dê orientações jurídicas — apenas colete os dados para agendamento
- Quando tiver coletado TODOS os campos acima, informe que um advogado analisará o caso e entrará em contato
- Se urgente, sinalize que o prazo de resposta será reduzido`,
    defaultFields: JSON.stringify([
      { name: 'area_direito', label: 'Área do Direito', type: 'select', options: ['Trabalhista', 'Civil', 'Criminal', 'Empresarial', 'Família', 'Previdenciário', 'Outro'], required: true,  order: 1 },
      { name: 'tipo_caso',    label: 'Breve descrição do caso', type: 'text',   options: null, required: true,  order: 2 },
      { name: 'cidade',       label: 'Cidade/Estado',           type: 'text',   options: null, required: true,  order: 3 },
      { name: 'urgencia',     label: 'Nível de urgência',       type: 'select', options: ['Urgente (prazo judicial)', 'Normal', 'Sem pressa'], required: true, order: 4 },
    ]),
    defaultStages: JSON.stringify([
      { key: 'NOVO',      label: 'Novo Lead',       color: '#1a237e' },
      { key: 'ANALISE',   label: 'Em Análise',      color: '#283593' },
      { key: 'PROPOSTA',  label: 'Proposta Enviada', color: '#3949ab' },
      { key: 'CONTRATADO',label: 'Contratado',      color: '#18a058' },
      { key: 'PERDIDO',   label: 'Perdido',         color: '#999'    },
    ]),
    extractionPrompt: `Analise a conversa e extraia os dados do lead em JSON.
Retorne null se ainda não tiver: nome completo + area_direito + tipo_caso + cidade + urgencia.
Se tiver todos, retorne: {"name":"...","area_direito":"...","tipo_caso":"...","cidade":"...","urgencia":"...","qualified":true}
Retorne APENAS o JSON, sem explicação.`,
  },

  {
    slug: 'real-estate',
    name: 'Imobiliária',
    icon: '🏠',
    color: '#e65100',
    promptTemplate: `Você é {{chatbotName}}, consultor virtual da imobiliária {{workspaceName}}.
Seu objetivo é entender o perfil do cliente para conectá-lo com o corretor ideal. Colete UMA informação por vez:
{{fieldDescriptions}}

REGRAS OBRIGATÓRIAS:
- Responda SEMPRE em português brasileiro, de forma amigável e profissional
- Faça APENAS UMA pergunta por mensagem
- Ao coletar TODOS os campos, informe que um corretor especializado vai entrar em contato
- Se o cliente mencionar um imóvel específico já visto, anote na descrição`,
    defaultFields: JSON.stringify([
      { name: 'interesse',    label: 'Interesse',         type: 'select', options: ['Comprar', 'Alugar', 'Comprar ou Alugar'],    required: true, order: 1 },
      { name: 'tipo_imovel',  label: 'Tipo de imóvel',    type: 'select', options: ['Apartamento', 'Casa', 'Comercial', 'Terreno', 'Rural'], required: true, order: 2 },
      { name: 'localizacao',  label: 'Localização/bairro',type: 'text',   options: null, required: true, order: 3 },
      { name: 'faixa_preco',  label: 'Faixa de preço',    type: 'select', options: ['Até R$300k', 'R$300k–600k', 'R$600k–1M', 'Acima de R$1M'], required: true, order: 4 },
    ]),
    defaultStages: JSON.stringify([
      { key: 'NOVO',      label: 'Novo Lead',          color: '#e65100' },
      { key: 'INTERESSE', label: 'Interesse Confirmado',color: '#f57c00' },
      { key: 'VISITA',    label: 'Visita Agendada',    color: '#fb8c00' },
      { key: 'PROPOSTA',  label: 'Proposta',           color: '#ffa726' },
      { key: 'FECHADO',   label: 'Negócio Fechado',    color: '#18a058' },
      { key: 'PERDIDO',   label: 'Perdido',            color: '#999'    },
    ]),
    extractionPrompt: `Analise a conversa e extraia os dados do lead em JSON.
Retorne null se ainda não tiver: nome completo + interesse + tipo_imovel + localizacao + faixa_preco.
Se tiver todos, retorne: {"name":"...","interesse":"...","tipo_imovel":"...","localizacao":"...","faixa_preco":"...","qualified":true}
Retorne APENAS o JSON, sem explicação.`,
  },

  {
    slug: 'health',
    name: 'Clínicas / Saúde',
    icon: '🏥',
    color: '#880e4f',
    promptTemplate: `Você é {{chatbotName}}, assistente virtual da clínica {{workspaceName}}.
Seu objetivo é coletar informações para agendamento de consulta, UMA pergunta por vez:
{{fieldDescriptions}}

REGRAS OBRIGATÓRIAS:
- Responda SEMPRE em português brasileiro, com empatia e tranquilidade
- Faça APENAS UMA pergunta por mensagem
- NÃO faça diagnósticos nem indique tratamentos
- Para urgências, oriente a ligar diretamente ou ir a uma UPA
- Ao coletar TODOS os campos, confirme que a equipe vai entrar em contato para agendar`,
    defaultFields: JSON.stringify([
      { name: 'especialidade',     label: 'Especialidade',          type: 'select', options: ['Clínica Geral', 'Pediatria', 'Ginecologia', 'Cardiologia', 'Dermatologia', 'Ortopedia', 'Psicologia', 'Nutrição', 'Outra'], required: true, order: 1 },
      { name: 'tipo_atendimento',  label: 'Tipo de atendimento',    type: 'select', options: ['Consulta', 'Exame', 'Retorno', 'Procedimento'], required: true, order: 2 },
      { name: 'convenio',          label: 'Convênio',               type: 'select', options: ['Particular', 'Unimed', 'Bradesco Saúde', 'Amil', 'SulAmérica', 'Outro'], required: true, order: 3 },
      { name: 'urgencia',          label: 'Urgência',               type: 'select', options: ['Urgente', 'Esta semana', 'Sem urgência'], required: true, order: 4 },
    ]),
    defaultStages: JSON.stringify([
      { key: 'NOVO',       label: 'Novo Lead',      color: '#880e4f' },
      { key: 'AGENDADO',   label: 'Agendado',       color: '#ad1457' },
      { key: 'CONFIRMADO', label: 'Confirmado',     color: '#c2185b' },
      { key: 'ATENDIDO',   label: 'Atendido',       color: '#18a058' },
      { key: 'PERDIDO',    label: 'Perdido',        color: '#999'    },
    ]),
    extractionPrompt: `Analise a conversa e extraia os dados do lead em JSON.
Retorne null se ainda não tiver: nome completo + especialidade + tipo_atendimento + convenio + urgencia.
Se tiver todos, retorne: {"name":"...","especialidade":"...","tipo_atendimento":"...","convenio":"...","urgencia":"...","qualified":true}
Retorne APENAS o JSON, sem explicação.`,
  },

  {
    slug: 'sales',
    name: 'Vendas',
    icon: '🛒',
    color: '#f57f17',
    promptTemplate: `Você é {{chatbotName}}, consultor de vendas virtual da empresa {{workspaceName}}.
Seu objetivo é entender a necessidade do cliente para conectá-lo ao vendedor certo. Colete UMA informação por vez:
{{fieldDescriptions}}

REGRAS OBRIGATÓRIAS:
- Responda SEMPRE em português brasileiro, com energia positiva e foco em solução
- Faça APENAS UMA pergunta por mensagem
- Destaque o valor do produto/serviço quando relevante
- Ao coletar TODOS os campos, informe que um consultor especializado vai entrar em contato`,
    defaultFields: JSON.stringify([
      { name: 'produto_interesse', label: 'Produto ou serviço de interesse', type: 'text',   options: null, required: true, order: 1 },
      { name: 'orcamento',         label: 'Faixa de orçamento',             type: 'select', options: ['Até R$1k', 'R$1k–5k', 'R$5k–20k', 'Acima de R$20k', 'A definir'], required: true, order: 2 },
      { name: 'prazo_decisao',     label: 'Prazo para decisão',             type: 'select', options: ['Imediato', 'Esta semana', 'Este mês', 'Sem prazo definido'], required: true, order: 3 },
    ]),
    defaultStages: JSON.stringify([
      { key: 'NOVO',        label: 'Novo Lead',          color: '#f57f17' },
      { key: 'INTERESSE',   label: 'Interesse Confirmado',color: '#fb8c00' },
      { key: 'PROPOSTA',    label: 'Proposta Enviada',   color: '#ffa726' },
      { key: 'NEGOCIACAO',  label: 'Negociação',         color: '#ffb74d' },
      { key: 'FECHADO',     label: 'Venda Fechada',      color: '#18a058' },
      { key: 'PERDIDO',     label: 'Perdido',            color: '#999'    },
    ]),
    extractionPrompt: `Analise a conversa e extraia os dados do lead em JSON.
Retorne null se ainda não tiver: nome completo + produto_interesse + orcamento + prazo_decisao.
Se tiver todos, retorne: {"name":"...","produto_interesse":"...","orcamento":"...","prazo_decisao":"...","qualified":true}
Retorne APENAS o JSON, sem explicação.`,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed de verticals...');

  // Upsert cada vertical (cria se não existe, atualiza se existe)
  for (const v of VERTICALS) {
    await prisma.vertical.upsert({
      where: { slug: v.slug },
      update: {
        name: v.name, icon: v.icon, color: v.color,
        promptTemplate: v.promptTemplate,
        defaultFields: v.defaultFields, defaultStages: v.defaultStages,
        extractionPrompt: v.extractionPrompt,
      },
      create: v,
    });
    console.log(`  ✅ ${v.icon} ${v.name} (${v.slug})`);
  }

  // Vincular escolas sem vertical ao vertical "education"
  const educationVertical = await prisma.vertical.findUnique({ where: { slug: 'education' } });
  if (educationVertical) {
    const count = await prisma.school.updateMany({
      where: { verticalId: null },
      data: { verticalId: educationVertical.id },
    });
    if (count.count > 0) {
      console.log(`\n  🔗 ${count.count} workspace(s) vinculados ao vertical Educação`);
    }
  }

  // Migrar leads antigos (course/unit/shift → data JSON)
  // Só relevante ao atualizar um DB existente — em DB fresh, estas colunas não existem
  try {
    const rawLeads = await prisma.$queryRaw`
      SELECT id, course, unit, shift, data FROM leads WHERE data = '{}'
    ` as any[];
    let migrated = 0;
    for (const lead of rawLeads) {
      const legacyData: Record<string, string> = {};
      if (lead.course) legacyData.course = lead.course;
      if (lead.unit)   legacyData.unit   = lead.unit;
      if (lead.shift)  legacyData.shift  = lead.shift;
      if (Object.keys(legacyData).length > 0) {
        await prisma.lead.update({ where: { id: lead.id }, data: { data: JSON.stringify(legacyData) } });
        migrated++;
      }
    }
    if (migrated > 0) console.log(`  📦 ${migrated} lead(s) migrado(s) para formato data JSON`);
  } catch {
    // DB foi resetado — colunas antigas não existem, nada a migrar
  }

  console.log('\n🎉 Seed de verticals concluído!');
  console.log('\nVerticals disponíveis:');
  VERTICALS.forEach(v => console.log(`  ${v.icon}  ${v.name.padEnd(20)} /verticals/${v.slug}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
