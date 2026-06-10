// ============================================================
// comprovante-pdf.ts — gera o PDF do comprovante de matrícula.
// pdfkit (layout) + qrcode (autenticação). Tudo JS puro, roda no
// serverless da Vercel (sem Chromium/puppeteer).
// ============================================================
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import {
  EDUCATION_ENROLLMENT_FIELDS,
  SECTION_LABELS,
  type EnrollmentField,
  type Section,
} from './enrollment-fields';
import { formatCpf } from '../common/lib/validation';

const GREEN = '#075e54';
const INK = '#12211d';
const MUTED = '#6a7a74';
const LINE = '#e4dfd2';

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return {};
  }
}

function frontendBase(): string {
  return (process.env.FRONTEND_URL ?? '').split(',')[0].trim() || 'https://edu-ia-front.vercel.app';
}

function formatValue(f: EnrollmentField, data: Record<string, unknown>, enrollment: any): string {
  const raw = (data[f.name] ?? (enrollment as Record<string, unknown>)[f.name] ?? '').toString().trim();
  if (!raw) return '';
  if (f.type === 'cpf') return formatCpf(raw);
  if (f.name === 'paymentMethod' && enrollment.paymentAmount != null) {
    return `${raw} — R$ ${Number(enrollment.paymentAmount).toFixed(2)} (${enrollment.paymentStatus})`;
  }
  return raw;
}

export async function gerarComprovantePdf(enrollment: any): Promise<Buffer> {
  const data = safeJson(enrollment.data);
  const schoolName = enrollment.school?.name ?? 'Instituição de Ensino';

  // QR Code apontando para a página de validação do comprovante
  const validateUrl = `${frontendBase()}/validar/${enrollment.authCode}`;
  const qrDataUrl = await QRCode.toDataURL(validateUrl, { margin: 1, width: 140 });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Comprovante de Matrícula ${enrollment.number}` } });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = 48;
  const contentWidth = doc.page.width - 96;

  // ── Cabeçalho ──
  doc.rect(0, 0, doc.page.width, 92).fill(GREEN);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text(schoolName, left, 28, { width: contentWidth - 80 });
  doc.font('Helvetica').fontSize(11).fillColor('#d7f5ec').text('Comprovante de Matrícula', left, 58);

  let y = 116;

  // ── Faixa: número + situação + QR ──
  doc.roundedRect(left, y, contentWidth, 60, 8).fill('#f2efe7');
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8).text('Nº DE MATRÍCULA', left + 16, y + 12);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(17).text(enrollment.number, left + 16, y + 26);
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8).text('SITUAÇÃO', left + 230, y + 12);
  doc.fillColor('#18a058').font('Helvetica-Bold').fontSize(13)
    .text(enrollment.status === 'CONFIRMADA' ? 'MATRICULADO' : enrollment.status, left + 230, y + 26);
  doc.image(qrBuffer, left + contentWidth - 72, y - 4, { width: 68 });
  y += 82;

  // ── Seções ──
  const sections: Section[] = ['pessoais', 'contato', 'endereco', 'academico', 'escolaridade', 'responsavel', 'pagamento'];

  for (const sec of sections) {
    const rows = EDUCATION_ENROLLMENT_FIELDS.filter((f) => f.section === sec)
      .map((f) => ({ label: f.label, value: formatValue(f, data, enrollment) }))
      .filter((r) => r.value);
    if (!rows.length) continue;

    if (y > doc.page.height - 130) {
      doc.addPage();
      y = 48;
    }
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10.5).text(SECTION_LABELS[sec].toUpperCase(), left, y);
    doc.moveTo(left, y + 16).lineTo(left + contentWidth, y + 16).lineWidth(0.6).strokeColor(LINE).stroke();
    y += 26;

    for (const r of rows) {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 48;
      }
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(r.label, left, y, { width: 168 });
      const h = doc.heightOfString(r.value, { width: contentWidth - 176 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(r.value, left + 176, y, { width: contentWidth - 176 });
      y += Math.max(18, h + 6);
    }
    y += 10;
  }

  // ── Rodapé de autenticação ──
  if (y > doc.page.height - 90) {
    doc.addPage();
    y = 48;
  }
  const footY = Math.max(y, doc.page.height - 78);
  doc.moveTo(left, footY).lineTo(left + contentWidth, footY).lineWidth(0.6).strokeColor(LINE).stroke();
  doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(
    `Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}. ` +
      `Código de autenticação: ${enrollment.authCode}. ` +
      `Valide a autenticidade em ${validateUrl}`,
    left,
    footY + 8,
    { width: contentWidth },
  );

  doc.end();
  return done;
}
