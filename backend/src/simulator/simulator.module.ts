// ============================================================
// simulator.module.ts — Módulo do Simulador de WhatsApp
// ============================================================
// Agrupa o Controller e o Service do simulador.
// No NestJS, módulos são a unidade de organização do código:
//   - Controller → define as rotas HTTP (URLs)
//   - Service    → contém a lógica de negócio (IA, banco de dados)
//
// Rotas registradas por este módulo:
//   POST   /simulator/messages → envia mensagem para a IA
//   DELETE /simulator/session  → reinicia a conversa
//   GET    /simulator/leads    → lista os leads salvos no banco
// ============================================================

import { Module } from '@nestjs/common';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';

@Module({
  // controllers: lista os controllers deste módulo.
  // O NestJS lê os decorators (@Get, @Post etc.) do controller
  // e registra as rotas automaticamente.
  controllers: [SimulatorController],

  // providers: lista os serviços deste módulo.
  // O SimulatorService é injetado no SimulatorController
  // automaticamente pelo NestJS (injeção de dependência).
  providers: [SimulatorService],
})
export class SimulatorModule {}
