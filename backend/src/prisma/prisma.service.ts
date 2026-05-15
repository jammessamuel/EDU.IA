// ============================================================
// prisma.service.ts — Serviço de conexão com o banco de dados
// ============================================================
// O PrismaService é a ponte entre o código TypeScript e o
// PostgreSQL. Ele herda todas as capacidades do PrismaClient
// (queries, criação, atualização, deleção de registros) e
// adiciona os hooks de ciclo de vida do NestJS.
//
// Como usar em outros serviços:
//   constructor(private prisma: PrismaService) {}
//
//   // Buscar todos os leads:
//   const leads = await this.prisma.lead.findMany();
//
//   // Criar um lead:
//   const lead = await this.prisma.lead.create({ data: { ... } });
// ============================================================

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// @Injectable() → marca a classe como um "serviço" do NestJS.
// Isso permite que ela seja injetada (recebida no construtor)
// em outros serviços e controllers automaticamente.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // OnModuleInit: interface do NestJS que define um método
  // executado automaticamente quando o módulo é inicializado.
  // Usamos para abrir a conexão com o banco assim que o servidor sobe.
  async onModuleInit() {
    await this.$connect();
  }

  // OnModuleDestroy: executado quando o servidor está desligando.
  // Fecha a conexão com o banco de forma limpa, evitando
  // conexões "penduradas" no PostgreSQL.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
