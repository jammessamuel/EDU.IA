// ============================================================
// api/index.ts — Entrypoint SERVERLESS (Vercel)
// ============================================================
// IMPORTANTE: importo de ../dist (JS já compilado pelo `nest build`),
// NÃO de ../src. Motivo: a Vercel empacota esta função com o @vercel/node
// (esbuild), que NÃO emite os metadados de decorator (emitDecoratorMetadata).
// Sem esses metadados a injeção de dependência do NestJS quebra em produção
// ("Nest can't resolve dependencies of ..."). O `tsc` (nest build) emite os
// metadados certinho, então eu aponto para o resultado dele. O `vercel-build`
// (prisma generate && nest build) gera o dist ANTES desta função ser empacotada.
// ============================================================
import 'reflect-metadata';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../dist/src/app.module';
import { applyCors } from '../dist/src/app.setup';

const server = express();

// Reaproveito o mesmo boot entre invocações "quentes" do mesmo container
// (Fluid Compute reusa instâncias) — criar o NestApp a cada request seria caro.
let bootstrapPromise: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  applyCors(app);
  await app.init();
}

export default async function handler(req: any, res: any) {
  try {
    if (!bootstrapPromise) {
      bootstrapPromise = bootstrap();
    }
    await bootstrapPromise;
  } catch (err) {
    // Se o boot falhar (ex.: banco fora do ar), zero a promise para a PRÓXIMA
    // invocação tentar de novo. Sem isso, um único cold start ruim deixaria a
    // promise rejeitada "grudada" e o container responderia erro para sempre,
    // até ser reciclado.
    bootstrapPromise = null;
    console.error('[api] Falha ao inicializar o NestJS:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ statusCode: 500, message: 'Erro ao inicializar o servidor.' }));
    return;
  }
  server(req, res);
}
