// ============================================================
// app.module.ts — Módulo raiz da aplicação
// ============================================================
// No NestJS, tudo é organizado em "módulos".
// O AppModule é o módulo principal que junta todos os outros.
// Pense nele como o índice do projeto: ele lista tudo que existe
// e o NestJS usa essa lista para montar a aplicação.
//
// Estrutura de módulos atual:
//   AppModule
//   ├── ConfigModule   → lê o .env e disponibiliza as variáveis
//   ├── PrismaModule   → conexão com o banco de dados
//   └── SimulatorModule → lógica do simulador de WhatsApp + IA
// ============================================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SimulatorModule } from './simulator/simulator.module';

// O decorator @Module() transforma a classe em um módulo NestJS.
// "imports" lista os outros módulos que este módulo precisa.
@Module({
  imports: [
    // ConfigModule.forRoot() lê o arquivo .env e disponibiliza
    // as variáveis via ConfigService em qualquer lugar da aplicação.
    // "isGlobal: true" evita ter que importar o ConfigModule em
    // cada módulo individual — uma vez registrado aqui, já está disponível.
    ConfigModule.forRoot({ isGlobal: true }),

    // PrismaModule registra o PrismaService (conexão com banco).
    // Como PrismaModule é @Global(), também fica disponível
    // em todos os módulos sem precisar reimportar.
    PrismaModule,

    // SimulatorModule contém as rotas e a lógica do simulador
    // de WhatsApp com IA (os arquivos simulator.controller.ts
    // e simulator.service.ts).
    SimulatorModule,
  ],
})
export class AppModule {}
