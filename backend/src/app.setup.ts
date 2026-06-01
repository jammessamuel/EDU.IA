import { INestApplication } from '@nestjs/common';

// CORS aplicado via middleware Express manual.
// Em vez de app.enableCors() (que tem bug com credentials no NestJS 11),
// ecoamos a origin permitida quando ela bate com a allowlist.
//
// Origens de produção vêm da env FRONTEND_URL (lista separada por vírgula),
// definida no painel do Vercel. Localhost fica sempre liberado para dev.
export function applyCors(app: INestApplication): void {
  const fromEnv = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:5174',
    ...fromEnv,
  ];

  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;

    // Permite qualquer subdomínio *.vercel.app (previews/deploys do projeto)
    const isVercelPreview = typeof origin === 'string' && origin.endsWith('.vercel.app');

    if (origin && (allowedOrigins.includes(origin) || isVercelPreview)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,Authorization');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  });
}
