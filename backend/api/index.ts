// ============================================================
// api/index.ts — Entrypoint SERVERLESS (Vercel)
// ============================================================
// O Vercel trata cada arquivo em /api como uma Serverless Function.
// Aqui criamos a app NestJS uma única vez (cache entre invocações
// "quentes") e delegamos cada request ao Express interno.
//
// IMPORTANTE: importamos de ../dist (JS já compilado pelo `nest build`)
// e NÃO de ../src. O esbuild do Vercel não emite decorator metadata,
// o que quebraria a injeção de dependências do Nest. O dist gerado pelo
// tsc já contém os metadados embutidos.
// ============================================================
import 'reflect-metadata';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppModule } = require('../dist/app.module');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyCors } = require('../dist/app.setup');

const server = express();
let bootstrapPromise: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn'],
  });
  applyCors(app);
  await app.init();
}

export default async function handler(req: any, res: any) {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap();
  }
  await bootstrapPromise;
  server(req, res);
}
