import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VerticalService, VerticalField } from '../vertical/vertical.service';
import { EnrollmentChatService } from '../enrollment/enrollment-chat.service';
import { RuntimeSchoolConfig, SchoolConfigService } from '../school-config/school-config.service';

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
    private schoolConfig: SchoolConfigService,
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

  private async buildPrompt(schoolId: string, runtimeConfig: RuntimeSchoolConfig): Promise<string> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { vertical: true },
    });

    if (school?.vertical?.slug === 'education') {
      return this.buildEducationPrompt(
        school.chatbotName ?? 'IA Atendente',
        school.name ?? 'nossa instituição',
        runtimeConfig,
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
Quando coletar todos os campos, continue o atendimento e ofereça fazer a matrícula por aqui.`;

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
- Se o cliente perguntar horário, localização, endereço, como chegar, condução/transporte, documentos, desconto à vista, valores ou cursos, responda usando as informações configuráveis abaixo.
- Evite respostas gravadas. Puxe assunto como uma pessoa: entenda a intenção, responda o que foi perguntado e faça uma próxima pergunta leve.

${this.schoolConfig.institutionPrompt(runtimeConfig)}`;
  }

  private buildEducationPrompt(
    chatbotName: string,
    workspaceName: string,
    runtimeConfig: RuntimeSchoolConfig,
  ): string {
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
- Se ele perguntar documentos, responda conforme o tipo de aluno: brasileiro, estrangeiro ou menor de idade.
- Só use cursos ativos da configuração. Se um curso estiver inativo, não ofereça.
- Não invente unidades. A localização oficial configurada é a referência institucional.
- Nunca encerre com "até logo" enquanto ainda existe possibilidade de avançar. Termine com uma próxima pergunta útil.

QUANDO VIRAR MATRÍCULA:
- Se o aluno disser "quero fazer matrícula", "quero me matricular", "quero inscrição", "pode fazer", "vamos fazer", "sim, quero começar" ou equivalente, o sistema chamará o fluxo completo de matrícula.
- Nesse caso, a própria IA coleta dados, valida e efetiva a matrícula. Não transfira para humano.

${this.schoolConfig.institutionPrompt(runtimeConfig)}`;
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

    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    const directReply = this.answerFromConfig(text, runtimeConfig);
    if (directReply) {
      history.push({ role: 'assistant', content: directReply });
      return { reply: directReply, lead: null, mode: 'lead', enrollmentDraft: null, enrollment: null };
    }

    const systemPrompt = await this.buildPrompt(schoolId, runtimeConfig);

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

  private answerFromConfig(text: string, runtimeConfig: RuntimeSchoolConfig): string | null {
    const normalized = this.normalizeText(text);

    if (/\b(horario|hora|funcionamento|aberto|atendimento|secretaria|financeiro)\b/.test(normalized)) {
      return `Claro. Nosso horário é: ${this.schoolConfig.formatBusinessHours(runtimeConfig.profile.businessHours)}.\n\nQuer que eu te ajude com curso, valores ou matrícula?`;
    }

    if (/\b(localizacao|localiza|endereco|onde fica|como chegar|conducao|transporte|onibus|metro|mapa)\b/.test(normalized)) {
      const address = [runtimeConfig.profile.address, runtimeConfig.profile.city, runtimeConfig.profile.state]
        .filter(Boolean)
        .join(', ');
      return [
        `Ficamos em ${address}.`,
        runtimeConfig.profile.referencePoints ? `Referência: ${runtimeConfig.profile.referencePoints}` : '',
        runtimeConfig.profile.transportInfo ? `Como chegar: ${runtimeConfig.profile.transportInfo}` : '',
        runtimeConfig.profile.mapLink ? `Mapa: ${runtimeConfig.profile.mapLink}` : '',
        'Quer ver cursos/valores ou já começar sua matrícula por aqui?',
      ].filter(Boolean).join('\n');
    }

    if (/\b(documento|documentacao|passaporte|cpf|rg|rne|rnm|dni|nie|menor)\b/.test(normalized)) {
      const audience = this.detectDocumentAudience(normalized);
      const documents = runtimeConfig.documents.filter((document) => document.audience === audience);
      const label = audience === 'estrangeiro'
        ? 'aluno estrangeiro'
        : audience === 'menor_idade'
          ? 'aluno menor de idade'
          : 'aluno brasileiro';
      const lines = documents.map((document) => {
        const required = document.required ? 'obrigatório' : 'opcional';
        return `- ${document.documentType} (${required}): ${document.instructions}`;
      });

      return `Para ${label}, a lista configurada é:\n${lines.join('\n')}\n\nPode mandar tudo em um PDF único ou arquivo por arquivo. Quer começar a matrícula?`;
    }

    if (/\b(curso|cursos|graduacao|faculdade|direito|enfermagem|administracao|pedagogia)\b/.test(normalized)) {
      const courses = runtimeConfig.courses.map((course) => {
        const shifts = course.shifts.length ? ` Turnos: ${course.shifts.join(', ')}.` : '';
        const monthly = course.monthlyFee ? ` Mensalidade: ${this.formatCurrency(course.monthlyFee)}.` : '';
        return `- *${course.name}*: ${course.description} ${course.duration ? `Duração: ${course.duration}.` : ''} ${course.modality ? `Modalidade: ${course.modality}.` : ''}${shifts}${monthly}`;
      });
      return `Temos estes cursos ativos agora:\n${courses.join('\n')}\n\nQual deles você quer conhecer melhor ou matricular?`;
    }

    if (/\b(desconto|promocao|promocional|avista|a vista|valor|preco|mensalidade|matricula|pagamento)\b/.test(normalized)) {
      const commercial = runtimeConfig.commercial;
      const courseValues = runtimeConfig.courses
        .map((course) => {
          const enrollment = course.enrollmentFee ? `matrícula ${this.formatCurrency(course.enrollmentFee)}` : '';
          const monthly = course.monthlyFee ? `mensalidade ${this.formatCurrency(course.monthlyFee)}` : '';
          const discount = course.cashDiscountPercent ? `à vista até ${course.cashDiscountPercent}%` : '';
          return `- ${course.name}: ${[enrollment, monthly, discount].filter(Boolean).join(' | ')}`;
        })
        .join('\n');
      const promo = commercial.campaignActive
        ? this.schoolConfig.renderTemplate(commercial.promotionText, {
            desconto: commercial.cashDiscountPercent ?? 0,
          })
        : 'No momento não há campanha ativa cadastrada.';
      return `${promo}\n\nValores configurados:\n${courseValues}\n\nQuer que eu simule a matrícula de algum curso?`;
    }

    return null;
  }

  private detectDocumentAudience(normalizedText: string): 'brasileiro' | 'estrangeiro' | 'menor_idade' {
    if (/\b(menor|responsavel|responsavel legal|underage|menor de edad)\b/.test(normalizedText)) {
      return 'menor_idade';
    }
    if (/\b(estrangeiro|internacional|passaporte|passport|pasaporte|americano|canadense|canadian|american|spanish|espanhol|dni|nie|rne|rnm)\b/.test(normalizedText)) {
      return 'estrangeiro';
    }
    return 'brasileiro';
  }

  private formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value ?? 0);
  }

  private normalizeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
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
