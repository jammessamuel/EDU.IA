// ============================================================
// enrollment-chat.service.ts — o atendente de matrícula com IA.
// Usa function calling (OpenAI tools): a IA conduz a conversa e o
// SERVIDOR executa as ferramentas e decide (valida, efetiva).
// Tem o seu próprio client OpenAI (lazy) pra NÃO mexer no
// SimulatorService (qualificação de lead) que já roda em produção.
// ============================================================
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from './enrollment.service';
import { AccessibilityService } from '../accessibility/accessibility.service';
import type { AccessibilityProfile } from '../accessibility/accessibility.types';
import { isValidCpf, isValidEmail, onlyDigits } from '../common/lib/validation';
import {
  EDUCATION_ENROLLMENT_FIELDS,
  DEFAULT_ENROLLMENT_FEE,
  normalizeEnrollmentData,
  type EnrollmentField,
  validateEnrollment,
} from './enrollment-fields';
import {
  ENROLLMENT_TOOLS,
  ofertaInfo,
  camposFaltando,
  buildEnrollmentPrompt,
} from './enrollment-agent';
import {
  RuntimeSchoolConfig,
  SchoolConfigService,
} from '../school-config/school-config.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class EnrollmentChatService {
  private _client: OpenAI | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private enrollments: EnrollmentService,
    private accessibility: AccessibilityService,
    private schoolConfig: SchoolConfigService,
  ) {}

  private get client(): OpenAI {
    if (!this._client) {
      const apiKey = this.config.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException(
          'OPENAI_API_KEY não configurada — o atendente de matrícula está indisponível.',
        );
      }
      this._client = new OpenAI({ apiKey });
    }
    return this._client;
  }

  /**
   * Uma rodada de conversa de matrícula. Stateless: o cliente manda o
   * histórico e o "draft" (dados já coletados); devolvemos a resposta, o
   * draft atualizado e, quando efetivada, a matrícula com o link do comprovante.
   */
  async chat(
    text: string,
    history: ChatMessage[],
    draft: Record<string, any>,
    schoolId: string,
    userId: string,
  ): Promise<{
    reply: string;
    draft: Record<string, any>;
    enrollment: any | null;
    accessibility: AccessibilityProfile | null;
  }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    const runtimeConfig = await this.schoolConfig.getRuntimeConfig(schoolId);
    let accessibility = await this.accessibility.getForUser(userId);
    const fields = this.fieldsForConfig(runtimeConfig);
    const recentUserText = [
      ...history
        .filter((message) => message.role === 'user')
        .slice(-6)
        .map((message) => message.content),
      text,
    ].join('\n');
    const initialDraft = normalizeEnrollmentData(fields, {
      ...this.extractObviousFields(recentUserText, fields),
      ...draft,
      ...this.extractObviousFields(text, fields),
    });

    const systemPrompt = buildEnrollmentPrompt({
      chatbotName: school?.chatbotName ?? 'Atendente de Matrículas',
      schoolName: school?.name ?? 'nossa instituição',
      fee: runtimeConfig.courses[0]?.enrollmentFee ?? DEFAULT_ENROLLMENT_FEE,
      draft: initialDraft,
      accessibility,
      frontendUrl:
        this.config.get<string>('FRONTEND_PUBLIC_URL') ??
        'https://edu-ia-front.vercel.app',
      institutionPrompt: this.schoolConfig.institutionPrompt(runtimeConfig),
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    let current = { ...initialDraft };
    let enrollment: any = null;
    let updatedAccessibility: AccessibilityProfile | null = null;

    // Loop de tool-calling. Teto de voltas pra nunca rodar infinito.
    for (let turn = 0; turn < 6; turn++) {
      const resp = await this.complete(messages);
      const msg = resp.choices[0].message;
      messages.push(msg);

      // Sem tool calls → é a resposta final, em texto, pro aluno.
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return {
          reply: msg.content ?? '',
          draft: current,
          enrollment,
          accessibility: updatedAccessibility,
        };
      }

      // Executa cada ferramenta que a IA pediu e devolve o resultado pra ela.
      for (const call of msg.tool_calls) {
        let args: any = {};
        try {
          args = JSON.parse((call as any).function.arguments || '{}');
        } catch {
          /* argumentos inválidos: segue com objeto vazio */
        }

        const result = await this.runTool(
          (call as any).function.name,
          args,
          current,
          schoolId,
          userId,
          text,
          runtimeConfig,
        );

        // canais "laterais" p/ propagar estado sem mandar lixo pra IA
        if (result._draft) current = result._draft;
        if (result._enrollment) enrollment = result._enrollment;
        if (result._accessibility) {
          accessibility = result._accessibility;
          updatedAccessibility = result._accessibility;
        }
        delete result._draft;
        delete result._enrollment;
        delete result._accessibility;

        messages.push({
          role: 'tool',
          tool_call_id: (call as any).id,
          content: JSON.stringify(result),
        });
      }
    }

    return {
      reply: 'Vamos continuar de onde paramos?',
      draft: current,
      enrollment,
      accessibility: updatedAccessibility,
    };
  }

  /** Chamada à OpenAI com tratamento de chave inválida (vira um 503 amigável). */
  private async complete(messages: any[]) {
    try {
      return await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: ENROLLMENT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.6,
        max_tokens: 500,
      });
    } catch (err: any) {
      if (err?.status === 401 || err?.code === 'invalid_api_key') {
        throw new ServiceUnavailableException(
          'OPENAI_API_KEY ausente ou inválida — configure uma chave válida para usar o atendente de matrícula.',
        );
      }
      throw err;
    }
  }

  private async runTool(
    name: string,
    args: any,
    draft: Record<string, any>,
    schoolId: string,
    userId: string,
    currentUserText: string,
    runtimeConfig: RuntimeSchoolConfig,
  ): Promise<any> {
    const fields = this.fieldsForConfig(runtimeConfig);

    if (name === 'consultar_oferta') {
      return ofertaInfo(fields);
    }

    if (name === 'consultar_instituicao') {
      return {
        horarios: runtimeConfig.profile.businessHours,
        endereco: {
          logradouro: runtimeConfig.profile.address,
          cidade: runtimeConfig.profile.city,
          uf: runtimeConfig.profile.state,
          mapa: runtimeConfig.profile.mapLink,
          referencias: runtimeConfig.profile.referencePoints,
          conducao: runtimeConfig.profile.transportInfo,
        },
        canais: runtimeConfig.profile.supportChannels,
        descontos: runtimeConfig.commercial,
        cursos: runtimeConfig.courses,
        documentos: runtimeConfig.documents,
      };
    }

    if (name === 'salvar_dados') {
      const campos = this.filterFieldsWithEvidence(
        args.campos || {},
        draft,
        currentUserText,
        fields,
      );
      const novo = normalizeEnrollmentData(fields, { ...draft, ...campos });
      const erros = validateEnrollment(fields, novo, { requireMissing: false });
      const faltando = camposFaltando(fields, novo);
      return {
        ok: erros.length === 0,
        salvos: Object.keys(campos),
        ignorados_por_falta_de_evidencia: Object.keys(args.campos || {}).filter(
          (field) => !(field in campos),
        ),
        faltando,
        erros: erros.map((e) => e.message),
        pronto_para_efetivar: faltando.length === 0 && erros.length === 0,
        _draft: novo,
      };
    }

    if (name === 'efetivar_matricula') {
      const normalized = normalizeEnrollmentData(fields, draft);
      const erros = validateEnrollment(fields, normalized);
      const faltando = camposFaltando(fields, normalized);
      if (erros.length || faltando.length) {
        return { ok: false, faltando, erros: erros.map((e) => e.message) };
      }
      const e = await this.enrollments.enroll(schoolId, normalized, {
        assigneeId: userId,
        simulatePayment: true,
      });
      return {
        ok: true,
        numero: e.number,
        situacao: e.status,
        comprovanteUrl: `/enrollments/${e.id}/comprovante.pdf`,
        _enrollment: e,
      };
    }

    if (name === 'ajustar_acessibilidade') {
      const { motivo: _motivo, ...preferences } = args || {};
      const profile = await this.accessibility.updateForUser(
        userId,
        preferences,
      );
      return {
        ok: true,
        aplicado: profile,
        mensagem:
          'Preferência de acessibilidade atualizada. Continue respondendo de acordo com esse perfil.',
        _accessibility: profile,
      };
    }

    return { ok: false, erro: `Ferramenta desconhecida: ${name}` };
  }

  private fieldsForConfig(
    runtimeConfig: RuntimeSchoolConfig,
  ): EnrollmentField[] {
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

  private extractObviousFields(
    text: string,
    fields: EnrollmentField[],
  ): Record<string, string> {
    const found: Record<string, string> = {};
    const haystack = this.normalizeText(text);
    const digits = onlyDigits(text);

    const language = this.detectLanguage(text);
    if (language) found.preferredLanguage = language;

    const nationalityProfile = this.detectNationalityProfile(text);
    Object.assign(found, nationalityProfile);

    for (const fieldName of ['course', 'unit', 'modalidade', 'ingresso']) {
      const field = fields.find((candidate) => candidate.name === fieldName);
      const option = field?.options?.find((candidate) =>
        haystack.includes(this.normalizeText(candidate)),
      );
      if (option) found[fieldName] = option;
    }

    const shift = this.extractShift(text);
    if (shift) found.shift = shift;

    if (/\b(passport|passaporte|pasaporte)\b/i.test(text))
      found.documentType = 'Passaporte';
    if (/\bssn\b|social security/i.test(text)) found.documentType = 'SSN';
    if (/\bdriver'?s? license\b/i.test(text))
      found.documentType = 'Driver License';
    if (/\bstate id\b/i.test(text)) found.documentType = 'State ID';
    if (/\bnie\b/i.test(text)) found.documentType = 'NIE';
    if (/\bdni\b/i.test(text)) found.documentType = 'DNI';
    if (/\bcpf\b/i.test(text)) found.documentType = 'CPF';

    const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (email && isValidEmail(email)) found.email = email;

    const cpfCandidate = text.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/)?.[0];
    if (cpfCandidate && isValidCpf(cpfCandidate)) {
      found.documentType = 'CPF';
      found.documentNumber = cpfCandidate;
    }

    const passportCandidate = text.match(
      /\b(?:passaporte|passport|pasaporte)\s*(?:é|e|:|#|number|nº|no\.?)?\s*([A-Z0-9][A-Z0-9 -]{4,18})\b/i,
    )?.[1];
    if (passportCandidate) {
      found.documentType = 'Passaporte';
      found.documentNumber = passportCandidate;
    }

    const dateCandidate = text.match(
      /\b(?:nasci(?:mento)?|birth(?:date)?|nací|fecha de nacimiento|data de nascimento)?\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/i,
    )?.[1];
    if (dateCandidate) found.birthDate = dateCandidate;

    const cepCandidate = text.match(/\b\d{5}-?\d{3}\b/)?.[0];
    if (cepCandidate) found.cep = cepCandidate;

    const phoneCandidate = text.match(/(?:\+?\d[\d\s().-]{9,}\d)/)?.[0];
    const phoneDigits = phoneCandidate ? onlyDigits(phoneCandidate) : '';
    if (
      phoneCandidate &&
      phoneDigits.length >= 10 &&
      phoneDigits.length <= 15 &&
      !isValidCpf(phoneDigits)
    ) {
      found.phone = phoneCandidate.trim();
    } else if (
      !found.phone &&
      digits.length >= 10 &&
      digits.length <= 15 &&
      !isValidCpf(digits)
    ) {
      found.phone = text.trim();
    }

    const nameCandidate =
      text.match(
        /\b(?:meu nome é|me chamo|my name is|mi nombre es|me llamo)\s+([A-ZÀ-ÿ][A-ZÀ-ÿ' -]{4,80})/i,
      )?.[1] ?? null;
    if (nameCandidate)
      found.studentName = nameCandidate.replace(/[,.].*$/, '').trim();

    if (!found.paymentMethod && /\bcart[aã]o\b/i.test(text))
      found.paymentMethod = 'Cartão de crédito';
    if (!found.paymentMethod && /\bpix\b/i.test(text))
      found.paymentMethod = 'PIX';
    if (!found.paymentMethod && /\bboleto\b/i.test(text))
      found.paymentMethod = 'Boleto';
    return found;
  }

  private extractShift(text: string): string | null {
    const normalized = this.normalizeText(text);
    const compact = normalized.trim();
    if (compact === 'manha') return 'manhã';
    if (compact === 'tarde') return 'tarde';
    if (compact === 'noite') return 'noite';
    if (
      /\bturno\s*(da|de)?\s*manha\b|\b(de|pela|a)\s*manha\b|\bmatutino\b/.test(
        normalized,
      )
    )
      return 'manhã';
    if (
      /\bturno\s*(da|de)?\s*tarde\b|\b(de|pela|a)\s*tarde\b|\bvespertino\b/.test(
        normalized,
      )
    )
      return 'tarde';
    if (
      /\bturno\s*(da|de)?\s*noite\b|\b(de|pela|a)\s*noite\b|\bnoturno\b/.test(
        normalized,
      )
    )
      return 'noite';
    return null;
  }

  private filterFieldsWithEvidence(
    campos: Record<string, unknown>,
    draft: Record<string, any>,
    text: string,
    fields: EnrollmentField[],
  ): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    for (const [fieldName, value] of Object.entries(campos)) {
      if (!this.requiresExplicitEvidence(fieldName)) {
        filtered[fieldName] = value;
        continue;
      }

      const alreadySaved = String(draft[fieldName] ?? '').trim();
      if (
        alreadySaved &&
        this.normalizeText(alreadySaved) === this.normalizeText(String(value))
      ) {
        filtered[fieldName] = value;
        continue;
      }

      if (this.hasExplicitEvidence(fieldName, String(value), text, fields)) {
        filtered[fieldName] = value;
      }
    }
    return filtered;
  }

  private requiresExplicitEvidence(fieldName: string): boolean {
    return [
      'course',
      'shift',
      'unit',
      'modalidade',
      'ingresso',
      'paymentMethod',
    ].includes(fieldName);
  }

  private hasExplicitEvidence(
    fieldName: string,
    value: string,
    text: string,
    fields: EnrollmentField[],
  ): boolean {
    if (fieldName === 'shift') return this.extractShift(text) === value;
    if (fieldName === 'paymentMethod') {
      const normalized = this.normalizeText(text);
      if (value === 'PIX') return /\bpix\b/.test(normalized);
      if (value === 'Boleto') return /\bboleto\b/.test(normalized);
      if (value === 'Cartão de crédito')
        return /\bcartao\b|\bcredito\b/.test(normalized);
    }

    const field = fields.find((candidate) => candidate.name === fieldName);
    const option = field?.options?.find(
      (candidate) =>
        this.normalizeText(candidate) === this.normalizeText(value),
    );
    return Boolean(
      option && this.normalizeText(text).includes(this.normalizeText(option)),
    );
  }

  private detectLanguage(
    text: string,
  ): 'Português' | 'English' | 'Español' | null {
    const lower = text.toLowerCase();

    if (
      /\b(hello|hi|i am|i'm|i want|enroll|enrollment|application|american|canadian|passport|driver'?s? license|state id|social security)\b/i.test(
        lower,
      )
    ) {
      return 'English';
    }

    const hasPortugueseSignal =
      /\b(ol[aá]|quero|sou|tenho|meu|minha|voc[eê]|matr[ií]cula|inscri[cç][aã]o|brasileir|passaporte|documento|cpf|manh[aã]|noite|cart[aã]o)\b/i.test(
        lower,
      );
    const hasSpanishSignal =
      /[¿¡]/.test(text) ||
      /\b(hola|quiero|soy|tengo|nac[ií]|inscripci[oó]n|espa[ñn]ol|pasaporte|documento|matricularme)\b/i.test(
        lower,
      );

    if (
      hasPortugueseSignal &&
      !/\b(hola|quiero|soy|tengo|nac[ií]|espa[ñn]ol|matricularme)\b/i.test(
        lower,
      )
    ) {
      return 'Português';
    }

    if (hasSpanishSignal) return 'Español';

    if (
      /\b(ol[aá]|quero|matr[ií]cula|inscri[cç][aã]o|brasileir|passaporte|documento|cpf)\b/i.test(
        lower,
      )
    ) {
      return 'Português';
    }

    return null;
  }

  private detectNationalityProfile(text: string): Record<string, string> {
    const lower = text.toLowerCase();
    const profile: Record<string, string> = {};

    if (
      /\b(american|u\.?s\.? citizen|usa|united states|from the us|from the u\.s\.|from america)\b/i.test(
        lower,
      )
    ) {
      profile.nacionalidade = 'American';
      profile.countryOfResidence = 'United States';
      profile.preferredLanguage = 'English';
    }

    if (/\b(canadian|canada|from canada)\b/i.test(lower)) {
      profile.nacionalidade = 'Canadian';
      profile.countryOfResidence = 'Canada';
      profile.preferredLanguage = 'English';
    }

    if (
      /\b(from spain|spaniard|soy de espa[ñn]a|vivo en espa[ñn]a|nac[ií] en espa[ñn]a)\b/i.test(
        lower,
      )
    ) {
      profile.nacionalidade = 'Spanish';
      profile.countryOfResidence = 'Spain';
      profile.preferredLanguage = 'Español';
    }

    if (
      /\b(brasileir[oa]|sou do brasil|moro no brasil|brazilian|from brazil)\b/i.test(
        lower,
      )
    ) {
      profile.nacionalidade = 'Brazilian';
      profile.countryOfResidence = 'Brasil';
      profile.preferredLanguage =
        lower.includes('brazilian') || lower.includes('from brazil')
          ? 'English'
          : 'Português';
    }

    return profile;
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
