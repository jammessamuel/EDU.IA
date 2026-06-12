import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VerticalService, VerticalField } from '../vertical/vertical.service';
import { EnrollmentChatService } from '../enrollment/enrollment-chat.service';
import { institutionInfoForPrompt } from '../enrollment/institution-info';

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

    if (school?.vertical?.slug === 'education') {
      return this.buildEducationPrompt(
        school.chatbotName ?? 'IA Atendente',
        school.name ?? 'nossa instituição',
      );
    }

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

    const rendered = template
      .replace(/\{\{chatbotName\}\}/g,       school?.chatbotName ?? 'Atendente Virtual')
      .replace(/\{\{workspaceName\}\}/g,     school?.name        ?? 'nossa empresa')
      .replace(/\{\{fieldDescriptions\}\}/g, fieldDescriptions);

    return `${rendered}

REGRA DE IDIOMA (prioridade alta):
- Detecte automaticamente se o cliente fala Português, English ou Español.
- Responda no mesmo idioma do cliente, com naturalidade humana.
- Se o cliente disser que é American/from the United States, Canadian/from Canada ou Spanish/from Spain/España, reconheça isso e continue no idioma correspondente.
- Continue coletando uma pergunta por vez.
- Se o cliente perguntar horário, localização, endereço, como chegar, condução/transporte, desconto à vista, valores ou PDF/material do curso, responda usando as informações institucionais abaixo.
- Evite respostas gravadas. Puxe assunto como uma pessoa: entenda a intenção, responda o que foi perguntado e faça uma próxima pergunta leve.

${institutionInfoForPrompt(this.config.get<string>('FRONTEND_PUBLIC_URL') ?? 'https://edu-ia-front.vercel.app')}`;
  }

  private buildEducationPrompt(chatbotName: string, workspaceName: string): string {
    return `Você é ${chatbotName}, atendente de IA da ${workspaceName}. Você atende alunos pelo WhatsApp/simulador e deve resolver a conversa por conta própria.

OBJETIVO:
- Responder dúvidas sobre cursos, descontos, PDFs, horário, localização, condução e matrícula.
- Quando o aluno demonstrar vontade de seguir, convidar para fazer a matrícula completa por aqui.
- Você NÃO é triagem para consultor. Não diga "um consultor/equipe vai entrar em contato". Diga que você mesmo pode continuar e fazer a matrícula.

COMO CONVERSAR:
- Fale como uma pessoa: natural, objetiva, gentil e sem texto engessado.
- Responda o que o aluno perguntou antes de pedir qualquer dado.
- Não force unidade/turno quando o aluno só quer informação, promoção, PDF ou detalhes do curso.
- Se o aluno escolher um curso, explique rapidamente o curso e pergunte se ele quer: receber o PDF, ver desconto/valores ou começar a matrícula.
- Só pergunte unidade e turno depois que o aluno deixar claro que quer fazer matrícula ou pedir disponibilidade.
- Se ele perguntar promoção/desconto, responda a condição e ofereça seguir com a matrícula por aqui.
- Se ele pedir localização, diga o endereço e como chegar, sem transformar isso automaticamente em matrícula.
- Nunca encerre com "até logo" enquanto ainda existe possibilidade de avançar. Termine com uma próxima pergunta útil.

QUANDO VIRAR MATRÍCULA:
- Se o aluno disser "quero fazer matrícula", "quero me matricular", "quero inscrição", "pode fazer", "vamos fazer", "sim, quero começar" ou equivalente, o sistema chamará o fluxo completo de matrícula.
- Nesse caso, a própria IA coleta dados, valida e efetiva a matrícula. Não transfira para humano.

${institutionInfoForPrompt(this.config.get<string>('FRONTEND_PUBLIC_URL') ?? 'https://edu-ia-front.vercel.app')}`;
  }

  // ── Chat ──────────────────────────────────────────────────────────────────────

  async chat(
    text: string,
    history: ChatMessage[],
    schoolId: string,
    userId: string,
    enrollmentDraft: Record<string, any> = {},
  ) {
    if (this.shouldUseEnrollmentFlow(text, history, enrollmentDraft)) {
      const result = await this.enrollmentChat.chat(text, history, enrollmentDraft, schoolId, userId);
      return {
        reply: result.reply,
        lead: null,
        mode: 'enrollment',
        enrollmentDraft: result.draft,
        enrollment: result.enrollment,
        accessibility: result.accessibility,
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
    const internationalEnrollmentIntent =
      /\b(enroll|enrollment|admission|application|apply|inscripci[oó]n|inscribirme|matricularme)\b/i;
    if (enrollmentIntent.test(text) || internationalEnrollmentIntent.test(text)) return true;

    const affirmative = /\b(sim|pode|vamos|bora|quero|claro|ok|fechado|yes|sure|let'?s|quiero|sí|si)\b/i;
    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')?.content ?? '';
    const assistantInvitedEnrollment =
      /\b(começar|fazer|iniciar|seguir|finalizar)\s+(a\s+)?(sua\s+)?matr[ií]cula\b|\bmatr[ií]cula\s+por aqui\b/i;
    if (affirmative.test(text) && assistantInvitedEnrollment.test(lastAssistant)) return true;

    // Mantém o usuário no mesmo fluxo depois que ELE iniciou matrícula.
    // Não usa mensagens da IA, porque a saudação cita "matrícula" como opção
    // e isso não pode virar intenção automática.
    const recentUserText = history
      .slice(-8)
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');
    return enrollmentIntent.test(recentUserText) || internationalEnrollmentIntent.test(recentUserText);
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
