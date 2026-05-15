// ============================================================
// simulator.controller.ts — Rotas HTTP do simulador
// ============================================================
// O Controller é responsável apenas por receber as requisições
// HTTP, extrair os dados necessários e chamar o Service.
// Ele NÃO contém lógica de negócio — apenas faz a ponte entre
// a requisição HTTP e o SimulatorService.
//
// Rotas disponíveis (prefixo "/simulator" definido em @Controller):
//
//   POST   /simulator/messages
//     Body: { "text": "mensagem do aluno" }
//     Resposta: { "reply": "resposta da IA", "lead": {...} ou null }
//
//   DELETE /simulator/session
//     Limpa o histórico de conversa da sessão atual
//     Resposta: { "ok": true }
//
//   GET    /simulator/leads
//     Retorna todos os leads qualificados salvos no banco
//     Resposta: [{ "id": "...", "name": "...", "course": "...", ... }]
// ============================================================

import { Controller, Post, Body, Delete, Get, Session } from '@nestjs/common';
import { SimulatorService, ChatMessage } from './simulator.service';

// @Controller('simulator') → todas as rotas deste controller
// começam com /simulator (ex: /simulator/messages)
@Controller('simulator')
export class SimulatorController {
  // Injeção de dependência: o NestJS entrega automaticamente
  // uma instância do SimulatorService. Não precisamos criar
  // com "new SimulatorService()" — o NestJS faz isso por nós.
  constructor(private readonly simulatorService: SimulatorService) {}

  // POST /simulator/messages
  // Recebe a mensagem digitada pelo aluno no simulador.
  @Post('messages')
  send(
    // @Body() extrai o corpo da requisição JSON.
    // Esperamos: { "text": "oi, quero saber sobre os cursos" }
    @Body() body: { text: string },

    // @Session() acessa a sessão HTTP deste cliente específico.
    // Cada aba do navegador tem sua própria sessão, então
    // cada "aluno" no simulador tem seu próprio histórico de conversa.
    @Session() session: Record<string, any>,
  ) {
    // Inicializa o array de histórico se for a primeira mensagem desta sessão
    if (!session.messages) session.messages = [];

    // Delega para o service e retorna a resposta diretamente.
    // O NestJS serializa o retorno automaticamente para JSON.
    return this.simulatorService.chat(body.text, session.messages as ChatMessage[]);
  }

  // DELETE /simulator/session
  // Reinicia a conversa zerando o histórico da sessão.
  // Usado pelo botão "Reiniciar" no frontend.
  @Delete('session')
  reset(@Session() session: Record<string, any>) {
    session.messages = [];
    return { ok: true };
  }

  // GET /simulator/leads
  // Retorna todos os leads qualificados salvos no banco.
  // O frontend usa essa rota para exibir o painel de leads
  // ao lado do simulador de conversa.
  @Get('leads')
  leads() {
    return this.simulatorService.getAllLeads();
  }
}
