import { BadRequestException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const SCHOOL_NAME = 'Colégio Exemplo';
const COURSES = ['Enfermagem', 'Administração', 'Direito', 'Pedagogia'];
const UNITS = ['Centro', 'Norte', 'Sul'];

const SYSTEM_PROMPT = `
Você é o atendente virtual do ${SCHOOL_NAME}, uma instituição de ensino.
Seu objetivo é qualificar o interesse do aluno coletando as seguintes informações, UMA POR VEZ:
1. Qual curso tem interesse (opções: ${COURSES.join(', ')})
2. Qual unidade prefere (opções: ${UNITS.join(', ')})
3. Qual turno prefere (manhã, tarde ou noite)
4. Nome completo
5. Se é maior de 18 anos

REGRAS:
- Seja cordial e objetivo, em português brasileiro
- Faça APENAS UMA pergunta por mensagem
- Não peça todas as informações de uma vez
- Quando tiver todas as informações (curso + unidade + turno + nome), agradeça e diga que um atendente vai entrar em contato em breve
- Se o aluno pedir para falar com um humano, diga que vai transferir e encerre cordialmente
`.trim();

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
  ) {
    this.client = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  async chat(text: string, history: ChatMessage[], schoolId: string) {
    history.push({ role: 'user', content: text });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-12),
      ],
      temperature: 0.4,
      max_tokens: 300,
    });

    const reply = response.choices[0].message.content ?? '';
    history.push({ role: 'assistant', content: reply });

    const lead = await this.tryExtractAndSaveLead(history, schoolId);
    return { reply, lead };
  }

  private async tryExtractAndSaveLead(history: ChatMessage[], schoolId: string) {
    if (history.length < 8) return null;

    const extraction = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analise a conversa e extraia os dados do lead em JSON.
Retorne null se ainda não tiver: nome + curso + unidade + turno.
Se tiver todos, retorne: {"name":"...","course":"...","unit":"...","shift":"...","qualified":true}
Retorne APENAS o JSON, sem explicação.`,
        },
        {
          role: 'user',
          content: history
            .map((m) => `${m.role === 'user' ? 'Aluno' : 'Atendente'}: ${m.content}`)
            .join('\n'),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 200,
    });

    try {
      const data = JSON.parse(extraction.choices[0].message.content ?? '{}');
      if (!data.qualified) return null;

      // Verifica duplicata dentro da mesma escola
      const existing = await this.prisma.lead.findFirst({
        where: { schoolId, name: data.name, course: data.course },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;

      return await this.prisma.lead.create({
        data: {
          schoolId,
          name: data.name,
          course: data.course,
          unit: data.unit,
          shift: data.shift,
          qualified: true,
        },
      });
    } catch {
      return null;
    }
  }

  async getAllLeads(schoolId: string) {
    return this.prisma.lead.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateLeadStatus(id: string, status: string, schoolId: string) {
    const VALID = ['NOVO', 'CONTATO', 'INSCRITO', 'MATRICULADO', 'PERDIDO'];
    if (!VALID.includes(status)) throw new BadRequestException('Status inválido');

    return this.prisma.lead.update({
      where: { id, schoolId },
      data: { status },
    });
  }
}
