// ============================================================
// enrollment.service.ts — regra de negócio da matrícula.
// Efetiva a matrícula (valida tudo no servidor, gera nº e código de
// autenticação), lista, detalha e emite o comprovante em PDF.
// ============================================================
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { onlyDigits } from '../common/lib/validation';
import {
  EDUCATION_ENROLLMENT_FIELDS,
  DEFAULT_ENROLLMENT_FEE,
  normalizeEnrollmentData,
  validateEnrollment,
} from './enrollment-fields';
import { gerarComprovantePdf } from './comprovante-pdf';
import { PaymentProvider } from './payment.provider';

@Injectable()
export class EnrollmentService {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentProvider,
  ) {}

  /** Campos da matrícula da escola (por ora fixos p/ Educação). */
  private fieldsFor(_schoolId: string) {
    return EDUCATION_ENROLLMENT_FIELDS;
  }

  /**
   * Efetiva uma matrícula a partir dos dados completos.
   * O SERVIDOR é quem valida e decide — a IA (Fase 2) só chama este método.
   */
  async enroll(
    schoolId: string,
    data: Record<string, any>,
    opts: { leadId?: string; simulatePayment?: boolean } = {},
  ) {
    const fields = this.fieldsFor(schoolId);
    const normalized = normalizeEnrollmentData(fields, data) as Record<string, any>;
    const errors = validateEnrollment(fields, normalized);
    if (errors.length) {
      throw new BadRequestException({ message: 'Dados incompletos ou inválidos.', errors });
    }

    const number = await this.generateNumber(schoolId);
    const authCode = this.genAuthCode();

    const simulate = opts.simulatePayment ?? true;
    const textOrNull = (value: unknown) => (value == null || value === '' ? null : String(value));
    const payment = simulate
      ? await this.payments.charge({
          amount: DEFAULT_ENROLLMENT_FEE,
          method: textOrNull(normalized.paymentMethod),
          customerName: String(normalized.studentName),
          customerEmail: textOrNull(normalized.email),
        })
      : {
          status: 'PENDENTE' as const,
          reference: null,
        };
    const paymentStatus = payment.status;

    const enrollment = await this.prisma.enrollment.create({
      data: {
        schoolId,
        leadId: opts.leadId ?? null,
        number,
        status: paymentStatus === 'APROVADO' ? 'CONFIRMADA' : 'AGUARDANDO_PAGAMENTO',
        studentName: String(normalized.studentName),
        cpf: onlyDigits(String(normalized.cpf)),
        email: textOrNull(normalized.email),
        phone: textOrNull(normalized.phone),
        course: textOrNull(normalized.course),
        shift: textOrNull(normalized.shift),
        unit: textOrNull(normalized.unit),
        data: JSON.stringify(normalized),
        paymentStatus,
        paymentMethod: textOrNull(normalized.paymentMethod),
        paymentAmount: DEFAULT_ENROLLMENT_FEE,
        paymentRef: payment.reference,
        authCode,
        confirmedAt: paymentStatus === 'APROVADO' ? new Date() : null,
      },
    });
    return this.serialize(enrollment);
  }

  async findAll(schoolId: string) {
    const list = await this.prisma.enrollment.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((e) => this.serialize(e));
  }

  async findOne(id: string, schoolId: string) {
    const e = await this.prisma.enrollment.findFirst({ where: { id, schoolId } });
    if (!e) throw new NotFoundException('Matrícula não encontrada.');
    return this.serialize(e);
  }

  async verifyByAuthCode(authCode: string) {
    const code = authCode.trim().toUpperCase();
    const e = await this.prisma.enrollment.findFirst({
      where: { authCode: code },
      include: { school: true, documents: true },
    });

    if (!e) throw new NotFoundException('Comprovante não encontrado.');

    return {
      valid: true,
      enrollment: {
        ...this.serialize(e),
        schoolName: e.school.name,
        documentsCount: e.documents.length,
      },
    };
  }

  async attachDocument(
    id: string,
    schoolId: string,
    input: {
      type: string;
      fileName: string;
      mimeType?: string | null;
      size?: number | null;
      buffer: Buffer;
    },
  ) {
    const enrollment = await this.prisma.enrollment.findFirst({ where: { id, schoolId } });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');

    if (!input.fileName || !input.buffer?.length) {
      throw new BadRequestException('Arquivo vazio ou inválido.');
    }

    const doc = await this.prisma.enrollmentDocument.create({
      data: {
        enrollmentId: id,
        type: input.type.trim() || 'OUTRO',
        fileName: input.fileName,
        storagePath: 'db',
        content: input.buffer,
        mimeType: input.mimeType ?? null,
        size: input.size ?? input.buffer.length,
      },
    });

    await this.prisma.enrollmentDocument.update({
      where: { id: doc.id },
      data: { storagePath: `db:${doc.id}` },
    });

    return this.serializeDocument({ ...doc, storagePath: `db:${doc.id}` });
  }

  async documents(id: string, schoolId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({ where: { id, schoolId } });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');

    const docs = await this.prisma.enrollmentDocument.findMany({
      where: { enrollmentId: id },
      orderBy: { uploadedAt: 'desc' },
    });
    return docs.map((doc) => this.serializeDocument(doc));
  }

  async documentFile(id: string, documentId: string, schoolId: string) {
    const doc = await this.prisma.enrollmentDocument.findFirst({
      where: {
        id: documentId,
        enrollmentId: id,
        enrollment: { schoolId },
      },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    if (!doc.content) throw new NotFoundException('Arquivo não encontrado no armazenamento.');

    return {
      buffer: Buffer.from(doc.content),
      filename: doc.fileName,
      mimeType: doc.mimeType || 'application/octet-stream',
    };
  }

  /** Gera o PDF do comprovante. Retorna o Buffer + nome do arquivo. */
  async comprovante(id: string, schoolId: string): Promise<{ buffer: Buffer; filename: string }> {
    const e = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
      include: { school: true },
    });
    if (!e) throw new NotFoundException('Matrícula não encontrada.');
    const buffer = await gerarComprovantePdf(e);
    return { buffer, filename: `comprovante-matricula-${e.number}.pdf` };
  }

  // ── helpers ──

  /** Número sequencial por escola/ano: "2026-0001". */
  private async generateNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.enrollment.count({
        where: { schoolId, number: { startsWith: `${year}-` } },
      });
      const candidate = `${year}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.prisma.enrollment.findFirst({ where: { schoolId, number: candidate } });
      if (!exists) return candidate;
    }
    // fallback improvável (corrida) — garante unicidade
    return `${year}-${Date.now().toString().slice(-6)}`;
  }

  private genAuthCode(): string {
    return randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  }

  private serialize(e: any) {
    let extra: Record<string, unknown> = {};
    try {
      extra = JSON.parse(e.data || '{}');
    } catch {
      /* noop */
    }
    return {
      id: e.id,
      number: e.number,
      status: e.status,
      studentName: e.studentName,
      cpf: e.cpf,
      email: e.email,
      phone: e.phone,
      course: e.course,
      shift: e.shift,
      unit: e.unit,
      data: extra,
      paymentStatus: e.paymentStatus,
      paymentMethod: e.paymentMethod,
      paymentAmount: e.paymentAmount != null ? Number(e.paymentAmount) : null,
      paymentRef: e.paymentRef,
      authCode: e.authCode,
      createdAt: e.createdAt,
      confirmedAt: e.confirmedAt,
    };
  }

  private serializeDocument(doc: any) {
    return {
      id: doc.id,
      enrollmentId: doc.enrollmentId,
      type: doc.type,
      fileName: doc.fileName,
      storagePath: doc.storagePath,
      mimeType: doc.mimeType,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
    };
  }
}
