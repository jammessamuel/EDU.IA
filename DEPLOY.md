# EDU.IA — Guia de Deploy

## O que é o projeto

EDU.IA é uma plataforma SaaS de captação de alunos para instituições de ensino.
Funciona como um atendente virtual (WhatsApp-style) que qualifica leads via IA (OpenAI)
e os organiza em um Pipeline Kanban de matrícula para o time comercial.

---

## O que já está pronto (Fase 1)

### Autenticação e multi-tenancy
- Login/registro com JWT (7 dias de validade)
- Cada escola é um tenant isolado — um usuário nunca vê dados de outra escola
- RBAC com 3 perfis: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `CONSULTANT`

### Simulador de atendimento (chat)
- Interface WhatsApp com IA (GPT-4o-mini)
- A IA coleta: curso, unidade, turno e nome do aluno — um dado por vez
- Ao completar, salva automaticamente o lead no banco

### Pipeline Kanban
- 5 colunas: Novo Lead → Em Contato → Inscrito → Matriculado → Perdido
- Botões para avançar o lead no funil ou marcá-lo como perdido
- Animação de transição entre colunas
- Navegação direta entre Simulador e Pipeline

### Infraestrutura
- Backend: **NestJS 11** + **Prisma 5** + **PostgreSQL** (Supabase)
- Frontend: **Vue 3** + **Vite** + **Naive UI** + **Pinia**
- Serverless-ready: simulador stateless (histórico vem do cliente)
- CORS configurado para produção + preview deploys do Vercel

---

## Stack e estrutura

```
EDU.IA/
├── backend/          → NestJS API (porta 3001 em dev)
│   ├── src/
│   │   ├── auth/         → login, register, logout, JWT guard
│   │   ├── common/       → decorators, guards RBAC, middleware tenant
│   │   ├── simulator/    → chat IA + CRUD de leads
│   │   ├── prisma/       → PrismaService
│   │   └── seeds/        → permissions.seed.ts (cria usuários demo)
│   ├── prisma/
│   │   └── schema.prisma → modelos: School, User, Role, Lead...
│   ├── api/
│   │   └── index.ts      → handler serverless para Vercel
│   └── vercel.json       → config do projeto backend no Vercel
│
└── frontend/         → Vue 3 + Vite (porta 5173 em dev)
    ├── src/
    │   ├── views/        → SimulatorView, KanbanView, LoginView
    │   ├── components/   → chat/*, kanban/*
    │   ├── stores/       → auth, simulator (Pinia)
    │   ├── api/          → client.ts (axios), simulator.ts
    │   └── router/       → rotas com guard de auth
    ├── .env.production   → VITE_API_URL (placeholder — definir no Vercel)
    └── vercel.json       → SPA rewrites
```

---

## Passo a passo para o deploy

