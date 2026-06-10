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

    const systemPrompt = buildEnrollmentPrompt({
      chatbotName: school?.chatbotName ?? 'Atendente de Matrículas',
      schoolName: school?.name ?? 'nossa instituição',
      fee: DEFAULT_ENROLLMENT_FEE,
      draft,
    });

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    let current = { ...draft };
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
      return { campos: ofertaInfo(fields) };
    }

    if (name === 'salvar_dados') {
      const novo = { ...draft, ...(args.campos || {}) };
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
      const erros = validateEnrollment(fields, draft);
      const faltando = camposFaltando(fields, draft);
      if (erros.length || faltando.length) {
        return { ok: false, faltando, erros: erros.map((e) => e.message) };
      }
      const e = await this.enrollments.enroll(schoolId, draft);
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
}
