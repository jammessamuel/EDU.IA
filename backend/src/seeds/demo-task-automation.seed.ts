import { PrismaClient } from '@prisma/client';
import {
  TaskAutomationService,
  TaskAutomationStudent,
} from '../post-sale/task-automation.service';

const prisma = new PrismaClient();

type DemoStudent = {
  name: string;
  type: 'brasileiro' | 'estrangeiro' | 'menor';
  course: string;
  enrollmentStatus: 'iniciada' | 'concluida';
  paymentStatus: 'APROVADO' | 'PENDENTE';
  paymentLabel: string;
  paymentAmount?: number;
  contractStatus: string;
  documentStatus: string;
  accessStatus: string;
  lifecycleStatus:
    | 'DOCUMENTACAO_PENDENTE'
    | 'CONTRATO_PENDENTE'
    | 'PAGAMENTO_PENDENTE'
    | 'EM_ACOMPANHAMENTO'
    | 'RISCO_EVASAO'
    | 'ONBOARDING_CONCLUIDO';
  riskScore: number;
  daysAgo: number;
  documents: string[];
  events: Array<{
    type: string;
    title: string;
    description: string;
    offsetHours: number;
  }>;
};

const students: DemoStudent[] = [
  {
    name: 'Camila Souza',
    type: 'brasileiro',
    course: 'Inglês Intensivo',
    enrollmentStatus: 'iniciada',
    paymentStatus: 'APROVADO',
    paymentLabel: 'Pago',
    contractStatus: 'Assinado',
    documentStatus: 'RG e CPF recebidos; comprovante de residência pendente',
    accessStatus: 'Ativo',
    lifecycleStatus: 'DOCUMENTACAO_PENDENTE',
    riskScore: 35,
    daysAgo: 2,
    documents: ['RG', 'CPF'],
    events: [
      {
        type: 'DOCUMENTO_RECEBIDO',
        title: 'Documentos pessoais recebidos',
        description: 'RG e CPF recebidos no pacote inicial.',
        offsetHours: 4,
      },
    ],
  },
  {
    name: 'Rafael Lima',
    type: 'brasileiro',
    course: 'Espanhol Básico',
    enrollmentStatus: 'iniciada',
    paymentStatus: 'APROVADO',
    paymentLabel: 'Pago',
    contractStatus: 'Enviado, aguardando assinatura',
    documentStatus: 'Aprovados',
    accessStatus: 'Ativo',
    lifecycleStatus: 'CONTRATO_PENDENTE',
    riskScore: 38,
    daysAgo: 2,
    documents: ['RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'HISTORICO_ESCOLAR'],
    events: [
      {
        type: 'CONTRATO_FAKE',
        title: 'Contrato enviado',
        description: 'Contrato simulado enviado e ainda não assinado.',
        offsetHours: 6,
      },
    ],
  },
  {
    name: 'Emily Fernandes',
    type: 'brasileiro',
    course: 'Inglês Intensivo',
    enrollmentStatus: 'iniciada',
    paymentStatus: 'PENDENTE',
    paymentLabel: 'Pendente (matrícula R$ 350)',
    paymentAmount: 350,
    contractStatus: 'Pendente',
    documentStatus: 'Aprovados',
    accessStatus: 'Ainda não liberado',
    lifecycleStatus: 'PAGAMENTO_PENDENTE',
    riskScore: 55,
    daysAgo: 1,
    documents: ['RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'HISTORICO_ESCOLAR'],
    events: [
      {
        type: 'PAGAMENTO_FAKE',
        title: 'Pagamento pendente',
        description:
          'Link de matrícula gerado, mas pagamento ainda não confirmado.',
        offsetHours: 3,
      },
    ],
  },
  {
    name: 'Lucas Andrade',
    type: 'brasileiro',
    course: 'Francês',
    enrollmentStatus: 'concluida',
    paymentStatus: 'APROVADO',
    paymentLabel: 'Pago',
    contractStatus: 'Assinado',
    documentStatus: 'Aprovados',
    accessStatus: 'Sem acessar há 7 dias',
    lifecycleStatus: 'ONBOARDING_CONCLUIDO',
    riskScore: 45,
    daysAgo: 12,
    documents: [
      'RG',
      'CPF',
      'COMPROVANTE_RESIDENCIA',
      'HISTORICO_ESCOLAR',
      'CONTRATO_ASSINADO',
    ],
    events: [
      {
        type: 'ACESSO_AVA',
        title: 'Acesso liberado',
        description: 'Aluno recebeu acesso, mas está sem entrar há 7 dias.',
        offsetHours: 12,
      },
    ],
  },
  {
    name: 'João Pedro Martins',
    type: 'brasileiro',
    course: 'Inglês Avançado',
    enrollmentStatus: 'concluida',
    paymentStatus: 'PENDENTE',
    paymentLabel: '1 mensalidade em atraso',
    contractStatus: 'Assinado',
    documentStatus: 'Aprovados',
    accessStatus: 'Queda forte de frequência',
    lifecycleStatus: 'RISCO_EVASAO',
    riskScore: 88,
    daysAgo: 34,
    documents: [
      'RG',
      'CPF',
      'COMPROVANTE_RESIDENCIA',
      'HISTORICO_ESCOLAR',
      'CONTRATO_ASSINADO',
    ],
    events: [
      {
        type: 'RISCO_EVASAO',
        title: 'Risco alto detectado',
        description: 'Frequência caiu e há mensalidade em atraso.',
        offsetHours: 18,
      },
    ],
  },
  {
    name: 'Sophie Müller',
    type: 'estrangeiro',
    course: 'Português para Estrangeiros',
    enrollmentStatus: 'iniciada',
    paymentStatus: 'APROVADO',
    paymentLabel: 'Pago',
    contractStatus: 'Enviado, aguardando assinatura',
    documentStatus:
      'Passaporte recebido; comprovante de endereço pendente; histórico traduzido pendente',
    accessStatus: 'Aguardando documentos',
    lifecycleStatus: 'DOCUMENTACAO_PENDENTE',
    riskScore: 48,
    daysAgo: 3,
    documents: ['PASSAPORTE'],
    events: [
      {
        type: 'DOCUMENTO_RECEBIDO',
        title: 'Passaporte recebido',
        description:
          'Passaporte anexado; faltam comprovante e histórico traduzido.',
        offsetHours: 8,
      },
    ],
  },
  {
    name: 'Pedro Henrique Costa',
    type: 'menor',
    course: 'Inglês Kids',
    enrollmentStatus: 'iniciada',
    paymentStatus: 'APROVADO',
    paymentLabel: 'Pago',
    contractStatus: 'Assinado',
    documentStatus:
      'Documento do responsável OK; autorização/contrato do responsável pendente',
    accessStatus: 'Aguardando documentos',
    lifecycleStatus: 'DOCUMENTACAO_PENDENTE',
    riskScore: 44,
    daysAgo: 2,
    documents: ['DOCUMENTO_RESPONSAVEL', 'CPF_RESPONSAVEL'],
    events: [
      {
        type: 'DOCUMENTO_RECEBIDO',
        title: 'Responsável identificado',
        description:
          'Documentos do responsável recebidos; falta autorização assinada.',
        offsetHours: 5,
      },
    ],
  },
  {
    name: 'Beatriz Nunes',
    type: 'brasileiro',
    course: 'Espanhol Básico',
    enrollmentStatus: 'concluida',
    paymentStatus: 'APROVADO',
    paymentLabel: 'Pago',
    contractStatus: 'Assinado',
    documentStatus: 'Aprovados',
    accessStatus: 'Ativo e frequente',
    lifecycleStatus: 'ONBOARDING_CONCLUIDO',
    riskScore: 12,
    daysAgo: 18,
    documents: [
      'RG',
      'CPF',
      'COMPROVANTE_RESIDENCIA',
      'HISTORICO_ESCOLAR',
      'CONTRATO_ASSINADO',
    ],
    events: [
      {
        type: 'ONBOARDING_CONCLUIDO',
        title: 'Onboarding concluído',
        description: 'Aluno sem pendências e com acesso frequente.',
        offsetHours: 14,
      },
    ],
  },
];

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addHours(date: Date, hours: number): Date {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function riskLevel(score: number): TaskAutomationStudent['riskLevel'] {
  if (score >= 85) return 'CRITICO';
  if (score >= 70) return 'ALTO';
  if (score >= 40) return 'MEDIO';
  return 'BAIXO';
}

function nextAction(status: DemoStudent['lifecycleStatus']): string {
  const actions: Record<DemoStudent['lifecycleStatus'], string> = {
    DOCUMENTACAO_PENDENTE: 'Resolver documentos pendentes',
    CONTRATO_PENDENTE: 'Acompanhar assinatura do contrato',
    PAGAMENTO_PENDENTE: 'Tratar pagamento pendente',
    EM_ACOMPANHAMENTO: 'Acompanhar experiência do aluno',
    RISCO_EVASAO: 'Fazer contato de retenção',
    ONBOARDING_CONCLUIDO: 'Nenhuma pendência',
  };
  return actions[status];
}

function ownerTeam(status: DemoStudent['lifecycleStatus']): string {
  const owners: Record<DemoStudent['lifecycleStatus'], string> = {
    DOCUMENTACAO_PENDENTE: 'Secretaria',
    CONTRATO_PENDENTE: 'Comercial',
    PAGAMENTO_PENDENTE: 'Financeiro',
    EM_ACOMPANHAMENTO: 'Sucesso do aluno',
    RISCO_EVASAO: 'Sucesso do aluno',
    ONBOARDING_CONCLUIDO: 'Sucesso do aluno',
  };
  return owners[status];
}

async function cleanSchoolDemo(schoolId: string): Promise<void> {
  const enrollments = await prisma.enrollment.findMany({
    where: { schoolId },
    select: { id: true },
  });
  const enrollmentIds = enrollments.map((item) => item.id);

  await prisma.postSaleTask.deleteMany({ where: { schoolId } });
  await prisma.postSaleEvent.deleteMany({ where: { schoolId } });
  await prisma.postSaleState.deleteMany({ where: { schoolId } });
  await prisma.integrationLog.deleteMany({ where: { schoolId } });
  if (enrollmentIds.length) {
    await prisma.enrollmentDocument.deleteMany({
      where: { enrollmentId: { in: enrollmentIds } },
    });
  }
  await prisma.enrollment.deleteMany({ where: { schoolId } });
  await prisma.lead.deleteMany({ where: { schoolId } });
}

async function main(): Promise<void> {
  const school =
    (await prisma.school.findUnique({ where: { subdomain: 'demo' } })) ??
    (await prisma.school.findFirst({
      where: { name: { contains: 'Demo' } },
    })) ??
    (await prisma.school.findFirst());

  if (!school) {
    console.error('Nenhuma escola encontrada. Rode primeiro o seed base.');
    process.exit(1);
  }

  console.log(`Usando workspace: ${school.name}`);
  await cleanSchoolDemo(school.id);

  const now = new Date();
  const automationStudents: TaskAutomationStudent[] = [];

  for (const [index, student] of students.entries()) {
    const createdAt = addDays(now, -student.daysAgo);
    const enrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        number: `2026-DEMO-${String(index + 1).padStart(3, '0')}`,
        status:
          student.enrollmentStatus === 'concluida'
            ? 'CONFIRMADA'
            : 'AGUARDANDO_DOCUMENTOS',
        studentName: student.name,
        documentType: student.type === 'estrangeiro' ? 'PASSAPORTE' : 'CPF',
        documentNumber:
          student.type === 'estrangeiro'
            ? `P${900000 + index}`
            : `000.000.00${index}-00`,
        preferredLanguage: student.type === 'estrangeiro' ? 'pt-BR' : 'pt-BR',
        countryOfResidence:
          student.type === 'estrangeiro' ? 'Alemanha' : 'Brasil',
        email: `${student.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z]+/g, '.')}@demo.edu`,
        phone: `(11) 9${String(88000000 + index).slice(0, 8)}`,
        course: student.course,
        shift: index % 2 === 0 ? 'noite' : 'manhã',
        unit: 'Online',
        data: JSON.stringify({
          tipoAluno: student.type,
          seed: 'thaís-bloco-10-1',
        }),
        paymentStatus: student.paymentStatus,
        paymentMethod:
          student.paymentStatus === 'APROVADO'
            ? 'PIX_SIMULADO'
            : 'LINK_SIMULADO',
        paymentAmount: student.paymentAmount ?? 350,
        paymentRef:
          student.paymentStatus === 'APROVADO'
            ? `SIM-PAGO-${index + 1}`
            : `SIM-PEND-${index + 1}`,
        authCode: `DEMO-${school.id.slice(-4).toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
        createdAt,
        confirmedAt: createdAt,
      },
    });

    for (const documentType of student.documents) {
      await prisma.enrollmentDocument.create({
        data: {
          enrollmentId: enrollment.id,
          type: documentType,
          fileName: `${documentType.toLowerCase()}-${index + 1}.pdf`,
          storagePath: `demo://${enrollment.id}/${documentType.toLowerCase()}.pdf`,
          mimeType: 'application/pdf',
          size: 128000 + index * 1000,
          uploadedAt: addHours(createdAt, 2),
        },
      });
    }

    await prisma.postSaleState.create({
      data: {
        schoolId: school.id,
        studentKey: enrollment.id,
        enrollmentId: enrollment.id,
        status: student.lifecycleStatus,
        documentStatus: student.documentStatus,
        contractStatus: student.contractStatus,
        paymentStatus: student.paymentLabel,
        accessStatus: student.accessStatus,
        riskScore: student.riskScore,
        nextAction: nextAction(student.lifecycleStatus),
        ownerTeam: ownerTeam(student.lifecycleStatus),
        notes: 'Criado pelo seed de automação do Bloco 10.1.',
      },
    });

    await prisma.postSaleEvent.create({
      data: {
        schoolId: school.id,
        studentKey: enrollment.id,
        enrollmentId: enrollment.id,
        studentName: student.name,
        type: 'MATRICULA_DEMO',
        title:
          student.enrollmentStatus === 'concluida'
            ? 'Matrícula concluída'
            : 'Matrícula iniciada',
        description: `${student.name} entrou na demo de automação com cenário: ${student.documentStatus}.`,
        metadata: JSON.stringify({
          seed: 'thaís-bloco-10-1',
          course: student.course,
        }),
        createdAt,
      },
    });

    for (const event of student.events) {
      await prisma.postSaleEvent.create({
        data: {
          schoolId: school.id,
          studentKey: enrollment.id,
          enrollmentId: enrollment.id,
          studentName: student.name,
          type: event.type,
          title: event.title,
          description: event.description,
          metadata: JSON.stringify({ seed: 'thaís-bloco-10-1' }),
          createdAt: addHours(createdAt, event.offsetHours),
        },
      });
    }

    automationStudents.push({
      id: enrollment.id,
      enrollmentId: enrollment.id,
      studentName: student.name,
      course: student.course,
      status: student.lifecycleStatus,
      riskLevel: riskLevel(student.riskScore),
      riskScore: student.riskScore,
      documentStatus: student.documentStatus,
      contractStatus: student.contractStatus,
      paymentStatus: student.paymentLabel,
      accessStatus: student.accessStatus,
      nextAction: nextAction(student.lifecycleStatus),
      ownerTeam: ownerTeam(student.lifecycleStatus),
      daysSinceEnrollment: student.daysAgo,
      upcomingDueAt: addDays(now, 2),
    });

    console.log(`Aluno: ${student.name} (${student.course})`);
  }

  const mariaCreatedAt = addHours(now, -3);
  const diegoCreatedAt = addHours(now, -26);
  const maria = await prisma.lead.create({
    data: {
      schoolId: school.id,
      name: 'Maria Clara Oliveira',
      data: JSON.stringify({
        interesse: 'Inglês Intensivo',
        origem: 'formulário do site',
        temperatura: 'quente',
      }),
      qualified: true,
      status: 'NOVO',
      createdAt: mariaCreatedAt,
      updatedAt: mariaCreatedAt,
    },
  });
  const diego = await prisma.lead.create({
    data: {
      schoolId: school.id,
      name: 'Diego Ramos',
      data: JSON.stringify({
        interesse: 'Espanhol Básico',
        origem: 'WhatsApp',
        temperatura: 'quente',
      }),
      qualified: true,
      status: 'NOVO',
      createdAt: diegoCreatedAt,
      updatedAt: diegoCreatedAt,
    },
  });

  const automation = new TaskAutomationService(prisma as never);
  await automation.syncForOverview(school.id, automationStudents, [
    maria,
    diego,
  ]);

  const tasks = await prisma.postSaleTask.findMany({
    where: { schoolId: school.id, status: 'ABERTA' },
    orderBy: [{ role: 'asc' }, { dueAt: 'asc' }],
  });

  console.log('\nTarefas geradas por automação:');
  for (const task of tasks) {
    console.log(
      `- ${task.title} | ${task.studentName} | ${task.role} | ${task.priority} | ${task.column}`,
    );
  }
  console.log(`\nTotal: ${tasks.length} tarefas abertas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
