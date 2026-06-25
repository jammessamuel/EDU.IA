export type TemplateCategory = 'ia' | 'pos_venda' | 'regua';
export type DocumentAudience = 'brasileiro' | 'estrangeiro' | 'menor_idade';

export const DEFAULT_BUSINESS_HOURS = {
  weekdays: 'Segunda a sexta, das 8h às 21h',
  saturday: 'Sábado, das 8h às 13h',
  sundayHolidays: 'Domingos e feriados: sem atendimento presencial',
  secretaria: 'Secretaria presencial e online no horário comercial',
  financeiro: 'Financeiro: segunda a sexta, das 9h às 18h',
  online: 'Atendimento online: segunda a sexta, das 8h às 22h',
};

export const DEFAULT_SUPPORT_CHANNELS = {
  whatsapp: '(11) 99999-0000',
  email: 'secretaria@demo.edu',
  phone: '(11) 3333-0000',
  afterHoursMessage:
    'Fora do horário, a IA registra tudo e a secretaria acompanha no próximo período útil.',
};

export const DEFAULT_PROFILE = {
  businessHours: DEFAULT_BUSINESS_HOURS,
  address: 'Av. Paulista, 1000',
  city: 'São Paulo',
  state: 'SP',
  mapLink: 'https://maps.google.com/?q=Av.+Paulista,+1000,+São+Paulo',
  referencePoints: 'Próximo ao metrô Trianon-Masp/Brigadeiro.',
  transportInfo:
    'Metrô Trianon-Masp ou Brigadeiro. Ônibus pela Av. Paulista e corredores próximos.',
  supportChannels: DEFAULT_SUPPORT_CHANNELS,
};

export const DEFAULT_COMMERCIAL_CONDITION = {
  cashDiscountPercent: 15,
  campaignActive: true,
  campaignValidUntil: null as string | null,
  promotionText:
    'Campanha demo: pagamento à vista pode liberar até {desconto}% de desconto, conforme curso e validade da campanha.',
};

