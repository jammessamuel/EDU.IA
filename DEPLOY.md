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

7. Crie as tabelas no Supabase:
   ```bash
   cd backend
   pnpm exec prisma db push
   ```

8. Popule os dados iniciais (permissões + usuários demo):
   ```bash
   pnpm run build
   node dist/seeds/permissions.seed.js
   ```

   Isso cria:
   | E-mail | Senha | Perfil |
   |---|---|---|
   | `admin@demo.edu` | `Admin@1234` | SCHOOL_ADMIN da escola demo |
   | `super@eduia.com` | `Super@1234` | SUPER_ADMIN global |

---

### Passo 2 — Deploy do backend no Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório GitHub
3. Configure:
   - **Root Directory:** `backend`
   - **Framework Preset:** Other
   - **Build Command:** `npm run vercel-build`
   - **Output Directory:** *(deixar vazio)*

4. Em **Environment Variables**, adicione:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | string pooler do Supabase (porta 6543) |
   | `DIRECT_URL` | string direta do Supabase (porta 5432) |
   | `OPENAI_API_KEY` | sua chave da OpenAI |
   | `JWT_SECRET` | string aleatória longa (mín 32 chars) |
   | `FRONTEND_URL` | URL do frontend no Vercel (definir depois do passo 3) |
   | `NODE_ENV` | `production` |

5. Clique em **Deploy**. Aguarde — o build demora ~2 min na primeira vez.

6. Anote a URL gerada (ex: `https://edu-ia-backend.vercel.app`)

---

### Passo 3 — Deploy do frontend no Vercel

1. **Add New Project** → mesmo repositório
2. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

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
2. Faça login com `admin@demo.edu` / `Admin@1234`
3. Envie algumas mensagens no simulador — a IA deve responder e criar leads
4. Clique em **Pipeline →** no header — os leads devem aparecer na coluna "Novo Lead"
5. Avance um lead clicando **Contato →** e depois **Inscrito →** etc.

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Login retorna 401 | Banco não tem usuários | Rodar `node dist/seeds/permissions.seed.js` |
| Chat não responde | `OPENAI_API_KEY` errada ou vazia | Verificar a variável no Vercel |
| CORS error no browser | `FRONTEND_URL` desatualizada | Atualizar no backend e redeployar |
| `prisma db push` falha | Credenciais do Supabase erradas | Verificar `DIRECT_URL` no `.env` |
| Timeout no chat (>10s) | OpenAI lento + limite free Vercel | Atualizar para Vercel Pro ou usar `maxDuration: 60` |

---

## Desenvolvimento local

```bash
# Backend
cd backend
pnpm install
pnpm run start:dev      # inicia em http://localhost:3001

# Frontend (outro terminal)
cd frontend
npm install
npm run dev             # inicia em http://localhost:5173
```

O arquivo `backend/.env` já contém as variáveis necessárias para dev local
(incluindo a conexão com Supabase — use o mesmo banco ou crie um schema separado).

---

## Próximos passos (Fase 2)

- [ ] WhatsApp real via Twilio ou Evolution API
- [ ] Dashboard com métricas de conversão por curso/unidade
- [ ] Múltiplas escolas — painel super admin
- [ ] Notificações em tempo real (WebSocket) quando um novo lead chega
- [ ] Exportar leads para CSV/Excel
