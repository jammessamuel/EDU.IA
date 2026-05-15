// ============================================================
// simulator.service.ts — Lógica do simulador com IA
// ============================================================
// Este é o arquivo mais importante do backend da demo.
// Ele contém toda a lógica de negócio:
//   1. Enviar a mensagem do aluno para o GPT-4o-mini
//   2. Receber a resposta da IA
//   3. Verificar se a IA já coletou todos os dados do aluno
//   4. Se sim, salvar o lead no banco de dados PostgreSQL
//
// Fluxo de uma conversa:
//   Aluno digita → chat() → OpenAI responde → tryExtractAndSaveLead()
//   → se dados completos → salva no banco → retorna lead para o frontend
// ============================================================

import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DA ESCOLA — alterar antes da reunião com o cliente
// Substitua com o nome real, os cursos e as unidades da escola
// do empresário que vai assistir a demonstração.
// ─────────────────────────────────────────────────────────────
const SCHOOL_NAME = 'Colégio Exemplo';
const COURSES = ['Enfermagem', 'Administração', 'Direito', 'Pedagogia'];
const UNITS = ['Centro', 'Norte', 'Sul'];
// ─────────────────────────────────────────────────────────────

// SYSTEM PROMPT: instruções permanentes que a IA recebe no início
// de toda conversa. Define a personalidade e o objetivo do atendente.
// Este texto NÃO aparece para o aluno — é só para orientar a IA.
//
// Boas práticas aplicadas aqui:
// - "UMA POR VEZ": evita que a IA faça várias perguntas de uma vez,
//   o que pareceria robótico e assustaria o aluno
// - Sequência definida: garante que coletamos os dados na ordem certa
// - Fallback humano: se o aluno pedir atendente humano, a IA encaminha
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

// Interface TypeScript que define o formato de cada mensagem no histórico.
// "role" indica quem escreveu: "user" = aluno, "assistant" = IA.
// Esse formato é exatamente o que a API da OpenAI espera receber.
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// @Injectable() → marca como serviço injetável pelo NestJS
@Injectable()
export class SimulatorService {
  // Cliente da OpenAI — usamos para chamar o GPT-4o-mini
  private client: OpenAI;

  // O NestJS injeta automaticamente ConfigService e PrismaService.
  // ConfigService → acessa variáveis do .env (ex: OPENAI_API_KEY)
  // PrismaService → acessa o banco de dados PostgreSQL
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    // Cria o cliente OpenAI com a chave da API do .env
    this.client = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  // ──────────────────────────────────────────────────────────
  // chat() — processa uma mensagem do aluno e retorna a resposta da IA
  //
  // Parâmetros:
  //   text    → texto digitado pelo aluno no simulador
  //   history → array com todas as mensagens da conversa até agora
  //             (modificado por referência — o NestJS mantém na sessão)
  //
  // Retorna:
  //   { reply: "resposta da IA", lead: {...} ou null }
  // ──────────────────────────────────────────────────────────
  async chat(text: string, history: ChatMessage[]) {
    // Adiciona a mensagem do aluno ao histórico ANTES de chamar a IA.
    // Assim a IA vê o que o aluno acabou de dizer.
    history.push({ role: 'user', content: text });

    // Chama a API da OpenAI para gerar a resposta da IA.
    const response = await this.client.chat.completions.create({
      // gpt-4o-mini: modelo mais rápido e barato da OpenAI.
      // Para esta demo é perfeito — latência ~1s e custo mínimo.
      model: 'gpt-4o-mini',

      messages: [
        // O system prompt vai sempre primeiro, orientando o modelo
        { role: 'system', content: SYSTEM_PROMPT },

        // Envia as últimas 12 mensagens do histórico.
        // O slice(-12) evita mandar a conversa inteira quando ela
        // fica longa, reduzindo custo de tokens.
        ...history.slice(-12),
      ],

      // temperature: controla a criatividade/aleatoriedade da resposta.
      // 0 = sempre igual, 1 = muito criativo.
      // 0.4 é um bom equilíbrio para atendimento: consistente mas natural.
      temperature: 0.4,

      // Limita o tamanho da resposta. 300 tokens ≈ ~200 palavras.
      // Suficiente para uma resposta de atendente, evita respostas longas demais.
      max_tokens: 300,
    });

    // Extrai o texto da resposta (o [0] pega a primeira — e única — opção)
    const reply = response.choices[0].message.content ?? '';

    // Adiciona a resposta da IA ao histórico para a próxima mensagem
    history.push({ role: 'assistant', content: reply });

    // Tenta extrair os dados do lead e salvar no banco.
    // Retorna null se a conversa ainda não tem todos os dados necessários.
    const lead = await this.tryExtractAndSaveLead(history);

    // Retorna tanto a resposta para exibir no chat
    // quanto o lead (se qualificado) para exibir no painel
    return { reply, lead };
  }

