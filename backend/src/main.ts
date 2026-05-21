// ============================================================
// main.ts — Ponto de entrada da aplicação NestJS
// ============================================================
// Este é o primeiro arquivo executado quando você roda o backend.
// Ele cria o servidor HTTP, configura middlewares globais e
// define em qual porta o servidor vai escutar.
//
// Para rodar em desenvolvimento (com hot-reload):
//   node_modules/.bin/nest start --watch
// ============================================================

// Carrega as variáveis do arquivo .env para process.env
// Precisa ser a primeira linha para que DATABASE_URL, OPENAI_API_KEY etc.
// já estejam disponíveis quando os outros módulos iniciarem.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// express-session: biblioteca que cria "sessões" por navegador/cliente.
// Usamos require() em vez de import porque a tipagem do pacote
// não é compatível com import direto no TypeScript estrito.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const session = require('express-session');

async function bootstrap() {
  // Cria a aplicação NestJS usando o AppModule como raiz.
  // O NestJS vai ler o AppModule e inicializar todos os módulos,
  // serviços e controllers registrados nele.
  const app = await NestFactory.create(AppModule);

  // CORS (Cross-Origin Resource Sharing):
  // Permite que o frontend Vue (rodando em localhost:5173 durante dev
  // ou localhost:4173 no build de preview) faça requisições para este backend.
  // Sem isso, o navegador bloquearia as chamadas por segurança.
  // "credentials: true" é necessário para que os cookies de sessão
  // sejam enviados junto com as requisições do frontend.
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:4173'];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });

  // Sessão HTTP: guarda o histórico de conversa de cada usuário
  // no servidor, associado a um cookie no navegador.
  // Assim cada aba/cliente tem seu próprio histórico de conversa
  // com a IA, sem misturar conversas de usuários diferentes.
  app.use(
    session({
      // "secret" assina o cookie para evitar que alguém forje uma sessão.
      // Vem do .env; se não tiver, usa um valor padrão (só em dev).
      secret: process.env.JWT_SECRET ?? 'eduflow-secret',

      // resave: false → não salva a sessão se não houve mudança (mais eficiente)
      resave: false,

      // saveUninitialized: true → cria a sessão mesmo antes do primeiro POST
      // Necessário para que o cookie já exista desde o primeiro GET
      saveUninitialized: true,

      cookie: {
        // Sessão expira em 1 hora (em milissegundos: 60min * 60seg * 1000ms)
        maxAge: 60 * 60 * 1000,
      },
    }),
  );

  // Inicia o servidor HTTP na porta 3000.
  // Acesse em: http://localhost:3000
  await app.listen(3000);
  console.log('Backend rodando em http://localhost:3000');
}

// Chama a função principal para iniciar tudo.
// O NestJS usa async/await, então precisa de uma função assíncrona.
bootstrap();