### Pré-requisitos
- Conta no [Vercel](https://vercel.com) (gratuito)
- Conta no [Supabase](https://supabase.com) (gratuito)
- Chave da [OpenAI](https://platform.openai.com/api-keys)
- Node.js 20+ instalado localmente
- pnpm instalado (`npm i -g pnpm`)

---

### Passo 1 — Banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) → **New project**
   - Nome: `eduia` (ou qualquer nome)
   - Anote a senha que você definir
   - Região: South America (sa-east-1) — mais próximo do Brasil

2. Aguarde o projeto inicializar (~1 min)

3. Vá em **Settings → Database → Connection string**

4. Copie a **Transaction pooler** (porta `6543`, modo `pgbouncer`):
   ```
   postgresql://postgres.XXXX:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

5. Copie a **Direct connection** (porta `5432`):
   ```
   postgresql://postgres.XXXX:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```

6. Abra o arquivo `backend/.env` e substitua os placeholders:
   ```env
   DATABASE_URL="<cole a string do pooler aqui>"
   DIRECT_URL="<cole a string direta aqui>"
   FRONTEND_URL="https://seu-frontend.vercel.app"   ← atualizar depois
   JWT_SECRET="gere-uma-string-aleatoria-de-32-chars-aqui"
   OPENAI_API_KEY="sk-proj-..."
   ```
   > Para gerar um JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

7. Crie as tabelas no Supabase e popule os dados iniciais:
   ```bash
   cd backend
   pnpm run db:setup     # = prisma db push + os 4 seeds na ordem certa
   ```
   > `db:setup` roda `prisma db push` e depois `pnpm run seed` (verticais →
   > permissões → workspaces demo → leads demo). Se as tabelas já existem e você
   > só quer semear, rode `pnpm run seed`. (Antes o doc mandava rodar só um seed
   > a partir de `dist/seeds/...`, mas hoje o build sai em `dist/src/seeds/` e são 4.)

   Isso cria, entre outros, os logins demo:
   | E-mail | Senha | Perfil |
   |---|---|---|
   | `admin@faculdade.demo` | `Demo@1234` | SCHOOL_ADMIN (workspace Faculdade) |
   | `super@eduia.com` | `Super@1234` | SUPER_ADMIN global |

---

### Passo 2 — Deploy do backend no Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório GitHub
3. Configure (o `backend/vercel.json` já fixa Install/Build — confira o painel):
   - **Root Directory:** `backend`
   - **Framework Preset:** Other
   - **Install Command:** `pnpm install --frozen-lockfile`  ← é **pnpm**, NÃO npm!
   - **Build Command:** `pnpm run vercel-build`
   - **Output Directory:** *(deixar vazio)*

   > ⚠️ O backend usa **pnpm** (`pnpm-lock.yaml` + `.npmrc` com opções de pnpm).
   > Se o Install Command do painel ficar como `npm install --legacy-peer-deps`, o
   > build TRAVA por ~15 min e quebra com um crash interno do npm
   > (`Cannot read properties of null (reading 'isDescendantOf')`). O `vercel.json`
   > já força `pnpm install`, mas garanta que o painel não está sobrescrevendo.

4. Em **Environment Variables**, adicione:

   | Variável | Valor |
   |---|---|
   | `POSTGRES_PRISMA_URL` | **já vem da integração Supabase** (pooled/pgbouncer) — o schema lê esta |
   | `POSTGRES_URL_NON_POOLING` | **já vem da integração Supabase** (direta/5432) — usada por `db push` |
   | `OPENAI_API_KEY` | sua chave da OpenAI (`sk-...`) — **precisa setar** |
   | `JWT_SECRET` | string aleatória (`openssl rand -hex 32`) — **precisa setar (obrigatória em prod)** |
   | `CRON_SECRET` | outra string aleatória — protege a reconciliação diária de acompanhamentos |
   | `FRONTEND_URL` | URL do frontend no Vercel |

   > O banco (`POSTGRES_*`) é injetado automaticamente pela integração Supabase↔Vercel
   > — confira com `vercel env ls`. O schema lê `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`,
   > então NÃO precisa criar `DATABASE_URL`/`DIRECT_URL`. As únicas que faltam setar à mão
   > costumam ser `OPENAI_API_KEY` e `JWT_SECRET`. (NODE_ENV a Vercel já define como production.)

5. Clique em **Deploy**. Aguarde — o build demora ~2 min na primeira vez.

   O `backend/vercel.json` agenda a reconciliação todos os dias às 11:00 UTC
   (08:00 em Brasília). Com `CRON_SECRET` definido, a própria Vercel envia o
   token Bearer exigido pelo endpoint `/internal/automation/run`. No plano
   Hobby, a execução pode ocorrer dentro de uma janela flexível de até uma hora.
   O resultado fica nos Runtime Logs pelos eventos `daily_continuity.*`.

6. Anote a URL gerada (ex: `https://edu-ia-backend.vercel.app`)

---

### Passo 3 — Deploy do frontend no Vercel

1. **Add New Project** → mesmo repositório
2. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run vercel-build`  ← (`vite build`; NÃO use `npm run build`)
   - **Output Directory:** `dist`

   > O script `build` roda `vue-tsc` (type-check) antes do Vite. O
   > `vercel-build` (`vite build`)
   > não faz type-check, então o deploy passa. O `frontend/vercel.json` já fixa isso.

3. Em **Environment Variables**:

   | Variável | Valor |
   |---|---|
   | `VITE_API_URL` | URL do backend do passo 2 (ex: `https://edu-ia-backend.vercel.app`) |

4. Clique em **Deploy**.

5. Anote a URL do frontend (ex: `https://edu-ia.vercel.app`)

---

### Passo 4 — Conectar backend ao frontend

1. No projeto **backend** do Vercel → **Settings → Environment Variables**
2. Atualize `FRONTEND_URL` com a URL real do frontend do passo 3
3. Vá em **Deployments** → clique nos três pontos → **Redeploy**

---

### Passo 5 — Testar

1. Acesse a URL do frontend
2. Faça login com `admin@faculdade.demo` / `Demo@1234`
3. Envie algumas mensagens no simulador — a IA deve responder e criar leads
4. Clique em **Pipeline →** no header — os leads devem aparecer na coluna "Novo Lead"
5. Avance um lead clicando **Contato →** e depois **Inscrito →** etc.

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Build trava ~15 min e falha (`isDescendantOf`) | Install Command como `npm` num projeto pnpm | Usar `pnpm install` (o `vercel.json` já força) |
| Build falha em `prisma generate`/`nest build` | env do banco ausente ou tsconfig inválido | Conferir vars no painel; `ignoreDeprecations` já foi removido |
| Login retorna 401 | Banco não tem usuários | Rodar `pnpm run seed` (popula tudo) |
| Chat responde 503 | `OPENAI_API_KEY` ausente | Setar a chave no Vercel (o resto do app sobe normal sem ela) |
| CORS error no browser | `FRONTEND_URL` desatualizada | Atualizar no backend e redeployar |
| `prisma db push` falha | Credenciais do Supabase erradas | Verificar `DIRECT_URL` no `.env` |
| Timeout no chat (>10s) | OpenAI lento + limite free Vercel | Atualizar para Vercel Pro ou usar `maxDuration: 60` |

---

## Desenvolvimento local

O banco em dev agora é Postgres (mesma engine de produção), via docker-compose:

```bash
# 0. Sobe Postgres + Redis local (rodar na raiz do projeto)
docker compose up -d

# Backend
cd backend
pnpm install
pnpm run db:setup                      # cria as tabelas + semeia (só na 1ª vez)
node_modules/.bin/nest start --watch   # inicia em http://localhost:3001

# Frontend (outro terminal)
cd frontend
npm install
npm run dev             # inicia em http://localhost:5173
```

> Por que `nest start --watch` direto, e não `pnpm run start:dev`? No pnpm 11 o
> `pnpm run <script>` dispara um "deps check" que pode falhar no boot; chamar o
> binário do nest direto evita isso. O `backend/.env` já aponta pro Postgres do
> docker (`localhost:5432`). Login demo: `admin@faculdade.demo` / `Demo@1234`.

---

## Próximos passos (Fase 2)

- [ ] WhatsApp real via Twilio ou Evolution API
- [ ] Dashboard com métricas de conversão por curso/unidade
- [ ] Múltiplas escolas — painel super admin
- [ ] Notificações em tempo real (WebSocket) quando um novo lead chega
- [ ] Exportar leads para CSV/Excel