  // ──────────────────────────────────────────────────────────
  // tryExtractAndSaveLead() — extrai dados estruturados da conversa
  //
  // Esta função faz uma segunda chamada para a OpenAI com um
  // prompt diferente: em vez de conversar, pede que a IA analise
  // o histórico e extraia os dados em formato JSON.
  //
  // Só é executada quando o histórico tem 8+ mensagens
  // (4 trocas de mensagem), para não fazer chamadas desnecessárias
  // logo no início quando certamente ainda não há dados suficientes.
  // ──────────────────────────────────────────────────────────
  private async tryExtractAndSaveLead(history: ChatMessage[]) {
    // Otimização: não tenta extrair com menos de 8 mensagens no histórico
    // (4 do aluno + 4 da IA). Evita chamadas à OpenAI desnecessárias.
    if (history.length < 8) return null;

    // Segunda chamada à OpenAI — agora no modo de extração de dados.
    // Usamos "response_format: json_object" para garantir que a IA
    // retorne JSON válido e não texto livre.
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
          // Formata o histórico como texto legível para a IA analisar.
          // Ex: "Aluno: oi\nAtendente: Olá! Qual curso você tem interesse?"
          role: 'user',
          content: history
            .map((m) => `${m.role === 'user' ? 'Aluno' : 'Atendente'}: ${m.content}`)
            .join('\n'),
        },
      ],

      // Garante que o retorno seja sempre um JSON válido.
      // Sem isso, a IA poderia retornar texto como "Aqui está o JSON: {...}"
      response_format: { type: 'json_object' },

      // temperature: 0 = determinístico. Para extração de dados queremos
      // sempre o mesmo resultado — sem criatividade.
      temperature: 0,
      max_tokens: 200,
    });

    try {
      // Converte a string JSON retornada pela IA em objeto JavaScript
      const data = JSON.parse(extraction.choices[0].message.content ?? '{}');

      // Se a IA indicou que os dados ainda não estão completos, retorna null
      if (!data.qualified) return null;

      // Verifica se já existe um lead com o mesmo nome e curso no banco.
      // Evita duplicatas quando o frontend consulta várias vezes
      // durante a mesma conversa.
      const existing = await this.prisma.lead.findFirst({
        where: { name: data.name, course: data.course },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;

      // Salva o novo lead no banco de dados PostgreSQL via Prisma.
      // O Prisma converte esse código TypeScript em SQL automaticamente:
      // INSERT INTO leads (name, course, unit, shift, qualified) VALUES (...)
      return await this.prisma.lead.create({
        data: {
          name: data.name,
          course: data.course,
          unit: data.unit,
          shift: data.shift,
          qualified: true,
        },
      });
    } catch {
      // Se o JSON estiver malformado ou faltar algum campo,
      // retornamos null silenciosamente — a conversa continua normalmente.
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────
  // getAllLeads() — busca todos os leads salvos no banco
  //
  // Usada pelo endpoint GET /simulator/leads para o frontend
  // exibir o painel de leads qualificados ao lado do chat.
  // Os leads são ordenados do mais recente para o mais antigo.
  // ──────────────────────────────────────────────────────────
  async getAllLeads() {
    // SELECT * FROM leads ORDER BY created_at DESC
    return this.prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
