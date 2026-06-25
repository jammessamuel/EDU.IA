import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_COMMERCIAL_CONDITION,
  DEFAULT_COURSES,
  DEFAULT_DOCUMENT_REQUIREMENTS,
  DEFAULT_PROFILE,
  DEFAULT_TEMPLATES,
  TEMPLATE_VARIABLE_SAMPLE,
} from './defaults';

type JsonRecord = Record<string, unknown>;

export interface SchoolProfileConfig {
  id: string;
  schoolId: string;
  businessHours: JsonRecord;
  address: string;
  city: string;
  state: string;
  mapLink: string;
  referencePoints: string;
  transportInfo: string;
  supportChannels: JsonRecord;
  updatedAt: Date;
}

export interface CommunicationTemplateConfig {
  id: string;
  schoolId: string;
  key: string;
  title: string;
  stage: string;
  category: string;
  dayOffset: number | null;
  whatsappText: string;
  defaultWhatsappText: string;
  active: boolean;
  order: number;
  updatedAt: Date;
}

export interface CourseOfferConfig {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  duration: string;
  modality: string;
  shifts: string[];
  enrollmentFee: number | null;
  monthlyFee: number | null;
  cashDiscountPercent: number | null;
  active: boolean;
  updatedAt: Date;
}

export interface DocumentRequirementConfig {
  id: string;
  schoolId: string;
  audience: string;
  documentType: string;
  instructions: string;
  required: boolean;
  active: boolean;
  order: number;
  updatedAt: Date;
}

export interface CommercialConditionConfig {
  id: string;
  schoolId: string;
  cashDiscountPercent: number | null;
  campaignActive: boolean;
  campaignValidUntil: Date | null;
  promotionText: string;
  updatedAt: Date;
}

export interface RuntimeSchoolConfig {
  profile: SchoolProfileConfig;
  templates: CommunicationTemplateConfig[];
  courses: CourseOfferConfig[];
  documents: DocumentRequirementConfig[];
  commercial: CommercialConditionConfig;
}

