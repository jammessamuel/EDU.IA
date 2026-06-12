import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireFromBackend = createRequire(path.resolve('backend/package.json'));
const PDFDocument = requireFromBackend('pdfkit');

const outDir = path.resolve('frontend/public/materiais');
fs.mkdirSync(outDir, { recursive: true });

const courses = [
  {
    file: 'curso-enfermagem.pdf',
    title: 'Enfermagem',
    eyebrow: 'Saude, cuidado e carreira com proposito',
    color: '#0f766e',
    accent: '#14b8a6',
    highlights: [
      'Aulas praticas e rotina proxima do mercado',
      'Base para atuar em hospitais, clinicas e saude publica',
      'Trilha ideal para quem quer cuidar de pessoas',
    ],
    discount: 'Pagamento a vista: ate 15% de desconto conforme campanha vigente.',
    call: 'Fale com a secretaria pelo WhatsApp e receba a simulacao da matricula.',
  },
  {
    file: 'curso-direito.pdf',
    title: 'Direito',
    eyebrow: 'Formacao juridica para carreira publica e privada',
    color: '#1d4ed8',
    accent: '#60a5fa',
    highlights: [
      'Base solida em legislacao, argumentacao e pratica',
      'Caminhos em advocacia, concursos, empresas e setor publico',
      'Atividades simuladas para ganhar seguranca profissional',
    ],
    discount: 'Pagamento a vista: condicao especial para fechamento da matricula.',
    call: 'Pergunte por bolsas, unidade e turno disponiveis antes de finalizar.',
  },
  {
    file: 'curso-administracao.pdf',
    title: 'Administracao',
    eyebrow: 'Gestao, negocios e empreendedorismo',
    color: '#7c2d12',
    accent: '#f59e0b',
    highlights: [
      'Formacao ampla para empresas, gestao e vendas',
      'Conteudos de lideranca, financeiro, marketing e processos',
      'Boa escolha para quem quer crescer ou abrir o proprio negocio',
    ],
    discount: 'Pagamento a vista: ate 15% de desconto conforme analise da campanha.',
    call: 'A secretaria pode montar a melhor opcao de unidade, turno e pagamento.',
  },
];

function drawCourse(course) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 42,
    info: {
      Title: `Curso de ${course.title} - EDU.IA`,
      Author: 'EDU.IA',
      Subject: `Material comercial do curso de ${course.title}`,
      Keywords: 'curso, matricula, desconto, pagamento a vista',
    },
  });

  const out = fs.createWriteStream(path.join(outDir, course.file));
  doc.pipe(out);

  doc.rect(0, 0, 595.28, 190).fill(course.color);
  doc.circle(510, 58, 92).fillOpacity(0.18).fill('#ffffff').fillOpacity(1);
  doc.circle(70, 155, 48).fillOpacity(0.16).fill('#ffffff').fillOpacity(1);

  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(13).text('EDU.IA | Matriculas inteligentes', 42, 42);
  doc.font('Helvetica-Bold').fontSize(44).text(course.title, 42, 78, { width: 360 });
  doc.font('Helvetica').fontSize(16).text(course.eyebrow, 44, 132, { width: 420 });

  doc.roundedRect(395, 120, 146, 52, 10).fill('#ffffff');
  doc.fill(course.color).font('Helvetica-Bold').fontSize(18).text('A VISTA', 417, 132);
  doc.font('Helvetica').fontSize(10).text('condicao especial', 418, 154);

  doc.fill('#111827').font('Helvetica-Bold').fontSize(24).text('Por que escolher este curso?', 42, 232);
  let y = 282;
  for (const item of course.highlights) {
    doc.roundedRect(42, y - 9, 18, 18, 9).fill(course.accent);
    doc.fill('#ffffff').font('Helvetica-Bold').fontSize(11).text('✓', 47, y - 7);
    doc.fill('#1f2937').font('Helvetica-Bold').fontSize(14).text(item, 74, y - 8, { width: 450 });
    y += 48;
  }

  doc.roundedRect(42, 445, 510, 104, 14).fill('#f8fafc').stroke('#dbeafe');
  doc.fill(course.color).font('Helvetica-Bold').fontSize(20).text('Condicao comercial', 68, 468);
  doc.fill('#111827').font('Helvetica').fontSize(14).text(course.discount, 68, 502, { width: 420 });

  doc.roundedRect(42, 585, 510, 94, 14).fill(course.color);
  doc.fill('#ffffff').font('Helvetica-Bold').fontSize(21).text('Quer garantir sua vaga?', 68, 610);
  doc.font('Helvetica').fontSize(13).text(course.call, 68, 642, { width: 400 });

  doc.fill('#4b5563').fontSize(9).text(
    'Material demonstrativo. Valores, bolsas, descontos e disponibilidade devem ser confirmados pela secretaria no momento da matricula.',
    42,
    760,
    { width: 510, align: 'center' },
  );

  doc.end();
  return new Promise((resolve) => out.on('finish', resolve));
}

for (const course of courses) {
  await drawCourse(course);
}

console.log(`Materiais gerados em ${outDir}`);
