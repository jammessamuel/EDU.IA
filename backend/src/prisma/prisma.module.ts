// ============================================================
// prisma.module.ts — Módulo de acesso ao banco de dados
// ============================================================
// Este módulo registra o PrismaService e o disponibiliza
// para todos os outros módulos da aplicação.
//
// O decorator @Global() faz com que não seja necessário
// importar o PrismaModule em cada módulo que precisar do banco —
// basta injetar o PrismaService diretamente no construtor da classe.
// ============================================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() → torna este módulo acessível em toda a aplicação
// sem precisar importá-lo novamente em outros módulos.
@Global()
@Module({
  // providers: registra as classes que este módulo instancia e gerencia.
  // O NestJS cuida de criar e destruir o PrismaService no momento certo.
  providers: [PrismaService],

  // exports: lista o que este módulo compartilha com outros módulos.
  // Sem isso, o PrismaService ficaria "privado" dentro deste módulo.
  exports: [PrismaService],
})
export class PrismaModule {}