@Injectable()
export class SchoolConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(schoolId: string): Promise<RuntimeSchoolConfig> {
    await this.ensureDefaults(schoolId);
    const [profile, templates, courses, documents, commercial] = await Promise.all([
      this.prisma.schoolProfile.findUnique({ where: { schoolId } }),
      this.prisma.communicationTemplate.findMany({
        where: { schoolId },
        orderBy: [{ order: 'asc' }, { title: 'asc' }],
      }),
      this.prisma.courseOffer.findMany({
        where: { schoolId },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.documentRequirement.findMany({
        where: { schoolId },
        orderBy: [{ audience: 'asc' }, { order: 'asc' }, { documentType: 'asc' }],
      }),
      this.prisma.commercialCondition.findUnique({ where: { schoolId } }),
    ]);

    if (!profile || !commercial) {
      throw new NotFoundException('Configuração da escola não encontrada.');
    }

    return {
      profile: this.serializeProfile(profile),
      templates: templates.map((template) => this.serializeTemplate(template)),
      courses: courses.map((course) => this.serializeCourse(course)),
      documents: documents.map((document) => this.serializeDocument(document)),
      commercial: this.serializeCommercial(commercial),
    };
  }

  async getRuntimeConfig(schoolId: string): Promise<RuntimeSchoolConfig> {
    const config = await this.getConfig(schoolId);
    return {
      ...config,
      templates: config.templates.filter((template) => template.active),
      courses: config.courses.filter((course) => course.active),
      documents: config.documents.filter((document) => document.active),
    };
  }

  async updateProfile(
    schoolId: string,
    input: Partial<{
      businessHours: JsonRecord;
      address: string;
      city: string;
      state: string;
      mapLink: string;
      referencePoints: string;
      transportInfo: string;
      supportChannels: JsonRecord;
    }>,
  ) {
    await this.ensureDefaults(schoolId);
    const existing = await this.prisma.schoolProfile.findUnique({ where: { schoolId } });
    if (!existing) throw new NotFoundException('Perfil da escola não encontrado.');
    const current = this.serializeProfile(existing);
    const data = {
      businessHours: this.stringifyJson(input.businessHours ?? current.businessHours, DEFAULT_PROFILE.businessHours),
      supportChannels: this.stringifyJson(input.supportChannels ?? current.supportChannels, DEFAULT_PROFILE.supportChannels),
      address: input.address === undefined ? current.address : this.cleanString(input.address),
      city: input.city === undefined ? current.city : this.cleanString(input.city),
      state: input.state === undefined ? current.state : this.cleanString(input.state).toUpperCase(),
      mapLink: input.mapLink === undefined ? current.mapLink : this.cleanString(input.mapLink),
      referencePoints:
        input.referencePoints === undefined ? current.referencePoints : this.cleanString(input.referencePoints),
      transportInfo: input.transportInfo === undefined ? current.transportInfo : this.cleanString(input.transportInfo),
    };

    await this.prisma.schoolProfile.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
    return this.getConfig(schoolId);
  }

  async updateCommercial(
    schoolId: string,
    input: Partial<{
      cashDiscountPercent: number | string | null;
      campaignActive: boolean;
      campaignValidUntil: string | null;
      promotionText: string;
    }>,
  ) {
    await this.ensureDefaults(schoolId);
    const existing = await this.prisma.commercialCondition.findUnique({ where: { schoolId } });
    if (!existing) throw new NotFoundException('Condição comercial não encontrada.');
    const current = this.serializeCommercial(existing);
    const data = {
      cashDiscountPercent:
        input.cashDiscountPercent === undefined
          ? current.cashDiscountPercent
          : this.toDecimalNumber(input.cashDiscountPercent),
      campaignActive:
        input.campaignActive === undefined ? current.campaignActive : Boolean(input.campaignActive),
      campaignValidUntil:
        input.campaignValidUntil === undefined
          ? current.campaignValidUntil
          : input.campaignValidUntil
            ? new Date(input.campaignValidUntil)
            : null,
      promotionText: input.promotionText === undefined ? current.promotionText : this.cleanString(input.promotionText),
    };

    await this.prisma.commercialCondition.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
    return this.getConfig(schoolId);
  }

  async updateTemplate(
    schoolId: string,
    key: string,
    input: Partial<{
      title: string;
      stage: string;
      whatsappText: string;
      active: boolean;
    }>,
  ) {
    await this.ensureDefaults(schoolId);
    const existing = await this.prisma.communicationTemplate.findUnique({
      where: { schoolId_key: { schoolId, key } },
    });
    if (!existing) throw new NotFoundException('Template não encontrado.');

    await this.prisma.communicationTemplate.update({
      where: { schoolId_key: { schoolId, key } },
      data: {
        title: input.title?.trim() || existing.title,
        stage: input.stage?.trim() || existing.stage,
        whatsappText: input.whatsappText?.trim() || existing.whatsappText,
        active: typeof input.active === 'boolean' ? input.active : existing.active,
      },
    });
    return this.getConfig(schoolId);
  }

  async restoreTemplate(schoolId: string, key: string) {
    await this.ensureDefaults(schoolId);
    const existing = await this.prisma.communicationTemplate.findUnique({
      where: { schoolId_key: { schoolId, key } },
    });
    if (!existing) throw new NotFoundException('Template não encontrado.');

    await this.prisma.communicationTemplate.update({
      where: { schoolId_key: { schoolId, key } },
      data: {
        whatsappText: existing.defaultWhatsappText,
        active: true,
      },
    });
    return this.getConfig(schoolId);
  }

  async previewTemplate(schoolId: string, key: string, variables: JsonRecord = {}) {
    await this.ensureDefaults(schoolId);
    const template = await this.prisma.communicationTemplate.findUnique({
      where: { schoolId_key: { schoolId, key } },
    });
    if (!template) throw new NotFoundException('Template não encontrado.');

    const config = await this.getConfig(schoolId);
    const vars = this.defaultVariables(config, variables);
    return {
      key,
      title: template.title,
      rendered: this.renderTemplate(template.whatsappText, vars),
      variables: vars,
    };
  }

  async createCourse(schoolId: string, input: Record<string, unknown>) {
    await this.ensureDefaults(schoolId);
    const name = this.cleanString(input.name);
    if (!name) throw new BadRequestException('Informe o nome do curso.');

    await this.prisma.courseOffer.create({
      data: {
        schoolId,
        ...this.courseData(input),
        name,
      },
    });
    return this.getConfig(schoolId);
  }

  async updateCourse(schoolId: string, id: string, input: Record<string, unknown>) {
    await this.ensureDefaults(schoolId);
    const course = await this.prisma.courseOffer.findFirst({ where: { id, schoolId } });
    if (!course) throw new NotFoundException('Curso não encontrado.');

    await this.prisma.courseOffer.update({
      where: { id },
      data: {
        ...this.courseData(input),
        name: this.cleanString(input.name) || course.name,
      },
    });
    return this.getConfig(schoolId);
  }

  async createDocument(schoolId: string, input: Record<string, unknown>) {
    await this.ensureDefaults(schoolId);
    const documentType = this.cleanString(input.documentType);
    if (!documentType) throw new BadRequestException('Informe o documento exigido.');

    await this.prisma.documentRequirement.create({
      data: {
        schoolId,
        ...this.documentData(input),
        documentType,
      },
    });
    return this.getConfig(schoolId);
  }

  async updateDocument(schoolId: string, id: string, input: Record<string, unknown>) {
    await this.ensureDefaults(schoolId);
    const document = await this.prisma.documentRequirement.findFirst({ where: { id, schoolId } });
    if (!document) throw new NotFoundException('Documento não encontrado.');

    await this.prisma.documentRequirement.update({
      where: { id },
      data: {
        ...this.documentData(input),
        documentType: this.cleanString(input.documentType) || document.documentType,
      },
    });
    return this.getConfig(schoolId);
  }

  async ensureDefaults(schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('Escola não encontrada.');

    await this.prisma.schoolProfile.upsert({
      where: { schoolId },
      create: {
        schoolId,
        businessHours: JSON.stringify(DEFAULT_PROFILE.businessHours),
        address: DEFAULT_PROFILE.address,
        city: DEFAULT_PROFILE.city,
        state: DEFAULT_PROFILE.state,
        mapLink: DEFAULT_PROFILE.mapLink,
        referencePoints: DEFAULT_PROFILE.referencePoints,
        transportInfo: DEFAULT_PROFILE.transportInfo,
        supportChannels: JSON.stringify(DEFAULT_PROFILE.supportChannels),
      },
      update: {},
    });

    await this.prisma.commercialCondition.upsert({
      where: { schoolId },
      create: {
        schoolId,
        cashDiscountPercent: DEFAULT_COMMERCIAL_CONDITION.cashDiscountPercent,
        campaignActive: DEFAULT_COMMERCIAL_CONDITION.campaignActive,
        campaignValidUntil: null,
        promotionText: DEFAULT_COMMERCIAL_CONDITION.promotionText,
      },
      update: {},
    });

    await Promise.all(
      DEFAULT_TEMPLATES.map((template) =>
        this.prisma.communicationTemplate.upsert({
          where: { schoolId_key: { schoolId, key: template.key } },
          create: {
            schoolId,
            key: template.key,
            title: template.title,
            stage: template.stage,
            category: template.category,
            dayOffset: template.dayOffset,
            whatsappText: template.whatsappText,
            defaultWhatsappText: template.whatsappText,
            active: true,
            order: template.order,
          },
          update: {
            defaultWhatsappText: template.whatsappText,
            category: template.category,
            dayOffset: template.dayOffset,
            order: template.order,
          },
        }),
      ),
    );

    const courseCount = await this.prisma.courseOffer.count({ where: { schoolId } });
    if (courseCount === 0) {
      await this.prisma.courseOffer.createMany({
        data: DEFAULT_COURSES.map((course) => ({
          schoolId,
          name: course.name,
          description: course.description,
          duration: course.duration,
          modality: course.modality,
          shifts: JSON.stringify(course.shifts),
          enrollmentFee: course.enrollmentFee,
          monthlyFee: course.monthlyFee,
          cashDiscountPercent: course.cashDiscountPercent,
          active: course.active,
        })),
      });
    }

    const documentCount = await this.prisma.documentRequirement.count({ where: { schoolId } });
    if (documentCount === 0) {
      await this.prisma.documentRequirement.createMany({
        data: DEFAULT_DOCUMENT_REQUIREMENTS.map((document) => ({
          schoolId,
          audience: document.audience,
          documentType: document.documentType,
          instructions: document.instructions,
          required: document.required,
          active: document.active,
          order: document.order,
        })),
      });
    }
  }

  renderTemplate(text: string, variables: JsonRecord): string {
    return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
      const value = variables[key];
      return value === null || value === undefined || value === '' ? `{${key}}` : String(value);
    });
  }

  defaultVariables(config: RuntimeSchoolConfig, input: JsonRecord = {}): JsonRecord {
    const firstCourse = config.courses[0];
    const discount = config.commercial.cashDiscountPercent || firstCourse?.cashDiscountPercent || 0;
    const enrollmentFee = firstCourse?.enrollmentFee ?? 150;
    return {
      ...TEMPLATE_VARIABLE_SAMPLE,
      escola: input.escola ?? 'Faculdade Demo EDU.IA',
      curso: input.curso ?? firstCourse?.name ?? TEMPLATE_VARIABLE_SAMPLE.curso,
      valor: input.valor ?? this.formatCurrency(enrollmentFee),
      desconto: input.desconto ?? String(discount),
      horario: input.horario ?? this.formatBusinessHours(config.profile.businessHours),
      endereco:
        input.endereco ??
        [config.profile.address, config.profile.city, config.profile.state].filter(Boolean).join(', '),
      ...input,
    };
  }

  templateByKey(config: RuntimeSchoolConfig, key: string) {
    return config.templates.find((template) => template.key === key && template.active) ?? null;
  }

  institutionPrompt(config: RuntimeSchoolConfig): string {
    const courses = config.courses
      .map((course) => {
        const shifts = course.shifts.length ? ` Turnos: ${course.shifts.join(', ')}.` : '';
        const fees = [
          course.enrollmentFee ? `matrícula ${this.formatCurrency(course.enrollmentFee)}` : '',
          course.monthlyFee ? `mensalidade ${this.formatCurrency(course.monthlyFee)}` : '',
          course.cashDiscountPercent ? `desconto à vista ${course.cashDiscountPercent}%` : '',
        ].filter(Boolean).join('; ');
        return `- ${course.name}: ${course.description} Duração: ${course.duration}. Modalidade: ${course.modality}.${shifts}${fees ? ` Valores: ${fees}.` : ''}`;
      })
      .join('\n');
    const documents = this.documentSummary(config);

    return `INFORMAÇÕES CONFIGURÁVEIS DA ESCOLA:
- Horários: ${this.formatBusinessHours(config.profile.businessHours)}
- Endereço: ${[config.profile.address, config.profile.city, config.profile.state].filter(Boolean).join(', ')}
- Mapa: ${config.profile.mapLink || 'não informado'}
- Referências: ${config.profile.referencePoints || 'não informado'}
- Condução/transporte: ${config.profile.transportInfo || 'não informado'}
- Canais: ${Object.entries(config.profile.supportChannels).map(([key, value]) => `${key}: ${value}`).join(' | ')}
- Condição comercial: ${config.commercial.campaignActive ? config.commercial.promotionText : 'sem campanha ativa'} Desconto à vista configurado: ${config.commercial.cashDiscountPercent || 0}%.

Cursos ativos:
${courses || '- Nenhum curso ativo configurado.'}

Documentos exigidos:
${documents}`;
  }

  documentSummary(config: RuntimeSchoolConfig): string {
    const byAudience = new Map<string, RuntimeSchoolConfig['documents']>();
    for (const document of config.documents) {
      byAudience.set(document.audience, [...(byAudience.get(document.audience) ?? []), document]);
    }
    return [...byAudience.entries()]
      .map(([audience, docs]) => {
        const items = docs
          .map((doc) => `${doc.required ? 'obrigatório' : 'opcional'}: ${doc.documentType} (${doc.instructions})`)
          .join('; ');
        return `- ${audience}: ${items}`;
      })
      .join('\n');
  }

  formatBusinessHours(value: JsonRecord) {
    return [
      value.weekdays,
      value.saturday,
      value.sundayHolidays,
      value.secretaria ? `Secretaria: ${value.secretaria}` : '',
      value.financeiro ? `Financeiro: ${value.financeiro}` : '',
      value.online ? `Online: ${value.online}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  private serializeProfile(profile: any) {
    return {
      id: profile.id,
      schoolId: profile.schoolId,
      businessHours: this.parseJson(profile.businessHours, DEFAULT_PROFILE.businessHours),
      address: profile.address,
      city: profile.city,
      state: profile.state,
      mapLink: profile.mapLink,
      referencePoints: profile.referencePoints,
      transportInfo: profile.transportInfo,
      supportChannels: this.parseJson(profile.supportChannels, DEFAULT_PROFILE.supportChannels),
      updatedAt: profile.updatedAt,
    };
  }

  private serializeTemplate(template: any) {
    return {
      id: template.id,
      schoolId: template.schoolId,
      key: template.key,
      title: template.title,
      stage: template.stage,
      category: template.category,
      dayOffset: template.dayOffset,
      whatsappText: template.whatsappText,
      defaultWhatsappText: template.defaultWhatsappText,
      active: template.active,
      order: template.order,
      updatedAt: template.updatedAt,
    };
  }

  private serializeCourse(course: any) {
    return {
      id: course.id,
      schoolId: course.schoolId,
      name: course.name,
      description: course.description,
      duration: course.duration,
      modality: course.modality,
      shifts: this.parseJson<string[]>(course.shifts, []),
      enrollmentFee: this.decimalToNumber(course.enrollmentFee),
      monthlyFee: this.decimalToNumber(course.monthlyFee),
      cashDiscountPercent: this.decimalToNumber(course.cashDiscountPercent),
      active: course.active,
      updatedAt: course.updatedAt,
    };
  }

  private serializeDocument(document: any) {
    return {
      id: document.id,
      schoolId: document.schoolId,
      audience: document.audience,
      documentType: document.documentType,
      instructions: document.instructions,
      required: document.required,
      active: document.active,
      order: document.order,
      updatedAt: document.updatedAt,
    };
  }

  private serializeCommercial(commercial: any) {
    return {
      id: commercial.id,
      schoolId: commercial.schoolId,
      cashDiscountPercent: this.decimalToNumber(commercial.cashDiscountPercent),
      campaignActive: commercial.campaignActive,
      campaignValidUntil: commercial.campaignValidUntil,
      promotionText: commercial.promotionText,
      updatedAt: commercial.updatedAt,
    };
  }

  private courseData(input: Record<string, unknown>) {
    const shifts = Array.isArray(input.shifts)
      ? input.shifts.map((item) => String(item).trim()).filter(Boolean)
      : String(input.shifts ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
    return {
      description: this.cleanString(input.description),
      duration: this.cleanString(input.duration),
      modality: this.cleanString(input.modality),
      shifts: JSON.stringify(shifts),
      enrollmentFee: this.toDecimalNumber(input.enrollmentFee),
      monthlyFee: this.toDecimalNumber(input.monthlyFee),
      cashDiscountPercent: this.toDecimalNumber(input.cashDiscountPercent),
      active: typeof input.active === 'boolean' ? input.active : true,
    };
  }

  private documentData(input: Record<string, unknown>) {
    return {
      audience: this.cleanString(input.audience) || 'brasileiro',
      instructions: this.cleanString(input.instructions),
      required: typeof input.required === 'boolean' ? input.required : true,
      active: typeof input.active === 'boolean' ? input.active : true,
      order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0,
    };
  }

  private stringifyJson(value: unknown, fallback: unknown) {
    return JSON.stringify(value && typeof value === 'object' ? value : fallback);
  }

  private parseJson<T>(value: string | null | undefined, fallback: T): T {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  private cleanString(value: unknown) {
    return String(value ?? '').trim();
  }

  private toDecimalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private decimalToNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0);
  }
}
