import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VerticalService, VerticalField } from '../vertical/vertical.service';
import { EnrollmentChatService } from '../enrollment/enrollment-chat.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class SimulatorService {
  // Client OpenAI criado sob demanda (lazy) — ver o getter abaixo.
  private _client: OpenAI | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private verticalService: VerticalService,
    private enrollmentChat: EnrollmentChatService,
  ) {}

  // Só instancio o OpenAI quando o chat realmente vai ser usado.
  // Assim o backend sobe mesmo sem OPENAI_API_KEY (login, Kanban, dashboard
  // e leads continuam funcionando). Antes, chave vazia/ausente derrubava o
  // NestJS inteiro no boot — em serverless isso significava o app todo fora do ar.
  private get client(): OpenAI {
    if (!this._client) {
      const apiKey = this.config.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException(
          'OPENAI_API_KEY não configurada — o chat de IA está indisponível no momento.',
        );
      }
      this._client = new OpenAI({ apiKey });
    }
    return this._client;
  }

  // ── Prompt dinâmico por vertical ─────────────────────────────────────────────

  private async buildPrompt(schoolId: string): Promise<string> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { vertical: true },
    });

    const fields = await this.verticalService.getFieldsForWorkspace(schoolId);
    const fieldDescriptions = fields
      .sort((a, b) => a.order - b.order)
      .map((f, i) => {
        const opts = f.options?.length ? ` (opções: ${f.options.join(', ')})` : '';
        return `${i + 1}. ${f.label}${opts}`;
      })
      .join('\n');

    const template = school?.vertical?.promptTemplate ?? `Você é {{chatbotName}}, atendente virtual da {{workspaceName}}.
Colete as seguintes informações, UMA POR VEZ:
{{fieldDescriptions}}
Quando coletar todos os campos, agradeça e diga que um consultor vai entrar em contato.`;

    return template
      .replace(/\{\{chatbotName\}\}/g,       school?.chatbotName ?? 'Atendente Virtual')
      .replace(/\{\{workspaceName\}\}/g,     school?.name        ?? 'nossa empresa')
      .replace(/\{\{fieldDescriptions\}\}/g, fieldDescriptions);
  }

  // ── Chat ──────────────────────────────────────────────────────────────────────

  async chat(
    text: string,
    history: ChatMessage[],
    schoolId: string,
    enrollmentDraft: Record<string, any> = {},
  ) {
    if (this.shouldUseEnrollmentFlow(text, history, enrollmentDraft)) {
      const result = await this.enrollmentChat.chat(text, history, enrollmentDraft, schoolId);
      return {
        reply: result.reply,
        lead: null,
        mode: 'enrollment',
        enrollmentDraft: result.draft,
        enrollment: result.enrollment,
      };
    }

    history.push({ role: 'user', content: text });

    const systemPrompt = await this.buildPrompt(schoolId);

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-14),
      ],
      temperature: 0.4,
      max_tokens: 300,
    });

    const reply = response.choices[0].message.content ?? '';
    history.push({ role: 'assistant', content: reply });

    const rawLead = await this.tryExtractAndSaveLead(history, schoolId);
    const lead = rawLead ? this.serializeLead(rawLead) : null;
    return { reply, lead, mode: 'lead', enrollmentDraft: null, enrollment: null };
  }

  private shouldUseEnrollmentFlow(
    text: string,
    history: ChatMessage[],
    enrollmentDraft: Record<string, any>,
  ): boolean {
    if (Object.keys(enrollmentDraft ?? {}).length > 0) return true;

    const enrollmentIntent = /\b(matr[ií]cula|matricular|matricule|inscri[cç][aã]o|inscrever|inscrev)/i;
    if (enrollmentIntent.test(text)) return true;

    // Mantém o usuário no mesmo fluxo depois que ele iniciou matrícula,
    // mesmo se a próxima resposta for só "sim", "Centro" ou um CPF.
    const recentText = history
      .slice(-8)
      .map((m) => m.content)
      .join('\n');
    return enrollmentIntent.test(recentText);
  }

  // ── Extração de lead dinâmica ─────────────────────────────────────────────────

  private async tryExtractAndSaveLead(history: ChatMessage[], schoolId: string) {
    if (history.length < 6) return null;

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { vertical: true },
    });

    const extractionPrompt = school?.vertical?.extractionPrompt
      ?? `Analise a conversa e extraia os dados em JSON.
Retorne null se o lead não estiver qualificado (faltando nome ou campos principais).
Se qualificado, retorne: {"name":"...","qualified":true,...outrosCampos}
Retorne APENAS o JSON, sem explicação.`;

    const extraction = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: extractionPrompt },
        {
          role: 'user',
          content: history
            .map((m) => `${m.role === 'user' ? 'Cliente' : 'Atendente'}: ${m.content}`)
            .join('\n'),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 300,
    });

    try {
      const raw = JSON.parse(extraction.choices[0].message.content ?? '{}');
      if (!raw.qualified || !raw.name) return null;

      const { name, qualified, ...dynamicFields } = raw;

      // Deduplicação por nome dentro da escola
      const existing = await this.prisma.lead.findFirst({
        where: { schoolId, name },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;

      return await this.prisma.lead.create({
        data: {
          schoolId,
          name,
          qualified: true,
          data:         JSON.stringify(dynamicFields),
          conversation: JSON.stringify(history.slice(-30)), // até 30 msgs
        },
      });
    } catch {
      return null;
    }
  }

  // ── Leads ─────────────────────────────────────────────────────────────────────

  async getAllLeads(schoolId: string) {
    const leads = await this.prisma.lead.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
    return leads.map(this.serializeLead);
  }

  async updateLeadStatus(id: string, status: string, schoolId: string) {
    const stages = await this.verticalService.getStagesForWorkspace(schoolId);
    const validKeys = stages.map((s) => s.key);
    if (!validKeys.includes(status)) {
      throw new BadRequestException(`Status inválido. Válidos: ${validKeys.join(', ')}`);
    }
    const lead = await this.prisma.lead.update({
      where: { id, schoolId },
      data: { status },
    });
    return this.serializeLead(lead);
  }

  // ── Métricas ─────────────────────────────────────────────────────────────────

  async getMetrics(schoolId: string) {
    const leads = await this.prisma.lead.findMany({ where: { schoolId } });
    const stages = await this.verticalService.getStagesForWorkspace(schoolId);
    const lastStage = stages[stages.length - 1]?.key ?? 'PERDIDO';
    const lostKey = stages.find((s) => s.key === 'PERDIDO')?.key ?? lastStage;

    const byStatus: Record<string, number> = {};
    stages.forEach((s) => (byStatus[s.key] = 0));

    const byField: Record<string, Record<string, number>> = {};

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
      if (lead.status !== lostKey) {
        try {
          const data = JSON.parse(lead.data || '{}');
          for (const [k, v] of Object.entries(data)) {
            if (!byField[k]) byField[k] = {};
            const val = String(v);
            byField[k][val] = (byField[k][val] ?? 0) + 1;
          }
        } catch { /* skip */ }
      }
    }

    const active = leads.filter((l) => l.status !== lostKey).length;
    const convertedKey = stages[stages.length - 2]?.key ?? '';
    const converted = byStatus[convertedKey] ?? 0;
    const conversionRate = active > 0 ? Math.round((converted / active) * 100) : 0;

    const now = new Date();
    const byDay = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      return { date: key, count: leads.filter((l) => l.createdAt.toISOString().slice(0, 10) === key).length };
    });

    return { total: active, byStatus, byField, conversionRate, byDay };
  }

  async getStaleLeds(schoolId: string, hoursThreshold = 24) {
    const stages = await this.verticalService.getStagesForWorkspace(schoolId);
    const firstStage = stages[0]?.key ?? 'NOVO';
    const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    const leads = await this.prisma.lead.findMany({
      where: { schoolId, status: firstStage, createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
    });
    return leads.map(this.serializeLead);
  }

  async getSchoolSettings(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { vertical: true },
    });
    const fields = await this.verticalService.getFieldsForWorkspace(schoolId);
    const stages = await this.verticalService.getStagesForWorkspace(schoolId);

    return {
      name:        school?.name        ?? '',
      chatbotName: school?.chatbotName ?? 'IA Atendente',
      vertical: school?.vertical ? {
        id:    school.vertical.id,
        slug:  school.vertical.slug,
        name:  school.vertical.name,
        icon:  school.vertical.icon,
        color: school.vertical.color,
      } : null,
      fields,
      stages,
    };
  }

  async updateSchoolSettings(
    schoolId: string,
    data: { name?: string; chatbotName?: string; customFields?: any[]; customStages?: any[] },
  ) {
    const update: any = {};
    if (data.name)         update.name         = data.name;
    if (data.chatbotName)  update.chatbotName  = data.chatbotName;
    if (data.customFields) update.customFields = JSON.stringify(data.customFields);
    if (data.customStages) update.customStages = JSON.stringify(data.customStages);

    await this.prisma.school.update({ where: { id: schoolId }, data: update });
    return this.getSchoolSettings(schoolId);
  }

  // ── Serialização ─────────────────────────────────────────────────────────────

  private serializeLead(lead: any) {
    let data: Record<string, string> = {};
    let conversation: { role: string; content: string }[] = [];
    try { data = JSON.parse(lead.data || '{}'); } catch { /* noop */ }
    try { conversation = JSON.parse(lead.conversation || '[]'); } catch { /* noop */ }
    return {
      id:           lead.id,
      name:         lead.name,
      phone:        lead.phone,
      data,
      conversation,
      qualified:    lead.qualified,
      status:       lead.status,
      createdAt:    lead.createdAt,
      updatedAt:    lead.updatedAt,
    };
  }
}
