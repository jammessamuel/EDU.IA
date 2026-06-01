import { BadRequestException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

function buildSystemPrompt(schoolName: string, courses: string[], units: string[]): string {
  return `
Você é o atendente virtual da ${schoolName}, uma instituição de ensino.
Seu objetivo é qualificar o interesse do aluno coletando as seguintes informações, UMA POR VEZ:
1. Qual curso tem interesse (opções: ${courses.join(', ')})
2. Qual unidade prefere (opções: ${units.join(', ')})
3. Qual turno prefere (manhã, tarde ou noite)
4. Nome completo

REGRAS:
- Seja cordial e objetivo, em português brasileiro
- Faça APENAS UMA pergunta por mensagem
- Não peça todas as informações de uma vez
- Quando tiver todas as informações (curso + unidade + turno + nome), agradeça e diga que um consultor vai entrar em contato em breve
- Se o aluno pedir para falar com um humano, diga que vai transferir e encerre cordialmente
`.trim();
}

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

    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    const courses = JSON.parse(school?.courses ?? '["Enfermagem","Administração","Direito","Pedagogia"]');
    const units   = JSON.parse(school?.units   ?? '["Centro","Norte","Sul"]');
    const prompt  = buildSystemPrompt(school?.name ?? 'Instituição de Ensino', courses, units);

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
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

  async getMetrics(schoolId: string) {
    const leads = await this.prisma.lead.findMany({ where: { schoolId } });

    const byStatus: Record<string, number> = {
      NOVO: 0, CONTATO: 0, INSCRITO: 0, MATRICULADO: 0, PERDIDO: 0,
    };
    const byCourse: Record<string, number> = {};

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
      if (lead.status !== 'PERDIDO') {
        byCourse[lead.course] = (byCourse[lead.course] ?? 0) + 1;
      }
    }

    const active = leads.filter((l) => l.status !== 'PERDIDO').length;
    const conversionRate = active > 0
      ? Math.round((byStatus.MATRICULADO / active) * 100)
      : 0;

    // Leads por dia nos últimos 14 dias
    const now = new Date();
    const byDay: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay.push({
        date: key,
        count: leads.filter((l) => l.createdAt.toISOString().slice(0, 10) === key).length,
      });
    }

    return { total: active, byStatus, byCourse, conversionRate, byDay };
  }

  async getSchoolSettings(schoolId: string) {
    const s = await this.prisma.school.findUnique({ where: { id: schoolId } });
    return {
      name: s?.name ?? '',
      chatbotName: s?.chatbotName ?? 'IA Atendente',
      courses: JSON.parse(s?.courses ?? '[]'),
      units:   JSON.parse(s?.units   ?? '[]'),
    };
  }

  async updateSchoolSettings(
    schoolId: string,
    data: { name?: string; chatbotName?: string; courses?: string[]; units?: string[] },
  ) {
    const update: any = {};
    if (data.name)        update.name        = data.name;
    if (data.chatbotName) update.chatbotName = data.chatbotName;
    if (data.courses)     update.courses     = JSON.stringify(data.courses);
    if (data.units)       update.units       = JSON.stringify(data.units);

    const s = await this.prisma.school.update({ where: { id: schoolId }, data: update });
    return {
      name: s.name,
      chatbotName: s.chatbotName,
      courses: JSON.parse(s.courses),
      units:   JSON.parse(s.units),
    };
  }

  async getStaleLeds(schoolId: string, hoursThreshold = 24) {
    const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
    return this.prisma.lead.findMany({
      where: { schoolId, status: 'NOVO', createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
