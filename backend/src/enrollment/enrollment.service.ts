// ============================================================
// enrollment.service.ts — regra de negócio da matrícula.
// Efetiva a matrícula (valida tudo no servidor, gera nº e código de
// autenticação), lista, detalha e emite o comprovante em PDF.
// ============================================================
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import {
  RuntimeSchoolConfig,
  SchoolConfigService,
} from '../school-config/school-config.service';

@Injectable()
export class EnrollmentService {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentProvider,
    private schoolConfig: SchoolConfigService,
  ) {}

  /** Campos da matrícula da escola (por ora fixos p/ Educação). */
  async fieldsFor(schoolId: string) {
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    return this.fieldsForConfig(runtimeConfig);
  }

  async fieldSchema(schoolId: string) {
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    const documentsFor = (audience: string) =>
      runtimeConfig.documents
        .filter((document) => document.audience === audience)
        .map(
          (document) =>
            `${document.documentType}${document.required ? '' : ' (opcional)'} - ${document.instructions}`,
        );
    return {
      fields: this.fieldsForConfig(runtimeConfig),
      documentRequirements: {
        brasil: documentsFor('brasileiro'),
        internacional: documentsFor('estrangeiro'),
        menorIdade: documentsFor('menor_idade'),
      },
    };
  }

  /**
   * Efetiva uma matrícula a partir dos dados completos.
   * O SERVIDOR é quem valida e decide — a IA (Fase 2) só chama este método.
   */
  async enroll(
    schoolId: string,
    data: Record<string, any>,
    opts: {
      leadId?: string;
      simulatePayment?: boolean;
      assigneeId?: string;
    } = {},
  ) {
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    const fields = this.fieldsForConfig(runtimeConfig);
    const normalized = normalizeEnrollmentData(fields, data) as Record<
      string,
      any
    >;
    const errors = validateEnrollment(fields, normalized);
    if (errors.length) {
      throw new BadRequestException({
        message: 'Dados incompletos ou inválidos.',
        errors,
      });
    }

    const number = await this.generateNumber(schoolId);
    const authCode = this.genAuthCode();

    const simulate = opts.simulatePayment ?? true;
    const textOrNull = (value: unknown) =>
      value == null || value === '' ? null : String(value);
    const courseOffer = runtimeConfig.courses.find(
      (course) => course.name === normalized.course,
    );
    const enrollmentFee = courseOffer?.enrollmentFee ?? DEFAULT_ENROLLMENT_FEE;
    const payment = simulate
      ? await this.payments.charge({
          amount: enrollmentFee,
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
        status:
          paymentStatus === 'APROVADO'
            ? 'AGUARDANDO_CONFERENCIA'
            : 'AGUARDANDO_PAGAMENTO',
        studentName: String(normalized.studentName),
        cpf: normalized.cpf ? onlyDigits(String(normalized.cpf)) : null,
        documentType: textOrNull(normalized.documentType),
        documentNumber: textOrNull(normalized.documentNumber),
        preferredLanguage: textOrNull(normalized.preferredLanguage),
        countryOfResidence: textOrNull(normalized.countryOfResidence),
        email: textOrNull(normalized.email),
        phone: textOrNull(normalized.phone),
        course: textOrNull(normalized.course),
        shift: textOrNull(normalized.shift),
        unit: textOrNull(normalized.unit),
        data: JSON.stringify(normalized),
        paymentStatus,
        paymentMethod: textOrNull(normalized.paymentMethod),
        paymentAmount: enrollmentFee,
        paymentRef: payment.reference,
        authCode,
        confirmedAt: null,
        assigneeId: opts.assigneeId ?? null,
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
    const e = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
    if (!e) throw new NotFoundException('Matrícula não encontrada.');
    return this.serialize(e);
  }

  async updateEnrollment(
    id: string,
    schoolId: string,
    data: Record<string, any>,
  ) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');
    if (enrollment.status === 'CANCELADA') {
      throw new BadRequestException(
        'Reabra a matrícula antes de corrigir os dados.',
      );
    }
    const current = this.safeJson(enrollment.data);
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    const fields = this.fieldsForConfig(runtimeConfig);
    const normalized = normalizeEnrollmentData(fields, {
      ...current,
      ...data,
    }) as Record<string, any>;
    const errors = validateEnrollment(fields, normalized);
    if (errors.length) {
      throw new BadRequestException({
        message: 'Dados incompletos ou inválidos.',
        errors,
      });
    }
    const textOrNull = (value: unknown) =>
      value == null || value === '' ? null : String(value);
    const updated = await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        studentName: String(normalized.studentName),
        cpf: normalized.cpf ? onlyDigits(String(normalized.cpf)) : null,
        documentType: textOrNull(normalized.documentType),
        documentNumber: textOrNull(normalized.documentNumber),
        preferredLanguage: textOrNull(normalized.preferredLanguage),
        countryOfResidence: textOrNull(normalized.countryOfResidence),
        email: textOrNull(normalized.email),
        phone: textOrNull(normalized.phone),
        course: textOrNull(normalized.course),
        shift: textOrNull(normalized.shift),
        unit: textOrNull(normalized.unit),
        data: JSON.stringify(normalized),
        status:
          enrollment.status === 'CORRECAO_SOLICITADA'
            ? 'AGUARDANDO_CONFERENCIA'
            : enrollment.status,
        reviewNote: null,
      },
    });
    return this.serialize(updated);
  }

  async reviewEnrollment(
    id: string,
    schoolId: string,
    userId: string,
    input: { decision?: string; note?: string },
  ) {
    const decision = input.decision?.toUpperCase();
    if (decision === 'CONFIRM') {
      return this.confirmEnrollment(id, schoolId, userId, input.note);
    }
    if (!['RETURN', 'REJECT'].includes(decision ?? '')) {
      throw new BadRequestException('Decisão de conferência inválida.');
    }
    const note = input.note?.trim();
    if (!note) {
      throw new BadRequestException(
        'Informe o motivo da devolução ou rejeição.',
      );
    }
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');
    if (
      !['AGUARDANDO_CONFERENCIA', 'CORRECAO_SOLICITADA'].includes(
        enrollment.status,
      )
    ) {
      throw new BadRequestException(
        'Esta matrícula não está disponível para conferência.',
      );
    }
    const updated = await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: decision === 'RETURN' ? 'CORRECAO_SOLICITADA' : 'REJEITADA',
        reviewNote: note,
        reviewedAt: new Date(),
      },
    });
    return this.serialize(updated);
  }

  async cancelEnrollment(id: string, schoolId: string, note?: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'CANCELADA',
          canceledAt: now,
          reviewNote: note?.trim() || enrollment.reviewNote,
        },
      });
      await tx.postSaleState.updateMany({
        where: { schoolId, studentKey: id },
        data: {
          lifecycleStatus: 'ENCERRADO',
          lifecycleReason: note?.trim() || 'Matrícula cancelada',
          nextActionAt: null,
        },
      });
      await tx.postSaleTask.updateMany({
        where: { schoolId, enrollmentId: id, status: 'ABERTA' },
        data: { status: 'CANCELADA', canceledAt: now },
      });
      return result;
    });
    return this.serialize(updated);
  }

  async reopenEnrollment(id: string, schoolId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');
    if (!['CANCELADA', 'REJEITADA'].includes(enrollment.status)) {
      throw new BadRequestException(
        'Somente matrículas canceladas ou rejeitadas podem ser reabertas.',
      );
    }
    const updated = await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: 'AGUARDANDO_CONFERENCIA',
        canceledAt: null,
        reviewNote: null,
      },
    });
    return this.serialize(updated);
  }

  async updatePaymentStatus(
    id: string,
    schoolId: string,
    input: { status?: string; note?: string },
  ) {
    const status = input.status?.toUpperCase();
    if (!['PENDENTE', 'APROVADO', 'RECUSADO'].includes(status ?? '')) {
      throw new BadRequestException('Status de pagamento inválido.');
    }
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');
    const updated = await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        paymentStatus: status,
        status:
          status === 'APROVADO'
            ? 'AGUARDANDO_CONFERENCIA'
            : 'AGUARDANDO_PAGAMENTO',
        reviewNote: input.note?.trim() || enrollment.reviewNote,
      },
    });
    return this.serialize(updated);
  }

  async confirmEnrollment(
    id: string,
    schoolId: string,
    userId: string,
    _note?: string,
  ) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
    if (!enrollment) {
      throw new NotFoundException('Matrícula não encontrada.');
    }
    if (enrollment.status !== 'AGUARDANDO_CONFERENCIA') {
      throw new BadRequestException(
        'Esta matrícula não está aguardando conferência.',
      );
    }

    const confirmedAt = new Date();
    const ownerId = enrollment.assigneeId ?? userId;
    const firstDueAt = this.addDays(confirmedAt, 1);
    const confirmed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'CONFIRMADA',
          confirmedAt,
          humanConfirmedAt: confirmedAt,
          humanConfirmedById: userId,
          assigneeId: ownerId,
          reviewNote: _note?.trim() || null,
          reviewedAt: confirmedAt,
          canceledAt: null,
        },
      });

      await tx.postSaleState.upsert({
        where: {
          schoolId_studentKey: { schoolId, studentKey: enrollment.id },
        },
        create: {
          schoolId,
          studentKey: enrollment.id,
          enrollmentId: enrollment.id,
          assigneeId: ownerId,
          lifecycleStatus: 'ATIVO',
          nextAction: 'Conferir documentos e iniciar o onboarding',
          nextActionAt: firstDueAt,
          lastHumanActionAt: confirmedAt,
          ownerTeam: 'Secretaria',
        },
        update: {
          assigneeId: ownerId,
          lifecycleStatus: 'ATIVO',
          lifecycleReason: null,
          nextAction: 'Conferir documentos e iniciar o onboarding',
          nextActionAt: firstDueAt,
          lastHumanActionAt: confirmedAt,
          ownerTeam: 'Secretaria',
        },
      });

      const existingHandoffTasks = await tx.postSaleTask.count({
        where: {
          schoolId,
          enrollmentId: enrollment.id,
          status: 'ABERTA',
          origin: 'matricula',
          automation: { startsWith: 'Plano inicial da matrícula' },
        },
      });
      if (!existingHandoffTasks) {
        const steps = [
          {
            title: 'Conferir documentos da matrícula',
            role: 'secretaria',
            ownerTeam: 'Secretaria',
            days: 1,
          },
          {
            title: 'Validar contrato e situação de pagamento',
            role: 'financeiro',
            ownerTeam: 'Financeiro',
            days: 1,
          },
          {
            title: 'Confirmar primeiro acesso do aluno',
            role: 'sucesso_do_aluno',
            ownerTeam: 'Sucesso do aluno',
            days: 3,
          },
          {
            title: 'Fazer contato de adaptação',
            role: 'sucesso_do_aluno',
            ownerTeam: 'Sucesso do aluno',
            days: 7,
          },
        ];
        await tx.postSaleTask.createMany({
          data: steps.map((step, index) => ({
            schoolId,
            studentKey: enrollment.id,
            enrollmentId: enrollment.id,
            studentName: enrollment.studentName,
            title: step.title,
            ownerTeam: step.ownerTeam,
            assignee: '',
            assigneeId: ownerId,
            role: step.role,
            priority: index < 2 ? 'Alta' : 'Média',
            status: 'ABERTA',
            column: 'a_fazer',
            origin: 'matricula',
            createdBy: 'automacao',
            createdById: userId,
            automation: `Plano inicial da matrícula · etapa ${index + 1}`,
            relatedEntity: JSON.stringify({
              rule: 'handoff_matricula',
              step: index + 1,
            }),
            autoResolve: false,
            dueAt: this.addDays(confirmedAt, step.days),
          })),
        });
      }

      await tx.postSaleEvent.create({
        data: {
          schoolId,
          studentKey: enrollment.id,
          enrollmentId: enrollment.id,
          studentName: enrollment.studentName,
          type: 'HANDOFF_MATRICULA',
          title: 'Matrícula assumida pela equipe humana',
          description:
            _note?.trim() ||
            'Responsável e plano inicial de acompanhamento definidos.',
          metadata: JSON.stringify({ ownerId, confirmedById: userId }),
        },
      });
      return updated;
    });
    return this.serialize(confirmed);
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
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
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
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada.');

    const docs = await this.prisma.enrollmentDocument.findMany({
      where: { enrollmentId: id },
      orderBy: { uploadedAt: 'desc' },
    });
    return docs.map((doc) => this.serializeDocument(doc));
  }

  async reviewDocument(
    id: string,
    documentId: string,
    schoolId: string,
    userId: string,
    input: { status?: string; note?: string },
  ) {
    const status = input.status?.toUpperCase();
    if (!['RECEBIDO', 'APROVADO', 'RECUSADO'].includes(status ?? '')) {
      throw new BadRequestException('Status de documento inválido.');
    }
    const note = input.note?.trim() || '';
    if (status === 'RECUSADO' && !note) {
      throw new BadRequestException('Informe o motivo da recusa do documento.');
    }
    const doc = await this.prisma.enrollmentDocument.findFirst({
      where: {
        id: documentId,
        enrollmentId: id,
        enrollment: { schoolId },
      },
      include: { enrollment: { select: { studentName: true } } },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    const reviewedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.enrollmentDocument.update({
        where: { id: doc.id },
        data: {
          status,
          reviewNote: note,
          reviewedAt,
          reviewedById: userId,
        },
      });
      const [approved, approvedPackage] = await Promise.all([
        tx.enrollmentDocument.count({
          where: { enrollmentId: id, status: 'APROVADO' },
        }),
        tx.enrollmentDocument.count({
          where: {
            enrollmentId: id,
            type: 'PACOTE_COMPLETO',
            status: 'APROVADO',
          },
        }),
      ]);
      const hasMinimumDocuments = approvedPackage > 0 || approved >= 3;
      await tx.postSaleState.updateMany({
        where: { schoolId, studentKey: id },
        data: {
          documentStatus: hasMinimumDocuments
            ? 'Recebida'
            : 'Documentação pendente',
          nextAction: hasMinimumDocuments
            ? 'Validar contrato e pagamento'
            : 'Resolver documentos pendentes',
          nextActionAt: this.addDays(
            reviewedAt,
            hasMinimumDocuments ? 2 : 1,
          ),
          lastHumanActionAt: reviewedAt,
        },
      });
      await tx.postSaleEvent.create({
        data: {
          schoolId,
          studentKey: id,
          enrollmentId: id,
          studentName: doc.enrollment.studentName,
          type: 'DOCUMENTO_REVISADO',
          title: `${doc.type}: ${status}`,
          description: note || `Documento marcado como ${status}.`,
          metadata: JSON.stringify({
            documentId,
            status,
            reviewedById: userId,
          }),
        },
      });
      return result;
    });
    return this.serializeDocument(updated);
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
    if (!doc.content)
      throw new NotFoundException('Arquivo não encontrado no armazenamento.');

    return {
      buffer: Buffer.from(doc.content),
      filename: doc.fileName,
      mimeType: doc.mimeType || 'application/octet-stream',
    };
  }

  /** Gera o PDF do comprovante. Retorna o Buffer + nome do arquivo. */
  async comprovante(
    id: string,
    schoolId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const e = await this.prisma.enrollment.findFirst({
      where: { id, schoolId },
      include: { school: true },
    });
    if (!e) throw new NotFoundException('Matrícula não encontrada.');
    const buffer = await gerarComprovantePdf(e);
    return { buffer, filename: `comprovante-matricula-${e.number}.pdf` };
  }

  // ── helpers ──

  private fieldsForConfig(runtimeConfig: RuntimeSchoolConfig) {
    const courseOptions = runtimeConfig.courses
      .map((course) => course.name)
      .filter(Boolean);
    const shiftOptions = [
      ...new Set(runtimeConfig.courses.flatMap((course) => course.shifts)),
    ].filter(Boolean);
    const modalityOptions = [
      ...new Set(
        runtimeConfig.courses.map((course) => course.modality).filter(Boolean),
      ),
    ];

    return EDUCATION_ENROLLMENT_FIELDS.map((field) => {
      if (field.name === 'course' && courseOptions.length)
        return { ...field, options: courseOptions };
      if (field.name === 'shift' && shiftOptions.length)
        return { ...field, options: shiftOptions };
      if (field.name === 'modalidade' && modalityOptions.length)
        return { ...field, options: modalityOptions };
      if (field.name === 'unit')
        return { ...field, required: false, options: ['Sede principal'] };
      return field;
    });
  }

  /** Número sequencial por escola/ano: "2026-0001". */
  private async generateNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.enrollment.count({
        where: { schoolId, number: { startsWith: `${year}-` } },
      });
      const candidate = `${year}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.prisma.enrollment.findFirst({
        where: { schoolId, number: candidate },
      });
      if (!exists) return candidate;
    }
    // fallback improvável (corrida) — garante unicidade
    return `${year}-${Date.now().toString().slice(-6)}`;
  }

  private genAuthCode(): string {
    return randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  }

  private safeJson(value: string | null | undefined): Record<string, unknown> {
    try {
      return JSON.parse(value || '{}');
    } catch {
      return {};
    }
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
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
      documentType: e.documentType,
      documentNumber: e.documentNumber,
      preferredLanguage: e.preferredLanguage,
      countryOfResidence: e.countryOfResidence,
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
      humanConfirmedAt: e.humanConfirmedAt,
      humanConfirmedById: e.humanConfirmedById,
      assigneeId: e.assigneeId,
      reviewNote: e.reviewNote,
      reviewedAt: e.reviewedAt,
      canceledAt: e.canceledAt,
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
      status: doc.status,
      reviewNote: doc.reviewNote,
      reviewedAt: doc.reviewedAt,
      reviewedById: doc.reviewedById,
    };
  }
}
