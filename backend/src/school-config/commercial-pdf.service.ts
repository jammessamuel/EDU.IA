import { BadRequestException, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeSchoolConfig, SchoolConfigService } from './school-config.service';

export type CommercialPdfKind = 'catalogo-cursos' | 'tabela-descontos' | 'fluxo-matricula';

type PdfContext = {
  doc: PDFKit.PDFDocument;
  y: number;
  left: number;
  width: number;
  title: string;
  schoolName: string;
  pageNumber: number;
};

const COLORS = {
  brand: '#075e54',
  brandDark: '#063d37',
  accent: '#27d47b',
  ink: '#10201b',
  muted: '#5b6a65',
  line: '#d6e3df',
  soft: '#f3f8f6',
  warm: '#fbf4df',
  danger: '#b84a4a',
  white: '#ffffff',
};

@Injectable()
export class CommercialPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolConfig: SchoolConfigService,
  ) {}

  async generate(schoolId: string, rawKind: string): Promise<{ buffer: Buffer; filename: string }> {
    const kind = this.normalizeKind(rawKind);
    const [config, school] = await Promise.all([
      this.schoolConfig.getRuntimeConfig(schoolId),
      this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
    ]);
    const schoolName = school?.name || 'Instituição de Ensino';

    const titles: Record<CommercialPdfKind, string> = {
      'catalogo-cursos': 'Catálogo de cursos',
      'tabela-descontos': 'Tabela de descontos',
      'fluxo-matricula': 'Fluxo de matrícula',
    };

    const doc = new PDFDocument({
      size: 'A4',
      margin: 46,
      tagged: true,
      lang: 'pt-BR',
      displayTitle: true,
      info: {
        Title: `${titles[kind]} - ${schoolName}`,
        Subject: 'Material comercial configurável gerado pela EDU.IA',
        Author: schoolName,
        Creator: 'EDU.IA',
        Producer: 'EDU.IA via PDFKit',
        Keywords: 'educação, matrícula, cursos, desconto, atendimento',
        Language: 'pt-BR',
      },
    } as any);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const ctx: PdfContext = {
      doc,
      y: 46,
      left: 46,
      width: doc.page.width - 92,
      title: titles[kind],
      schoolName,
      pageNumber: 1,
    };

    this.header(ctx, this.subtitleFor(kind, config));
    if (kind === 'catalogo-cursos') this.catalog(ctx, config);
    if (kind === 'tabela-descontos') this.discounts(ctx, config);
    if (kind === 'fluxo-matricula') this.enrollmentFlow(ctx, config);
    this.footer(ctx);

    doc.end();
    return { buffer: await done, filename: `${kind}.pdf` };
  }

  private normalizeKind(value: string): CommercialPdfKind {
    const normalized = value.replace(/\.pdf$/i, '').trim() as CommercialPdfKind;
    if (['catalogo-cursos', 'tabela-descontos', 'fluxo-matricula'].includes(normalized)) return normalized;
    throw new BadRequestException('Material comercial não encontrado.');
  }

  private subtitleFor(kind: CommercialPdfKind, config: RuntimeSchoolConfig) {
    if (kind === 'catalogo-cursos') {
      return `${config.courses.length} curso(s) ativo(s), valores e diferenciais para enviar ao aluno.`;
    }
    if (kind === 'tabela-descontos') {
      return config.commercial.campaignActive
        ? `Campanha ativa com desconto padrão de ${config.commercial.cashDiscountPercent ?? 0}% à vista.`
        : 'Condições comerciais configuradas para simulação e atendimento.';
    }
    return 'Etapas, documentos e próximos passos para conduzir a matrícula sem intervenção manual.';
  }

  private header(ctx: PdfContext, subtitle: string) {
    const { doc, left, width } = ctx;
    doc.rect(0, 0, doc.page.width, 138).fill(COLORS.brandDark);
    doc.rect(0, 0, 13, 138).fill(COLORS.accent);
    doc
      .fillColor(COLORS.white)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('EDU.IA', left, 28, { width: 120, characterSpacing: 0.4 });
    doc
      .fontSize(23)
      .text(ctx.title, left, 52, { width: width - 148, lineGap: 2 });
    doc
      .fillColor('#d7f5ec')
      .font('Helvetica')
      .fontSize(10.5)
      .text(subtitle, left, 86, { width: width - 124, lineGap: 2 });
    doc
      .roundedRect(left + width - 118, 34, 118, 58, 8)
      .fillColor('#0d7568')
      .fill();
    doc
      .fillColor(COLORS.white)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('GERADO EM', left + width - 102, 47);
    doc
      .fontSize(11)
      .text(new Date().toLocaleDateString('pt-BR'), left + width - 102, 64);
    ctx.y = 166;
    this.infoStrip(ctx);
  }

  private infoStrip(ctx: PdfContext) {
    const { doc, left, width } = ctx;
    doc.roundedRect(left, ctx.y, width, 52, 8).fill(COLORS.soft);
    doc
      .fillColor(COLORS.brand)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('INSTITUIÇÃO', left + 14, ctx.y + 12);
    doc
      .fillColor(COLORS.ink)
      .fontSize(12)
      .text(ctx.schoolName, left + 14, ctx.y + 27, { width: 210, ellipsis: true });
    doc
      .fillColor(COLORS.brand)
      .fontSize(8)
      .text('MATERIAL', left + 260, ctx.y + 12);
    doc
      .fillColor(COLORS.ink)
      .fontSize(12)
      .text('Pronto para WhatsApp e atendimento', left + 260, ctx.y + 27, { width: 220 });
    ctx.y += 78;
  }

  private catalog(ctx: PdfContext, config: RuntimeSchoolConfig) {
    this.sectionTitle(ctx, 'Cursos disponíveis', 'Valores e descrições vêm da aba Cursos em Configurações.');
    if (!config.courses.length) {
      this.emptyState(ctx, 'Nenhum curso ativo configurado.');
      return;
    }
    for (const course of config.courses) {
      const descriptionHeight = this.measure(ctx, course.description, ctx.width - 28, 9.5, 'Helvetica');
      const cardHeight = Math.max(112, descriptionHeight + 83);
      this.ensureSpace(ctx, cardHeight + 12);
      const y = ctx.y;
      ctx.doc.roundedRect(ctx.left, y, ctx.width, cardHeight, 8).fill(COLORS.white).strokeColor(COLORS.line).stroke();
      ctx.doc.rect(ctx.left, y, 6, cardHeight).fill(COLORS.accent);
      ctx.doc
        .fillColor(COLORS.ink)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text(course.name, ctx.left + 18, y + 16, { width: ctx.width - 180 });
      const meta = [course.modality, course.duration, course.shifts.length ? `Turnos: ${course.shifts.join(', ')}` : '']
        .filter(Boolean)
        .join(' | ');
      ctx.doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(9)
        .text(meta, ctx.left + 18, y + 38, { width: ctx.width - 36 });
      ctx.doc
        .fillColor(COLORS.ink)
        .fontSize(9.5)
        .text(course.description || 'Descrição não configurada.', ctx.left + 18, y + 58, {
          width: ctx.width - 36,
          lineGap: 2,
        });
      this.valuePill(ctx, 'Matrícula', this.money(course.enrollmentFee), ctx.left + 18, y + cardHeight - 32);
      this.valuePill(ctx, 'Mensalidade', this.money(course.monthlyFee), ctx.left + 166, y + cardHeight - 32);
      this.valuePill(ctx, 'À vista', `${course.cashDiscountPercent ?? config.commercial.cashDiscountPercent ?? 0}%`, ctx.left + 314, y + cardHeight - 32);
      ctx.y += cardHeight + 12;
    }
    this.contactBox(ctx, config);
  }

  private discounts(ctx: PdfContext, config: RuntimeSchoolConfig) {
    const promotionText = this.promotionText(config);
    this.heroMetric(ctx, `${config.commercial.cashDiscountPercent ?? 0}%`, 'desconto padrão à vista', promotionText);
    this.sectionTitle(ctx, 'Condições por curso', 'Use esta tabela para negociação rápida no atendimento.');
    this.tableHeader(ctx, ['Curso', 'Matrícula', 'Mensalidade', 'À vista', 'Economia estimada'], [130, 86, 92, 72, 112]);
    for (const course of config.courses) {
      this.ensureSpace(ctx, 34);
      const discount = course.cashDiscountPercent ?? config.commercial.cashDiscountPercent ?? 0;
      const economy = course.enrollmentFee ? (course.enrollmentFee * discount) / 100 : null;
      this.tableRow(
        ctx,
        [
          course.name,
          this.money(course.enrollmentFee),
          this.money(course.monthlyFee),
          `${discount}%`,
          economy === null ? '-' : this.money(economy),
        ],
        [130, 86, 92, 72, 112],
      );
    }
    ctx.y += 14;
    this.sectionTitle(ctx, 'Regras comerciais', 'Texto configurável exibido pela IA quando o aluno pergunta sobre promoção.');
    this.noteBox(ctx, [
      config.commercial.campaignActive ? 'Campanha ativa no atendimento.' : 'Campanha marcada como inativa.',
      config.commercial.campaignValidUntil
        ? `Validade: ${new Date(config.commercial.campaignValidUntil).toLocaleDateString('pt-BR')}.`
        : 'Validade não configurada.',
      promotionText || 'Texto comercial ainda não configurado.',
      'Os valores acima são dados de demonstração e podem ser editados pela escola em Configurações.',
    ]);
  }

  private enrollmentFlow(ctx: PdfContext, config: RuntimeSchoolConfig) {
    this.sectionTitle(ctx, 'Fluxo recomendado de matrícula', 'Experiência simulada para o aluno completar tudo pelo atendimento.');
    const steps = [
      ['1', 'Boas-vindas e interesse', 'A IA identifica idioma, curso desejado e dúvidas sobre valores, horário ou localização.'],
      ['2', 'Coleta de dados', 'Dados pessoais, documento brasileiro ou estrangeiro, contato, endereço e responsável quando necessário.'],
      ['3', 'Documentação', 'Aluno pode enviar um PDF único com tudo ou documentos separados, conforme preferir.'],
      ['4', 'Pagamento local', 'Nesta fase o pagamento é simulado com estados pendente, pago, falhou ou estornado.'],
      ['5', 'Contrato local', 'Assinatura simulada com estados enviado, visualizado e assinado.'],
      ['6', 'Comprovante e acesso', 'Matrícula confirmada, PDF com QR/código e liberação do próximo passo.'],
    ];
    for (const [number, title, text] of steps) this.flowStep(ctx, number, title, text);

    ctx.y += 8;
    this.sectionTitle(ctx, 'Documentos exigidos', 'Checklist gerado a partir da aba Documentos em Configurações.');
    const grouped = this.documentsByAudience(config);
    for (const [audience, documents] of grouped.entries()) {
      this.ensureSpace(ctx, 76);
      ctx.doc
        .fillColor(COLORS.brand)
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .text(this.audienceLabel(audience).toUpperCase(), ctx.left, ctx.y);
      ctx.y += 18;
      for (const item of documents) {
        this.ensureSpace(ctx, 32);
        const required = item.required ? 'Obrigatório' : 'Opcional';
        ctx.doc
          .fillColor(COLORS.ink)
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .text(`${item.documentType} - ${required}`, ctx.left + 10, ctx.y, { width: ctx.width - 20 });
        ctx.y += 13;
        ctx.doc
          .fillColor(COLORS.muted)
          .font('Helvetica')
          .fontSize(8.5)
          .text(item.instructions || 'Sem instrução adicional.', ctx.left + 10, ctx.y, {
            width: ctx.width - 20,
            lineGap: 1,
          });
        ctx.y += Math.max(18, this.measure(ctx, item.instructions || 'Sem instrução adicional.', ctx.width - 20, 8.5, 'Helvetica') + 6);
      }
      ctx.y += 8;
    }

    this.contactBox(ctx, config);
  }

  private flowStep(ctx: PdfContext, number: string, title: string, text: string) {
    const height = Math.max(60, this.measure(ctx, text, ctx.width - 74, 9.5, 'Helvetica') + 34);
    this.ensureSpace(ctx, height + 9);
    const y = ctx.y;
    ctx.doc.roundedRect(ctx.left, y, ctx.width, height, 8).fill(COLORS.white).strokeColor(COLORS.line).stroke();
    ctx.doc.circle(ctx.left + 28, y + 28, 15).fill(COLORS.brand);
    ctx.doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(12).text(number, ctx.left + 23, y + 22, { width: 10, align: 'center' });
    ctx.doc.fillColor(COLORS.ink).fontSize(11).text(title, ctx.left + 58, y + 15, { width: ctx.width - 76 });
    ctx.doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.5).text(text, ctx.left + 58, y + 33, {
      width: ctx.width - 76,
      lineGap: 2,
    });
    ctx.y += height + 9;
  }

  private heroMetric(ctx: PdfContext, value: string, label: string, description: string) {
    this.ensureSpace(ctx, 122);
    ctx.doc.roundedRect(ctx.left, ctx.y, ctx.width, 102, 10).fill(COLORS.warm);
    ctx.doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(34).text(value, ctx.left + 20, ctx.y + 22, { width: 140 });
    ctx.doc.fillColor(COLORS.ink).fontSize(14).text(label, ctx.left + 172, ctx.y + 24, { width: ctx.width - 196 });
    ctx.doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9.5).text(description, ctx.left + 172, ctx.y + 46, {
      width: ctx.width - 196,
      lineGap: 2,
    });
    ctx.y += 126;
  }

  private contactBox(ctx: PdfContext, config: RuntimeSchoolConfig) {
    this.ensureSpace(ctx, 122);
    this.sectionTitle(ctx, 'Atendimento e localização', 'Informações editáveis em Configurações.');
    const address = [config.profile.address, config.profile.city, config.profile.state].filter(Boolean).join(', ');
    this.noteBox(ctx, [
      `Endereço: ${address || 'não informado'}.`,
      `Horário: ${this.schoolConfig.formatBusinessHours(config.profile.businessHours)}.`,
      `Referência: ${config.profile.referencePoints || 'não informado'}.`,
      `Condução: ${config.profile.transportInfo || 'não informado'}.`,
    ]);
  }

  private noteBox(ctx: PdfContext, lines: string[]) {
    const text = lines.filter(Boolean).join('\n');
    const height = Math.max(76, this.measure(ctx, text, ctx.width - 28, 9.5, 'Helvetica') + 28);
    this.ensureSpace(ctx, height + 8);
    ctx.doc.roundedRect(ctx.left, ctx.y, ctx.width, height, 8).fill(COLORS.soft).strokeColor(COLORS.line).stroke();
    ctx.doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9.5).text(text, ctx.left + 14, ctx.y + 14, {
      width: ctx.width - 28,
      lineGap: 4,
    });
    ctx.y += height + 8;
  }

  private sectionTitle(ctx: PdfContext, title: string, helper?: string) {
    this.ensureSpace(ctx, helper ? 54 : 34);
    ctx.doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(12).text(title, ctx.left, ctx.y);
    ctx.y += 17;
    if (helper) {
      ctx.doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(helper, ctx.left, ctx.y, { width: ctx.width });
      ctx.y += 22;
    } else {
      ctx.y += 8;
    }
  }

  private tableHeader(ctx: PdfContext, cells: string[], widths: number[]) {
    this.ensureSpace(ctx, 30);
    let x = ctx.left;
    ctx.doc.roundedRect(ctx.left, ctx.y, ctx.width, 28, 6).fill(COLORS.brand);
    cells.forEach((cell, index) => {
      ctx.doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(8).text(cell, x + 8, ctx.y + 10, {
        width: widths[index] - 10,
      });
      x += widths[index];
    });
    ctx.y += 30;
  }

  private tableRow(ctx: PdfContext, cells: string[], widths: number[]) {
    let x = ctx.left;
    ctx.doc.rect(ctx.left, ctx.y, ctx.width, 30).fill(COLORS.white).strokeColor(COLORS.line).stroke();
    cells.forEach((cell, index) => {
      ctx.doc.fillColor(index === 0 ? COLORS.ink : COLORS.muted).font(index === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).text(cell, x + 8, ctx.y + 9, {
        width: widths[index] - 10,
        ellipsis: true,
      });
      x += widths[index];
    });
    ctx.y += 30;
  }

  private valuePill(ctx: PdfContext, label: string, value: string, x: number, y: number) {
    ctx.doc.roundedRect(x, y, 136, 24, 6).fill(COLORS.soft).strokeColor(COLORS.line).stroke();
    ctx.doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.6).text(label.toUpperCase(), x + 8, y + 6, { width: 66 });
    ctx.doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9).text(value, x + 72, y + 7, { width: 56, align: 'right' });
  }

  private emptyState(ctx: PdfContext, text: string) {
    this.noteBox(ctx, [text, 'Ative cursos na aba Configurações para preencher este material automaticamente.']);
  }

  private ensureSpace(ctx: PdfContext, height: number) {
    if (ctx.y + height <= ctx.doc.page.height - 68) return;
    this.footer(ctx);
    ctx.doc.addPage();
    ctx.pageNumber += 1;
    ctx.y = 52;
  }

  private footer(ctx: PdfContext) {
    const y = ctx.doc.page.height - 58;
    ctx.doc.moveTo(ctx.left, y - 10).lineTo(ctx.left + ctx.width, y - 10).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    ctx.doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`${ctx.schoolName} | Material gerado pela EDU.IA | Página ${ctx.pageNumber}`, ctx.left, y, {
        width: ctx.width,
        align: 'center',
        lineBreak: false,
      });
  }

  private documentsByAudience(config: RuntimeSchoolConfig) {
    const groups = new Map<string, RuntimeSchoolConfig['documents']>();
    for (const document of config.documents) {
      groups.set(document.audience, [...(groups.get(document.audience) ?? []), document]);
    }
    return groups;
  }

  private audienceLabel(value: string) {
    const labels: Record<string, string> = {
      brasileiro: 'Aluno brasileiro',
      estrangeiro: 'Aluno estrangeiro',
      menor_idade: 'Menor de idade',
    };
    return labels[value] ?? value;
  }

  private measure(ctx: PdfContext, text: string, width: number, fontSize: number, font: string) {
    ctx.doc.font(font).fontSize(fontSize);
    return ctx.doc.heightOfString(text || ' ', { width, lineGap: 2 });
  }

  private money(value: number | null | undefined) {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  private promotionText(config: RuntimeSchoolConfig) {
    return this.schoolConfig.renderTemplate(
      config.commercial.promotionText || '',
      this.schoolConfig.defaultVariables(config),
    );
  }
}
