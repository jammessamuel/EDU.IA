// ============================================================
// main.ts — Ponto de entrada para DESENVOLVIMENTO LOCAL
// ============================================================
// Em produção (Vercel) o entrypoint é api/index.ts (serverless).
// Este arquivo só é usado quando você roda localmente:
//   node_modules/.bin/nest start --watch
// ============================================================

import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyCors } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS compartilhado com o handler serverless.
  applyCors(app);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend rodando em http://localhost:${port}`);
}

bootstrap();