export const DEFAULT_TEMPLATES = [
  {
    key: 'welcome',
    title: 'Boas-vindas',
    stage: 'Entrada',
    category: 'ia' as TemplateCategory,
    dayOffset: null,
    order: 10,
    whatsappText:
      'Oi! Tudo bem? Eu sou a secretaria virtual da *{escola}*. Posso te ajudar com cursos, valores, documentos ou já começar sua matrícula por aqui.',
  },
  {
    key: 'document_pending',
    title: 'Documento pendente',
    stage: 'Documentação',
    category: 'pos_venda' as TemplateCategory,
    dayOffset: null,
    order: 20,
    whatsappText:
      'Oi, {nome}! Para liberar sua matrícula em *{curso}*, ainda preciso te ajudar com a documentação. Pode mandar tudo em um PDF único ou arquivo por arquivo, como ficar melhor para você.',
  },
  {
    key: 'contract_pending',
    title: 'Contrato pendente',
    stage: 'Contrato',
    category: 'pos_venda' as TemplateCategory,
    dayOffset: null,
    order: 30,
    whatsappText:
      'Oi, {nome}! Seu contrato de *{curso}* já está na etapa de assinatura. Vou acompanhar com você até ficar concluído.',
  },
  {
    key: 'payment_pending',
    title: 'Pagamento pendente',
    stage: 'Financeiro',
    category: 'pos_venda' as TemplateCategory,
    dayOffset: null,
    order: 40,
    whatsappText:
      'Oi, {nome}! Estou passando para te ajudar com o pagamento da matrícula. O valor de referência é *{valor}*. Se preferir, eu deixo PIX, boleto ou cartão organizado para a demonstração.',
  },
  {
    key: 'first_access',
    title: 'Primeiro acesso',
    stage: 'Acesso',
    category: 'pos_venda' as TemplateCategory,
    dayOffset: null,
    order: 50,
    whatsappText:
      'Oi, {nome}! Sua matrícula em *{curso}* está avançando. Quer que eu te mande o passo a passo do primeiro acesso ao AVA?',
  },
  {
    key: 'evasion_risk',
    title: 'Risco de evasão',
    stage: 'Permanência',
    category: 'pos_venda' as TemplateCategory,
    dayOffset: null,
    order: 60,
    whatsappText:
      'Oi, {nome}! Notei que seu acesso ainda não avançou como esperado. Posso te ajudar agora com login, aulas ou alguma dificuldade no curso de *{curso}*?',
  },
  {
    key: 'friendly_charge',
    title: 'Cobrança amigável',
    stage: 'Financeiro',
    category: 'pos_venda' as TemplateCategory,
    dayOffset: null,
    order: 70,
    whatsappText:
      'Oi, {nome}! Passando rapidinho para te lembrar da pendência financeira da matrícula. Se quiser, eu te mostro as opções para regularizar sem complicação.',
  },
  {
    key: 'reactivation',
    title: 'Reativação de aluno parado',
    stage: 'Reativação',
    category: 'pos_venda' as TemplateCategory,
    dayOffset: null,
    order: 80,
    whatsappText:
      'Oi, {nome}! Faz alguns dias que não vejo movimento por aqui. Quer que eu te ajude a retomar o próximo passo da sua matrícula em *{curso}*?',
  },
  {
    key: 'ruler_day_0',
    title: 'Dia 0 - Boas-vindas',
    stage: 'Matrícula confirmada',
    category: 'regua' as TemplateCategory,
    dayOffset: 0,
    order: 100,
    whatsappText:
      '*Bem-vindo(a), {nome}!* Sua matrícula em *{curso}* foi registrada. Agora vou te acompanhar nos próximos passos: documentos, contrato, pagamento e acesso.',
  },
  {
    key: 'ruler_day_1',
    title: 'Dia 1 - Documentos',
    stage: 'Documentação',
    category: 'regua' as TemplateCategory,
    dayOffset: 1,
    order: 110,
    whatsappText:
      'Oi, {nome}! Hoje vou te ajudar com os documentos. Pode mandar tudo em um PDF só ou um por um. O importante é ficar simples para você.',
  },
  {
    key: 'ruler_day_3',
    title: 'Dia 3 - Pagamento',
    stage: 'Financeiro',
    category: 'regua' as TemplateCategory,
    dayOffset: 3,
    order: 120,
    whatsappText:
      'Oi, {nome}! Passando para conferir se ficou alguma dúvida sobre o pagamento da matrícula. Com pagamento à vista, a campanha pode chegar a *{desconto}%*.',
  },
  {
    key: 'ruler_day_7',
    title: 'Dia 7 - Primeiro acesso',
    stage: 'Acesso',
    category: 'regua' as TemplateCategory,
    dayOffset: 7,
    order: 130,
    whatsappText:
      'Oi, {nome}! Já conseguiu acessar o ambiente de estudos? Se quiser, eu te envio o passo a passo agora.',
  },
  {
    key: 'ruler_day_15',
    title: 'Dia 15 - Experiência',
    stage: 'Permanência',
    category: 'regua' as TemplateCategory,
    dayOffset: 15,
    order: 140,
    whatsappText:
      'Oi, {nome}! Queria saber como está sendo sua experiência no curso de *{curso}*. Alguma dificuldade com aulas, acesso ou documentos?',
  },
  {
    key: 'ruler_day_30',
    title: 'Dia 30 - Permanência',
    stage: 'Permanência',
    category: 'regua' as TemplateCategory,
    dayOffset: 30,
    order: 150,
    whatsappText:
      'Oi, {nome}! Fechamos o primeiro mês. Se tiver qualquer pendência ou dúvida, me chama por aqui que eu resolvo com você.',
  },
];

export const DEFAULT_COURSES = [
  {
    name: 'Direito',
    description:
      'Formação jurídica com prática simulada, base constitucional e preparação para carreira pública ou privada.',
    duration: '5 anos',
    modality: 'Presencial',
    shifts: ['manhã', 'noite'],
    enrollmentFee: 150,
    monthlyFee: 899,
    cashDiscountPercent: 15,
    active: true,
  },
  {
    name: 'Enfermagem',
    description:
      'Curso da área da saúde com aulas práticas, estágio supervisionado e foco em empregabilidade.',
    duration: '5 anos',
    modality: 'Presencial',
    shifts: ['manhã', 'tarde', 'noite'],
    enrollmentFee: 150,
    monthlyFee: 799,
    cashDiscountPercent: 12,
    active: true,
  },
  {
    name: 'Administração',
    description:
      'Gestão, negócios, finanças e empreendedorismo para atuação em empresas e projetos próprios.',
    duration: '4 anos',
    modality: 'Semipresencial',
    shifts: ['noite'],
    enrollmentFee: 120,
    monthlyFee: 599,
    cashDiscountPercent: 10,
    active: true,
  },
  {
    name: 'Pedagogia',
    description:
      'Formação de educadores com fundamentos de aprendizagem, gestão escolar e prática docente.',
    duration: '4 anos',
    modality: 'EAD',
    shifts: ['manhã', 'tarde', 'noite'],
    enrollmentFee: 99,
    monthlyFee: 499,
    cashDiscountPercent: 10,
    active: true,
  },
];

