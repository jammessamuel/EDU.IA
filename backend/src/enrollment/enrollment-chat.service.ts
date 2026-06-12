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
  ): Promise<{ reply: string; draft: Record<string, any>; enrollment: any | null }> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const fields = EDUCATION_ENROLLMENT_FIELDS;
    const initialDraft = normalizeEnrollmentData(fields, {
      ...draft,
      ...this.extractObviousFields(text, fields),
    });

    const systemPrompt = buildEnrollmentPrompt({
      chatbotName: school?.chatbotName ?? 'Atendente de Matrículas',
      schoolName: school?.name ?? 'nossa instituição',
      fee: DEFAULT_ENROLLMENT_FEE,
      draft: initialDraft,
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    let current = { ...initialDraft };
    let enrollment: any = null;

    // Loop de tool-calling. Teto de voltas pra nunca rodar infinito.
    for (let turn = 0; turn < 6; turn++) {
      const resp = await this.complete(messages);
      const msg = resp.choices[0].message;
      messages.push(msg);

      // Sem tool calls → é a resposta final, em texto, pro aluno.
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        return { reply: msg.content ?? '', draft: current, enrollment };
      }

      // Executa cada ferramenta que a IA pediu e devolve o resultado pra ela.
      for (const call of msg.tool_calls) {
        let args: any = {};
        try {
          args = JSON.parse((call as any).function.arguments || '{}');
        } catch {
          /* argumentos inválidos: segue com objeto vazio */
        }

        const result = await this.runTool((call as any).function.name, args, current, schoolId);

        // canais "laterais" p/ propagar estado sem mandar lixo pra IA
        if (result._draft) current = result._draft;
        if (result._enrollment) enrollment = result._enrollment;
        delete result._draft;
        delete result._enrollment;

        messages.push({
          role: 'tool',
          tool_call_id: (call as any).id,
          content: JSON.stringify(result),
        });
      }
    }

    return { reply: 'Vamos continuar de onde paramos?', draft: current, enrollment };
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
  ): Promise<any> {
    const fields = EDUCATION_ENROLLMENT_FIELDS;

    if (name === 'consultar_oferta') {
      return ofertaInfo(fields);
    }

    if (name === 'salvar_dados') {
      const novo = normalizeEnrollmentData(fields, { ...draft, ...(args.campos || {}) });
      const erros = validateEnrollment(fields, novo);
      const faltando = camposFaltando(fields, novo);
      return {
        ok: erros.length === 0,
        salvos: Object.keys(args.campos || {}),
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
      const e = await this.enrollments.enroll(schoolId, normalized);
      return {
        ok: true,
        numero: e.number,
        situacao: e.status,
        comprovanteUrl: `/enrollments/${e.id}/comprovante.pdf`,
        _enrollment: e,
      };
    }

    return { ok: false, erro: `Ferramenta desconhecida: ${name}` };
  }

  private extractObviousFields(text: string, fields: EnrollmentField[]): Record<string, string> {
    const found: Record<string, string> = {};
    const haystack = this.normalizeText(text);

    const language = this.detectLanguage(text);
    if (language) found.preferredLanguage = language;

    const nationalityProfile = this.detectNationalityProfile(text);
    Object.assign(found, nationalityProfile);

    for (const fieldName of ['course', 'shift', 'unit', 'modalidade', 'ingresso', 'paymentMethod']) {
      const field = fields.find((candidate) => candidate.name === fieldName);
      const option = field?.options?.find((candidate) => haystack.includes(this.normalizeText(candidate)));
      if (option) found[fieldName] = option;
    }

    if (/\b(passport|passaporte|pasaporte)\b/i.test(text)) found.documentType = 'Passaporte';
    if (/\bssn\b|social security/i.test(text)) found.documentType = 'SSN';
    if (/\bdriver'?s? license\b/i.test(text)) found.documentType = 'Driver License';
    if (/\bstate id\b/i.test(text)) found.documentType = 'State ID';
    if (/\bnie\b/i.test(text)) found.documentType = 'NIE';
    if (/\bdni\b/i.test(text)) found.documentType = 'DNI';
    if (/\bcpf\b/i.test(text)) found.documentType = 'CPF';
    if (!found.paymentMethod && /\bcart[aã]o\b/i.test(text)) found.paymentMethod = 'Cartão de crédito';
    return found;
  }

  private detectLanguage(text: string): 'Português' | 'English' | 'Español' | null {
    const lower = text.toLowerCase();

    if (
      /[¿¡]/.test(text) ||
      /\b(hola|quiero|matr[ií]cula|inscripci[oó]n|espa[ñn]ol|pasaporte|soy|nací|naci|tengo|documento)\b/i.test(text)
    ) {
      return 'Español';
    }

    if (
      /\b(hello|hi|i am|i'm|i want|enroll|enrollment|application|american|canadian|passport|driver'?s? license|state id|social security)\b/i.test(
        lower,
      )
    ) {
      return 'English';
    }

    if (/\b(ol[aá]|quero|matr[ií]cula|inscri[cç][aã]o|brasileir|passaporte|documento|cpf)\b/i.test(lower)) {
      return 'Português';
    }

    return null;
  }

  private detectNationalityProfile(text: string): Record<string, string> {
    const lower = text.toLowerCase();
    const profile: Record<string, string> = {};

    if (/\b(american|u\.?s\.? citizen|usa|united states|from the us|from the u\.s\.|from america)\b/i.test(lower)) {
      profile.nacionalidade = 'American';
      profile.countryOfResidence = 'United States';
      profile.preferredLanguage = 'English';
    }

    if (/\b(canadian|canada|from canada)\b/i.test(lower)) {
      profile.nacionalidade = 'Canadian';
      profile.countryOfResidence = 'Canada';
      profile.preferredLanguage = 'English';
    }

    if (/\b(from spain|spaniard|soy de espa[ñn]a|vivo en espa[ñn]a|nac[ií] en espa[ñn]a)\b/i.test(lower)) {
      profile.nacionalidade = 'Spanish';
      profile.countryOfResidence = 'Spain';
      profile.preferredLanguage = 'Español';
    }

    if (/\b(brasileir[oa]|sou do brasil|moro no brasil|brazilian|from brazil)\b/i.test(lower)) {
      profile.nacionalidade = 'Brazilian';
      profile.countryOfResidence = 'Brasil';
      profile.preferredLanguage = lower.includes('brazilian') || lower.includes('from brazil') ? 'English' : 'Português';
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
