import { BadRequestException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VerticalService, VerticalField } from '../vertical/vertical.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class SimulatorService {
  private client: OpenAI;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private verticalService: VerticalService,
  ) {
    this.client = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
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

  async chat(text: string, history: ChatMessage[], schoolId: string) {
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
    return { reply, lead };
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
          data: JSON.stringify(dynamicFields),
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
    try { data = JSON.parse(lead.data || '{}'); } catch { /* noop */ }
    return {
      id:        lead.id,
      name:      lead.name,
      phone:     lead.phone,
      data,
      qualified: lead.qualified,
      status:    lead.status,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }
}