export const DEFAULT_DOCUMENT_REQUIREMENTS = [
  {
    audience: 'brasileiro' as DocumentAudience,
    documentType: 'RG ou CNH',
    instructions: 'Documento oficial com foto legível, frente e verso.',
    required: true,
    active: true,
    order: 10,
  },
  {
    audience: 'brasileiro' as DocumentAudience,
    documentType: 'CPF',
    instructions: 'Pode ser o CPF físico, digital ou documento oficial que contenha o número.',
    required: true,
    active: true,
    order: 20,
  },
  {
    audience: 'brasileiro' as DocumentAudience,
    documentType: 'Comprovante de residência',
    instructions: 'Conta recente em nome do aluno ou responsável.',
    required: true,
    active: true,
    order: 30,
  },
  {
    audience: 'brasileiro' as DocumentAudience,
    documentType: 'Histórico escolar',
    instructions: 'Histórico do ensino médio completo.',
    required: true,
    active: true,
    order: 40,
  },
  {
    audience: 'brasileiro' as DocumentAudience,
    documentType: 'Certificado de conclusão',
    instructions: 'Certificado ou declaração de conclusão do ensino médio.',
    required: true,
    active: true,
    order: 50,
  },
  {
    audience: 'brasileiro' as DocumentAudience,
    documentType: 'Foto 3x4',
    instructions: 'Aceita foto digital nítida, fundo claro.',
    required: false,
    active: true,
    order: 60,
  },
  {
    audience: 'estrangeiro' as DocumentAudience,
    documentType: 'Passaporte',
    instructions: 'Página de identificação do passaporte ou documento nacional equivalente.',
    required: true,
    active: true,
    order: 10,
  },
  {
    audience: 'estrangeiro' as DocumentAudience,
    documentType: 'Documento migratório',
    instructions: 'RNE/RNM, visto, autorização de residência ou comprovante equivalente, se houver.',
    required: false,
    active: true,
    order: 20,
  },
  {
    audience: 'estrangeiro' as DocumentAudience,
    documentType: 'Comprovante de endereço',
    instructions: 'Endereço atual no Brasil ou no país de residência informado.',
    required: true,
    active: true,
    order: 30,
  },
  {
    audience: 'estrangeiro' as DocumentAudience,
    documentType: 'Histórico escolar traduzido',
    instructions: 'Quando necessário, enviar tradução simples ou juramentada conforme regra da escola.',
    required: true,
    active: true,
    order: 40,
  },
  {
    audience: 'estrangeiro' as DocumentAudience,
    documentType: 'Escolaridade equivalente',
    instructions: 'Diploma, certificado ou documento que comprove formação equivalente ao ensino médio.',
    required: true,
    active: true,
    order: 50,
  },
  {
    audience: 'menor_idade' as DocumentAudience,
    documentType: 'Documento do responsável',
    instructions: 'RG/CNH/passaporte do responsável legal, frente e verso.',
    required: true,
    active: true,
    order: 10,
  },
  {
    audience: 'menor_idade' as DocumentAudience,
    documentType: 'CPF do responsável',
    instructions: 'CPF do responsável legal.',
    required: true,
    active: true,
    order: 20,
  },
  {
    audience: 'menor_idade' as DocumentAudience,
    documentType: 'Autorização/contrato assinado',
    instructions: 'Documento assinado pelo responsável legal autorizando a matrícula.',
    required: true,
    active: true,
    order: 30,
  },
];

export const TEMPLATE_VARIABLE_SAMPLE = {
  nome: 'Mariana',
  curso: 'Direito',
  valor: 'R$ 150,00',
  desconto: '15',
  escola: 'Faculdade Demo EDU.IA',
  horario: DEFAULT_BUSINESS_HOURS.weekdays,
  endereco: `${DEFAULT_PROFILE.address}, ${DEFAULT_PROFILE.city} - ${DEFAULT_PROFILE.state}`,
};
