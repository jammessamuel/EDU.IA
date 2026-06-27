import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VerticalService, VerticalField } from '../vertical/vertical.service';
import { EnrollmentChatService } from '../enrollment/enrollment-chat.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { RuntimeSchoolConfig, SchoolConfigService } from '../school-config/school-config.service';
import { isValidCpf, isValidEmail, onlyDigits } from '../common/lib/validation';
import {
  EDUCATION_ENROLLMENT_FIELDS,
  normalizeEnrollmentData,
  validateEnrollment,
  type EnrollmentField,
} from '../enrollment/enrollment-fields';
import { camposFaltando } from '../enrollment/enrollment-agent';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type SimulatorLanguage = 'pt' | 'en' | 'es';

@Injectable()
export class SimulatorService {
  // Client OpenAI criado sob demanda (lazy) — ver o getter abaixo.
  private _client: OpenAI | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private verticalService: VerticalService,
    private enrollmentChat: EnrollmentChatService,
    private enrollments: EnrollmentService,
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
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);

    if (this.shouldUseEnrollmentFlow(text, history, enrollmentDraft)) {
      let result: Awaited<ReturnType<EnrollmentChatService['chat']>>;
      try {
        result = await this.enrollmentChat.chat(text, history, enrollmentDraft, schoolId, userId);
      } catch (err) {
        if (!this.isOpenAiUnavailable(err)) throw err;
        return this.localEnrollmentFallback(text, history, enrollmentDraft, schoolId, runtimeConfig);
      }
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

    const reply = this.sanitizeAssistantReply(response.choices[0].message.content ?? '', runtimeConfig);
    history.push({ role: 'assistant', content: reply });

    const rawLead = await this.tryExtractAndSaveLead(history, schoolId);
    const lead = rawLead ? this.serializeLead(rawLead) : null;
    return { reply, lead, mode: 'lead', enrollmentDraft: null, enrollment: null };
  }

  private answerFromConfig(text: string, runtimeConfig: RuntimeSchoolConfig): string | null {
    const normalized = this.normalizeText(text);
    const language = this.detectLanguage(text);
    const specificCourse = this.findMentionedCourse(normalized, runtimeConfig);

    if (this.isGreetingOnly(normalized)) {
      return this.localized(
        language,
        'Oi! Tudo bem? Eu posso te ajudar com cursos, valores, documentos, horário/localização ou já começar sua matrícula por aqui. O que você quer ver primeiro?',
        'Hi! I can help with programs, prices, documents, opening hours/location, or start your enrollment here. What would you like to see first?',
        '¡Hola! Puedo ayudarte con cursos, valores, documentos, horarios/ubicación o empezar tu matrícula por aquí. ¿Qué quieres ver primero?',
      );
    }

    if (this.isBusinessHoursQuestion(normalized)) {
      const hours = this.schoolConfig.formatBusinessHours(runtimeConfig.profile.businessHours);
      return this.localized(
        language,
        `Claro. Nosso horário é: ${hours}.\n\nQuer que eu te ajude com cursos, valores ou já com a matrícula?`,
        `Sure. Our opening hours are: ${hours}.\n\nWould you like help with programs, prices, or enrollment?`,
        `Claro. Nuestro horario es: ${hours}.\n\n¿Quieres ayuda con cursos, valores o con la matrícula?`,
      );
    }

    if (this.isLocationQuestion(normalized)) {
      const address = [runtimeConfig.profile.address, runtimeConfig.profile.city, runtimeConfig.profile.state]
        .filter(Boolean)
        .join(', ');
      if (language === 'en') {
        return [
          `We are located at ${address}.`,
          runtimeConfig.profile.referencePoints ? `Reference point: ${runtimeConfig.profile.referencePoints}` : '',
          runtimeConfig.profile.transportInfo ? `How to get there: ${runtimeConfig.profile.transportInfo}` : '',
          runtimeConfig.profile.mapLink ? `Map: ${runtimeConfig.profile.mapLink}` : '',
          'Would you like to see programs/prices or start your enrollment here?',
        ].filter(Boolean).join('\n');
      }
      if (language === 'es') {
        return [
          `Estamos en ${address}.`,
          runtimeConfig.profile.referencePoints ? `Referencia: ${runtimeConfig.profile.referencePoints}` : '',
          runtimeConfig.profile.transportInfo ? `Cómo llegar: ${runtimeConfig.profile.transportInfo}` : '',
          runtimeConfig.profile.mapLink ? `Mapa: ${runtimeConfig.profile.mapLink}` : '',
          '¿Quieres ver cursos/valores o empezar tu matrícula por aquí?',
        ].filter(Boolean).join('\n');
      }
      return [
        `Ficamos em ${address}.`,
        runtimeConfig.profile.referencePoints ? `Referência: ${runtimeConfig.profile.referencePoints}` : '',
        runtimeConfig.profile.transportInfo ? `Como chegar: ${runtimeConfig.profile.transportInfo}` : '',
        runtimeConfig.profile.mapLink ? `Mapa: ${runtimeConfig.profile.mapLink}` : '',
        'Quer ver cursos/valores ou já começar sua matrícula por aqui?',
      ].filter(Boolean).join('\n');
    }

    if (this.isDocumentQuestion(normalized)) {
      const audience = this.detectDocumentAudience(normalized);
      const documents = runtimeConfig.documents.filter((document) => document.audience === audience);
      const label = audience === 'estrangeiro'
        ? 'aluno estrangeiro'
        : audience === 'menor_idade'
          ? 'aluno menor de idade'
          : 'aluno brasileiro';
      const lines = documents.map((document) => {
        const required = document.required ? this.localized(language, 'obrigatório', 'required', 'obligatorio') : this.localized(language, 'opcional', 'optional', 'opcional');
        return `- ${document.documentType} (${required}): ${document.instructions}`;
      });

      if (language === 'en') {
        const englishLabel = audience === 'estrangeiro' ? 'international student' : audience === 'menor_idade' ? 'underage student' : 'Brazilian student';
        return `For an ${englishLabel}, the configured list is:\n${lines.join('\n')}\n\nYou can send everything in one PDF or file by file. Want to start the enrollment?`;
      }
      if (language === 'es') {
        const spanishLabel = audience === 'estrangeiro' ? 'estudiante extranjero' : audience === 'menor_idade' ? 'estudiante menor de edad' : 'estudiante brasileño';
        return `Para ${spanishLabel}, la lista configurada es:\n${lines.join('\n')}\n\nPuedes enviar todo en un PDF único o archivo por archivo. ¿Quieres empezar la matrícula?`;
      }
      return `Para ${label}, a lista configurada é:\n${lines.join('\n')}\n\nPode mandar tudo em um PDF único ou arquivo por arquivo. Quer começar a matrícula?`;
    }

    if (this.isCommercialQuestion(normalized)) {
      const commercial = runtimeConfig.commercial;
      const selectedCourses = specificCourse ? [specificCourse] : runtimeConfig.courses;
      const courseValues = selectedCourses
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
      return this.localized(
        language,
        `${promo}\n\nValores configurados:\n${courseValues}\n\nSe quiser, eu já posso continuar a matrícula por aqui. Qual curso você quer seguir?`,
        `${promo}\n\nConfigured prices:\n${courseValues}\n\nIf you want, I can continue the enrollment here. Which program would you like to choose?`,
        `${promo}\n\nValores configurados:\n${courseValues}\n\nSi quieres, puedo continuar la matrícula por aquí. ¿Qué curso quieres elegir?`,
      );
    }

    if (this.isCourseQuestion(normalized) || specificCourse) {
      if (specificCourse && !this.isGeneralCourseListQuestion(normalized)) {
        return this.courseDetailsReply(specificCourse, language);
      }
      const courses = runtimeConfig.courses.map((course) => this.formatCourseLine(course, language));
      return this.localized(
        language,
        `Temos estes cursos ativos agora:\n${courses.join('\n')}\n\nQuer que eu detalhe algum deles, envie o PDF ou já comece sua matrícula?`,
        `These programs are active now:\n${courses.join('\n')}\n\nWould you like details about one of them, the PDF, or to start enrollment?`,
        `Tenemos estos cursos activos ahora:\n${courses.join('\n')}\n\n¿Quieres detalles de alguno, el PDF o empezar tu matrícula?`,
      );
    }

    return null;
  }

  private async localEnrollmentFallback(
    text: string,
    history: ChatMessage[],
    draft: Record<string, any>,
    schoolId: string,
    runtimeConfig: RuntimeSchoolConfig,
  ) {
    const fields = this.fieldsForConfig(runtimeConfig);
    const extracted = this.extractFallbackEnrollmentFields(text, history, runtimeConfig, fields);
    const current = normalizeEnrollmentData(fields, { ...draft, ...extracted });
    const missing = camposFaltando(fields, current);
    const errors = validateEnrollment(fields, current, { requireMissing: false });
    const directReply = this.answerFromConfig(text, runtimeConfig);
    const hasNewData = Object.keys(extracted).length > 0;

    if (directReply && !hasNewData && !this.isConfirmation(text)) {
      return {
        reply: `${directReply}\n\nContinuando sua matrícula: ${this.nextEnrollmentQuestion(missing[0], current)}`,
        lead: null,
        mode: 'enrollment',
        enrollmentDraft: current,
        enrollment: null,
        accessibility: null,
      };
    }

    if (errors.length) {
      return {
        reply: `Recebi sua resposta, mas preciso corrigir um ponto: ${errors[0].message}\n\nPode me mandar esse dado de novo?`,
        lead: null,
        mode: 'enrollment',
        enrollmentDraft: current,
        enrollment: null,
        accessibility: null,
      };
    }

    if (!missing.length) {
      if (this.isConfirmation(text)) {
        const enrollment = await this.enrollments.enroll(schoolId, current);
        return {
          reply: `Matrícula confirmada! Número ${enrollment.number}.\n\nO comprovante já está pronto para baixar. Depois você pode enviar os documentos em um PDF único ou arquivo por arquivo na etapa de documentos.`,
          lead: null,
          mode: 'enrollment',
          enrollmentDraft: current,
          enrollment,
          accessibility: null,
        };
      }

      return {
        reply: `${this.enrollmentSummary(current)}\n\nSe estiver tudo certo, me responda "confirmo" que eu finalizo sua matrícula por aqui.`,
        lead: null,
        mode: 'enrollment',
        enrollmentDraft: current,
        enrollment: null,
        accessibility: null,
      };
    }

    const saved = Object.keys(extracted).length
      ? `Anotei: ${Object.keys(extracted).map((key) => this.fieldLabel(fields, key)).join(', ')}.\n\n`
      : '';

    return {
      reply: `${saved}${this.nextEnrollmentQuestion(missing[0], current)}`,
      lead: null,
      mode: 'enrollment',
      enrollmentDraft: current,
      enrollment: null,
      accessibility: null,
    };
  }

  private fieldsForConfig(runtimeConfig: RuntimeSchoolConfig): EnrollmentField[] {
    const courseOptions = runtimeConfig.courses.map((course) => course.name).filter(Boolean);
    const shiftOptions = [...new Set(runtimeConfig.courses.flatMap((course) => course.shifts))].filter(Boolean);
    const modalityOptions = [...new Set(runtimeConfig.courses.map((course) => course.modality).filter(Boolean))];

    return EDUCATION_ENROLLMENT_FIELDS.map((field) => {
      if (field.name === 'course' && courseOptions.length) return { ...field, options: courseOptions };
      if (field.name === 'shift' && shiftOptions.length) return { ...field, options: shiftOptions };
      if (field.name === 'modalidade' && modalityOptions.length) return { ...field, options: modalityOptions };
      if (field.name === 'unit') return { ...field, required: false, options: ['Sede principal'] };
      return field;
    });
  }

  private extractFallbackEnrollmentFields(
    text: string,
    history: ChatMessage[],
    runtimeConfig: RuntimeSchoolConfig,
    fields: EnrollmentField[],
  ): Record<string, unknown> {
    const found: Record<string, unknown> = {};
    const normalized = this.normalizeText(text);
    const digits = onlyDigits(text);
    const lastAssistant = [...history].reverse().find((message) => message.role === 'assistant')?.content ?? '';
    const lastAssistantNormalized = this.normalizeText(lastAssistant);

    Object.assign(found, this.extractLabelValueFields(text));

    const language = this.detectLanguage(text);
    found.preferredLanguage = this.localized(language, 'Português', 'English', 'Español');

    const nationality = this.detectNationalityFields(normalized);
    Object.assign(found, nationality);

    const course = this.findMentionedCourse(normalized, runtimeConfig);
    if (course) {
      found.course = course.name;
      if (course.modality) found.modalidade = course.modality;
    }

    const shift = this.extractShift(normalized);
    if (shift) found.shift = shift;

    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (email && isValidEmail(email)) found.email = email;

    const cpfCandidate = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/)?.[0];
    if (cpfCandidate && (/\bcpf\b/i.test(text) || isValidCpf(cpfCandidate))) {
      found.documentType = 'CPF';
      found.documentNumber = cpfCandidate;
    }

    const passportCandidate = text.match(/\b(?:passaporte|passport|pasaporte)\s*(?:é|e|:|#|number|nº|no\.?)?\s*([A-Z0-9][A-Z0-9 -]{4,18})\b/i)?.[1];
    if (passportCandidate) {
      found.documentType = 'Passaporte';
      found.documentNumber = passportCandidate;
    }

    if (/\bssn\b|social security/i.test(text)) {
      found.documentType = 'SSN';
      const ssn = text.match(/\b\d{3}-?\d{2}-?\d{4}\b/)?.[0];
      if (ssn) found.documentNumber = ssn;
    }
    if (/\bnie\b/i.test(text)) found.documentType = 'NIE';
    if (/\bdni\b/i.test(text)) found.documentType = 'DNI';

    const dateCandidate = text.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/)?.[1];
    if (dateCandidate) found.birthDate = dateCandidate;

    const cepCandidate = text.match(/\b\d{5}-?\d{3}\b/)?.[0];
    if (cepCandidate) found.cep = cepCandidate;

    const phoneCandidate = text.match(/(?:\+?\d[\d\s().-]{9,}\d)/)?.[0];
    const phoneDigits = phoneCandidate ? onlyDigits(phoneCandidate) : '';
    if (phoneCandidate && phoneDigits.length >= 10 && phoneDigits.length <= 15 && !isValidCpf(phoneDigits)) {
      found.phone = phoneCandidate.trim();
    } else if (!found.phone && digits.length >= 10 && digits.length <= 15 && !isValidCpf(digits)) {
      found.phone = text.trim();
    }

    const explicitName =
      text.match(/\b(?:meu nome é|me chamo|my name is|mi nombre es|me llamo)\s+([A-ZÀ-ÿ][A-ZÀ-ÿ' -]{4,80})/i)?.[1] ??
      null;
    if (explicitName) {
      found.studentName = explicitName.replace(/[,.].*$/, '').trim();
    } else if (lastAssistantNormalized.includes('nome completo') && this.looksLikePersonName(text)) {
      found.studentName = text.trim();
    }

    if (lastAssistantNormalized.includes('pais') || lastAssistantNormalized.includes('país')) {
      if (/\b(brasil|brazil)\b/i.test(text)) {
        found.countryOfResidence = 'Brasil';
        found.nacionalidade = found.nacionalidade ?? 'Brazilian';
      } else if (/\b(united states|usa|eua|estados unidos)\b/i.test(text)) {
        found.countryOfResidence = 'United States';
        found.nacionalidade = found.nacionalidade ?? 'American';
      } else if (/\b(canada|canad[aá])\b/i.test(text)) {
        found.countryOfResidence = 'Canada';
        found.nacionalidade = found.nacionalidade ?? 'Canadian';
      } else if (/\b(spain|espa[ñn]a)\b/i.test(text)) {
        found.countryOfResidence = 'Spain';
        found.nacionalidade = found.nacionalidade ?? 'Spanish';
      }
    }

    if (!found.paymentMethod && /\bpix\b/i.test(text)) found.paymentMethod = 'PIX';
    if (!found.paymentMethod && /\bboleto\b/i.test(text)) found.paymentMethod = 'Boleto';
    if (!found.paymentMethod && /\bcart[aã]o|credit card\b/i.test(text)) found.paymentMethod = 'Cartão de crédito';

    return normalizeEnrollmentData(fields, found);
  }

  private extractLabelValueFields(text: string): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const segment of text.split(/[;\n]+/)) {
      const match = segment.match(/^\s*([A-Za-zÀ-ÿ ]{2,40})\s*[:=-]\s*(.{2,120})\s*$/);
      if (!match) continue;
      values[match[1].trim()] = match[2].trim();
    }
    return values;
  }

  private detectNationalityFields(normalizedText: string): Record<string, string> {
    if (/\b(american|u\.?s\.? citizen|usa|united states|from the us|from the u\.s\.|from america|americano|estadunidense|estados unidos)\b/.test(normalizedText)) {
      return { nacionalidade: 'American', countryOfResidence: 'United States', preferredLanguage: 'English' };
    }
    if (/\b(canadian|canada|from canada|canadense)\b/.test(normalizedText)) {
      return { nacionalidade: 'Canadian', countryOfResidence: 'Canada', preferredLanguage: 'English' };
    }
    if (/\b(from spain|spaniard|soy de espana|vivo en espana|naci en espana|espanhol|spanish)\b/.test(normalizedText)) {
      return { nacionalidade: 'Spanish', countryOfResidence: 'Spain', preferredLanguage: 'Español' };
    }
    if (/\b(brasileiro|brasileira|sou do brasil|moro no brasil|brazilian|from brazil)\b/.test(normalizedText)) {
      return { nacionalidade: 'Brazilian', countryOfResidence: 'Brasil', preferredLanguage: normalizedText.includes('brazil') ? 'English' : 'Português' };
    }
    return {};
  }

  private extractShift(normalizedText: string): string | null {
    const compact = normalizedText.trim();
    if (compact === 'manha') return 'manhã';
    if (compact === 'tarde') return 'tarde';
    if (compact === 'noite') return 'noite';
    if (/\bturno\s*(da|de)?\s*manha\b|\b(de|pela|a)\s*manha\b|\bmatutino\b/.test(normalizedText)) return 'manhã';
    if (/\bturno\s*(da|de)?\s*tarde\b|\b(de|pela|a)\s*tarde\b|\bvespertino\b/.test(normalizedText)) return 'tarde';
    if (/\bturno\s*(da|de)?\s*noite\b|\b(de|pela|a)\s*noite\b|\bnoturno\b/.test(normalizedText)) return 'noite';
    return null;
  }

  private nextEnrollmentQuestion(nextLabel: string | undefined, draft: Record<string, unknown>): string {
    const language = String(draft.preferredLanguage ?? 'Português');
    const english = language === 'English';
    const spanish = language === 'Español';

    if (!nextLabel) {
      return this.localized(english ? 'en' : spanish ? 'es' : 'pt', 'Já tenho os dados principais. Quer revisar e confirmar?', 'I have the main data. Would you like to review and confirm?', 'Ya tengo los datos principales. ¿Quieres revisar y confirmar?');
    }

    const normalizedLabel = this.normalizeText(nextLabel);
    if (normalizedLabel.includes('nome completo')) {
      return this.localized(english ? 'en' : spanish ? 'es' : 'pt', 'Para começar sua matrícula, qual é seu nome completo?', 'To start your enrollment, what is your full name?', 'Para empezar tu matrícula, ¿cuál es tu nombre completo?');
    }
    if (normalizedLabel.includes('pais')) {
      return this.localized(english ? 'en' : spanish ? 'es' : 'pt', 'Você mora em qual país hoje?', 'Which country do you currently live in?', '¿En qué país vives actualmente?');
    }
    if (normalizedLabel.includes('tipo de documento') || normalizedLabel.includes('numero do documento')) {
      return this.localized(english ? 'en' : spanish ? 'es' : 'pt', 'Você vai usar CPF, passaporte ou outro documento? Pode me mandar o tipo e o número.', 'Will you use a Brazilian CPF, passport, or another document? Send me the type and number.', '¿Vas a usar CPF brasileño, pasaporte u otro documento? Envíame el tipo y número.');
    }
    if (normalizedLabel.includes('data de nascimento')) {
      return this.localized(english ? 'en' : spanish ? 'es' : 'pt', 'Qual é sua data de nascimento? Pode mandar no formato DD/MM/AAAA.', 'What is your date of birth? You can send it as DD/MM/YYYY.', '¿Cuál es tu fecha de nacimiento? Puedes enviarla como DD/MM/AAAA.');
    }
    if (normalizedLabel.includes('e-mail')) {
      return this.localized(english ? 'en' : spanish ? 'es' : 'pt', 'Qual e-mail você quer deixar no cadastro?', 'Which email should I use for your enrollment?', '¿Qué correo electrónico quieres usar en el cadastro?');
    }
    if (normalizedLabel.includes('celular')) {
      return this.localized(english ? 'en' : spanish ? 'es' : 'pt', 'Qual é seu celular com DDD ou código do país?', 'What is your mobile number with area/country code?', '¿Cuál es tu celular con código de área o país?');
    }
    return this.localized(
      english ? 'en' : spanish ? 'es' : 'pt',
      `Agora preciso de: ${nextLabel}. Pode me informar?`,
      `Now I need: ${nextLabel}. Can you send it to me?`,
      `Ahora necesito: ${nextLabel}. ¿Puedes enviármelo?`,
    );
  }

  private enrollmentSummary(data: Record<string, unknown>): string {
    return [
      'Revisei os dados principais:',
      `Nome: ${data.studentName}`,
      `Curso: ${data.course}`,
      `Documento: ${data.documentType} ${data.documentNumber}`,
      `E-mail: ${data.email}`,
      `Celular: ${data.phone}`,
      `Pagamento: ${data.paymentMethod}`,
    ].filter((line) => !line.endsWith('undefined')).join('\n');
  }

  private fieldLabel(fields: EnrollmentField[], fieldName: string): string {
    return fields.find((field) => field.name === fieldName)?.label ?? fieldName;
  }

  private looksLikePersonName(text: string): boolean {
    const trimmed = text.trim();
    if (/[?@0-9:/\\]/.test(trimmed)) return false;
    return /^[A-Za-zÀ-ÿ' -]{6,80}$/.test(trimmed) && trimmed.split(/\s+/).length >= 2;
  }

  private isConfirmation(text: string): boolean {
    return /\b(confirmo|confirmar|esta certo|está certo|tudo certo|pode finalizar|pode efetivar|yes|confirm|confirmed|correct|si|sí|confirmo|correcto)\b/i.test(text);
  }

  private isOpenAiUnavailable(err: unknown): boolean {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    const status = typeof (err as any)?.getStatus === 'function' ? (err as any).getStatus() : (err as any)?.status;
    return status === 503 || /OPENAI_API_KEY|invalid_api_key|Incorrect API key|chave válida/i.test(message);
  }

  private sanitizeAssistantReply(reply: string, runtimeConfig: RuntimeSchoolConfig): string {
    const unsafeHandoff =
      /\b(consultor|consultora|equipe|time|atendente humano|nossa equipe|nuestro equipo|our team)\b.{0,120}\b(entrar[aá]? em contato|entrara en contacto|vai falar|vai te chamar|retornar|contact you|reach out|will contact)\b/ims;
    const oldUnitPrompt = /\b(Centro,\s*Norte\s*(?:e|ou)\s*Sul|Centro,\s*Norte\s*(?:y|o)\s*Sur)\b/i;
    let cleaned = reply
      .split(/\n{2,}/)
      .filter((paragraph) => !unsafeHandoff.test(paragraph) && !oldUnitPrompt.test(paragraph))
      .join('\n\n')
      .replace(/\b(Até logo|Hasta luego|Goodbye)[!.]?/gi, '')
      .trim();

    if (!cleaned || cleaned === reply.trim()) return reply;

    const firstCourse = runtimeConfig.courses[0]?.name;
    const next = firstCourse
      ? `Eu continuo por aqui mesmo. Quer ver valores/documentos ou começar a matrícula de ${firstCourse}?`
      : 'Eu continuo por aqui mesmo. Quer ver valores/documentos ou começar a matrícula?';
    return `${cleaned}\n\n${next}`;
  }

  private courseDetailsReply(course: RuntimeSchoolConfig['courses'][number], language: SimulatorLanguage): string {
    const shifts = course.shifts.length ? course.shifts.join(', ') : this.localized(language, 'a confirmar', 'to be confirmed', 'a confirmar');
    const enrollment = course.enrollmentFee ? this.formatCurrency(course.enrollmentFee) : this.localized(language, 'a confirmar', 'to be confirmed', 'a confirmar');
    const monthly = course.monthlyFee ? this.formatCurrency(course.monthlyFee) : this.localized(language, 'a confirmar', 'to be confirmed', 'a confirmar');
    const discount = course.cashDiscountPercent ? `${course.cashDiscountPercent}%` : this.localized(language, 'conforme campanha vigente', 'according to the active campaign', 'según la campaña vigente');

    if (language === 'en') {
      return `Great choice. *${course.name}* has ${course.duration || 'a configured duration'} in ${course.modality || 'the configured modality'}.\n${course.description}\n\nPrices: enrollment ${enrollment}, monthly fee ${monthly}, cash discount up to ${discount}. Available shifts: ${shifts}.\n\nWould you like the PDF, prices/discounts, or should I start your enrollment here?`;
    }
    if (language === 'es') {
      return `Buena elección. *${course.name}* tiene ${course.duration || 'duración configurada'} en modalidad ${course.modality || 'configurada'}.\n${course.description}\n\nValores: matrícula ${enrollment}, mensualidad ${monthly}, descuento al contado hasta ${discount}. Turnos: ${shifts}.\n\n¿Quieres el PDF, ver descuentos o empezar tu matrícula por aquí?`;
    }
    return `Boa escolha. *${course.name}* tem ${course.duration || 'duração configurada'} na modalidade ${course.modality || 'configurada'}.\n${course.description}\n\nValores: matrícula ${enrollment}, mensalidade ${monthly}, desconto à vista até ${discount}. Turnos: ${shifts}.\n\nQuer receber o PDF, ver desconto/valores ou começar sua matrícula por aqui?`;
  }

  private formatCourseLine(course: RuntimeSchoolConfig['courses'][number], language: SimulatorLanguage): string {
    const shifts = course.shifts.length
      ? this.localized(language, ` Turnos: ${course.shifts.join(', ')}.`, ` Shifts: ${course.shifts.join(', ')}.`, ` Turnos: ${course.shifts.join(', ')}.`)
      : '';
    const monthly = course.monthlyFee
      ? this.localized(language, ` Mensalidade: ${this.formatCurrency(course.monthlyFee)}.`, ` Monthly fee: ${this.formatCurrency(course.monthlyFee)}.`, ` Mensualidad: ${this.formatCurrency(course.monthlyFee)}.`)
      : '';
    const duration = course.duration
      ? this.localized(language, ` Duração: ${course.duration}.`, ` Duration: ${course.duration}.`, ` Duración: ${course.duration}.`)
      : '';
    const modality = course.modality
      ? this.localized(language, ` Modalidade: ${course.modality}.`, ` Modality: ${course.modality}.`, ` Modalidad: ${course.modality}.`)
      : '';
    return `- *${course.name}*: ${course.description}${duration}${modality}${shifts}${monthly}`;
  }

  private findMentionedCourse(normalizedText: string, runtimeConfig: RuntimeSchoolConfig) {
    const aliases: Record<string, string[]> = {
      direito: ['direito', 'derecho', 'law'],
      enfermagem: ['enfermagem', 'enfermeria', 'nursing'],
      administracao: ['administracao', 'administracion', 'administration', 'business'],
      pedagogia: ['pedagogia', 'pedagogy', 'education'],
    };

    return runtimeConfig.courses.find((course) => {
      const key = this.normalizeText(course.name);
      const courseAliases = aliases[key] ?? [key];
      return courseAliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(normalizedText));
    }) ?? null;
  }

  private detectLanguage(text: string): SimulatorLanguage {
    if (/\b(hello|hi|i want|i need|program|course|enroll|enrollment|tuition|price|american|canadian|passport|where are you|opening hours)\b/i.test(text)) {
      return 'en';
    }
    if (/[¿¡]/.test(text) || /\b(hola|quiero|necesito|inscripci[oó]n|descuento|ubicaci[oó]n|pasaporte|espa[ñn]ol|buenos d[ií]as|buenas tardes|buenas noches)\b/i.test(text)) {
      return 'es';
    }
    return 'pt';
  }

  private localized(language: SimulatorLanguage, pt: string, en: string, es: string): string {
    if (language === 'en') return en;
    if (language === 'es') return es;
    return pt;
  }

  private isGreetingOnly(normalizedText: string): boolean {
    return /^(oi|ola|olá|bom dia|boa tarde|boa noite|hello|hi|hey|hola|buenos dias|buenas tardes|buenas noches)[!. ]*$/.test(normalizedText.trim());
  }

  private isBusinessHoursQuestion(normalizedText: string): boolean {
    return /\b(horario|hora|funcionamento|aberto|atendimento|secretaria|financeiro|opening hours|open|office hours|business hours|horarios|atencion|secretaria|financiero)\b/.test(normalizedText);
  }

  private isLocationQuestion(normalizedText: string): boolean {
    return /\b(localizacao|localiza|endereco|onde fica|como chegar|conducao|transporte|onibus|metro|mapa|location|address|where are you|how to get|transport|bus|subway|map|ubicacion|direccion|donde queda|como llegar|transporte|autobus|bus|metro|mapa)\b/.test(normalizedText);
  }

  private isDocumentQuestion(normalizedText: string): boolean {
    return /\b(documento|documentacao|passaporte|cpf|rg|rne|rnm|dni|nie|menor|pdf unico|arquivo|documents|documentation|passport|underage|single pdf|one pdf|file|documentos|documentacion|pasaporte|menor de edad|pdf unico|archivo)\b/.test(normalizedText);
  }

  private isCommercialQuestion(normalizedText: string): boolean {
    return /\b(desconto|promocao|promocional|avista|a vista|valor|preco|mensalidade|pagamento|bolsa|discount|promotion|price|tuition|fee|payment|cash|descuento|promocion|valor|precio|mensualidad|pago|contado)\b/.test(normalizedText);
  }

  private isCourseQuestion(normalizedText: string): boolean {
    return /\b(curso|cursos|graduacao|faculdade|program|programs|course|courses|degree|college|curso|cursos|carrera|universidad)\b/.test(normalizedText);
  }

  private isGeneralCourseListQuestion(normalizedText: string): boolean {
    return /\b(quais|todos|lista|disponiveis|opcoes|what|which|available|list|cuales|todos|lista|disponibles|opciones)\b/.test(normalizedText);
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

    const normalized = this.normalizeText(text);
    if (this.isInformationalQuestion(normalized) && !this.hasExplicitEnrollmentStart(normalized)) {
      return false;
    }

    const enrollmentIntent = /\b(matr[ií]cula|matricular|matricule|inscri[cç][aã]o|inscrever|inscrev)/i;
    const internationalEnrollmentIntent =
      /\b(enroll|enrollment|admission|application|apply|inscripci[oó]n|inscribirme|matricularme)\b/i;
    if (this.hasExplicitEnrollmentStart(normalized) || internationalEnrollmentIntent.test(text)) return true;
    if (/^(matr[ií]cula|inscri[cç][aã]o|enrollment|admission|inscripci[oó]n)$/i.test(text.trim())) return true;

    const affirmative = /\b(sim|pode|vamos|bora|quero|claro|ok|fechado|yes|sure|let'?s|quiero|sí|si)\b/i;
    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')?.content ?? '';
    const assistantInvitedEnrollment =
      /\b(começar|comecar|fazer|iniciar|seguir|continuar|finalizar|start|begin|continue|empezar|iniciar|continuar)\s+(a\s+)?(sua\s+|your\s+|tu\s+)?(matr[ií]cula|enrollment|inscripci[oó]n)\b|\b(matr[ií]cula|enrollment|inscripci[oó]n)\s+(por aqui|here|por aqui)\b/i;
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

  private isInformationalQuestion(normalizedText: string): boolean {
    return (
      this.isBusinessHoursQuestion(normalizedText) ||
      this.isLocationQuestion(normalizedText) ||
      this.isDocumentQuestion(normalizedText) ||
      this.isCommercialQuestion(normalizedText) ||
      this.isCourseQuestion(normalizedText)
    );
  }

  private hasExplicitEnrollmentStart(normalizedText: string): boolean {
    return (
      /\b(quero|queria|gostaria|preciso|vamos|bora|pode|posso|aceito|comece|comeca|inicia|iniciar|fazer|fechar|finalizar)\b.{0,50}\b(matricula|inscricao)\b/.test(normalizedText) ||
      /\b(matricular|me matricular|matricule|inscrever|me inscrever|inscrev)\b/.test(normalizedText) ||
      /\b(i want|i need|let'?s|start|begin|apply)\b.{0,50}\b(enroll|enrollment|admission|application)\b/.test(normalizedText) ||
      /\b(quiero|necesito|vamos|puedo|empezar|iniciar|hacer)\b.{0,50}\b(matricula|inscripcion)\b/.test(normalizedText) ||
      /\b(matricularme|inscribirme)\b/.test(normalizedText)
    );
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
