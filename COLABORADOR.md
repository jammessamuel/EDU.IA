# SDR.IA — Documento Técnico para o Colaborador

**Data:** Junho 2026  
**Repositório:** https://github.com/jammessamuel/EDU.IA  
**Branch principal:** `main`

---

## 1. O que é o projeto

**SDR.IA** é uma plataforma SaaS que transforma qualquer negócio em um atendente virtual de IA no WhatsApp, capaz de qualificar leads automaticamente e organizar o time comercial.

O diferencial central é: **a IA conversa de forma natural com o cliente, coleta os dados necessários sozinha, cria o lead automaticamente e o joga no pipeline do funil de vendas** — sem script fixo, sem formulário, sem depender de uma pessoa respondendo.

A plataforma é **multi-vertical**: ao criar conta, o usuário escolhe seu setor (Educação, Advocacia, Imobiliária, Saúde, Vendas). A partir daí, tudo muda automaticamente — perguntas da IA, campos do lead, etapas do pipeline, cores do sistema.

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11 + TypeScript |
| ORM | Prisma 5 |
| Banco (dev) | SQLite (`backend/prisma/dev.db`) |
| Banco (prod) | PostgreSQL via Supabase |
| IA | OpenAI GPT-4o-mini |
| Frontend | Vue 3 + Vite + TypeScript |
| UI | Naive UI |
| Estado | Pinia |
| Roteamento | Vue Router 4 |
| HTTP | Axios |
| Deploy | Vercel (frontend + backend serverless) |
| Gerenciador de pacotes | pnpm (backend) / npm (frontend) |

---

## 3. Estrutura do projeto

```
SDR.IA/
├── backend/                    ← API NestJS
│   ├── src/
│   │   ├── auth/               ← Login, registro, JWT, logout
│   │   ├── common/             ← Guards RBAC, decorators, middleware multi-tenant
│   │   ├── prisma/             ← PrismaService
│   │   ├── simulator/          ← Chat IA + CRUD de leads + métricas + settings
│   │   ├── vertical/           ← Listagem de verticals disponíveis
│   │   ├── seeds/              ← Scripts de seed (permissões, verticals, leads demo)
│   │   ├── app.module.ts
│   │   ├── app.setup.ts        ← Configuração de CORS
│   │   └── main.ts             ← Entrypoint local (dev)
│   ├── api/
│   │   └── index.ts            ← Entrypoint serverless (Vercel)
│   ├── prisma/
│   │   └── schema.prisma       ← Modelos do banco de dados
│   └── vercel.json             ← Config de deploy do backend no Vercel
│
├── frontend/                   ← App Vue 3
│   ├── src/
│   │   ├── views/              ← Páginas: Login, Simulator, Kanban, Dashboard, Settings, WhatsApp
│   │   ├── components/
│   │   │   ├── chat/           ← ChatHeader, ChatMessages, ChatInput, QuickReplies, Bubbles
│   │   │   ├── kanban/         ← KanbanCard
│   │   │   ├── leads/          ← LeadCard
│   │   │   └── layout/         ← AppNav (topbar compartilhado)
│   │   ├── stores/             ← Pinia: auth, simulator, workspace
│   │   ├── composables/        ← useQuickReplies
│   │   ├── api/                ← client.ts (axios), simulator.ts
│   │   ├── types/              ← Interfaces TypeScript
│   │   └── router/             ← Rotas com guard de autenticação
│   └── vercel.json             ← Config de deploy do frontend no Vercel
│
├── DEPLOY.md                   ← Guia completo de deploy (Vercel + Supabase)
├── ROADMAP.md                  ← Visão comercial + próximos passos
└── COLABORADOR.md              ← Este arquivo
```

---

## 4. Como rodar localmente

### Pré-requisitos
- Node.js 20+
- pnpm (`npm i -g pnpm`)
- Chave da OpenAI API

### Backend

```bash
cd backend

# Instalar dependências
pnpm install

# Criar banco e aplicar schema
pnpm exec prisma db push --force-reset

# Popular dados iniciais (permissões + roles)
pnpm exec ts-node -r tsconfig-paths/register src/seeds/permissions.seed.ts

# Popular os 5 verticals
pnpm exec ts-node -r tsconfig-paths/register src/seeds/verticals.seed.ts

# Popular workspaces demo (5 contas prontas para teste)
pnpm exec ts-node -r tsconfig-paths/register src/seeds/demo-workspaces.seed.ts

# Rodar em modo dev (hot reload)
pnpm run start:dev
```

Servidor sobe em: **http://localhost:3001**

### Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Rodar em modo dev
npm run dev
```

Frontend sobe em: **http://localhost:5173**

### Variáveis de ambiente (backend/.env)

```env
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-proj-..."
JWT_SECRET="qualquer-string-longa-aqui"
FRONTEND_URL="http://localhost:5173"
```

---

## 5. Contas de teste

Todas as senhas: **`Demo@1234`**

| Setor | Email | Cor | Pipeline |
|-------|-------|-----|---------|
| 🎓 Educação | `admin@faculdade.demo` | Verde | Novo → Contato → Inscrito → Matriculado |
| ⚖️ Advocacia | `admin@advocacia.demo` | Azul escuro | Novo → Análise → Proposta → Contratado |
| 🏠 Imobiliária | `admin@imobiliaria.demo` | Laranja | Novo → Interesse → Visita → Proposta → Fechado |
| 🏥 Saúde | `admin@clinica.demo` | Rosa | Novo → Agendado → Confirmado → Atendido |
| 🛒 Vendas | `admin@vendas.demo` | Âmbar | Novo → Interesse → Proposta → Negociação → Fechado |

Conta admin geral: `admin@demo.edu` / `Admin@1234`

---

## 6. Funcionalidades implementadas

### Autenticação e segurança
- JWT com expiração de 7 dias
- `tokenVersion` para logout forçado (invalida tokens antigos)
- RBAC com roles: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `CONSULTANT`
- Multi-tenancy: cada workspace é isolado — um usuário nunca vê dados de outro
- Guard de rota no frontend (redireciona para /login se não autenticado)

### Sistema de verticals
- 5 verticals pré-configurados com prompt, campos e pipeline próprios
- Cada workspace escolhe seu vertical no cadastro (obrigatório)
- Todo o sistema adapta automaticamente: IA, pipeline, campos, cores, textos
- Admin pode customizar as opções dos campos de seleção em Configurações

### Chat com IA (Simulador)
- Interface WhatsApp com histórico de mensagens
- IA pergunta UMA coisa por vez, em português natural
- Quando coleta todos os campos obrigatórios, salva o lead automaticamente
- **Quick replies**: botões de resposta rápida aparecem para campos de seleção
- Stateless: histórico enviado pelo frontend (funciona em serverless)

### WhatsApp simulado
- 5 conversas pré-carregadas por vertical (linguagem e contexto específicos)
- 4 conversas com ciclo completo (lead qualificado em diferentes etapas)
- 1 conversa em andamento (usuário pode continuar interagindo com a IA)
- Quick replies funcionam nas conversas abertas
- Painel lateral mostra perfil do lead com campos do vertical

### Pipeline Kanban
- Colunas dinâmicas vindas do vertical (não hardcoded)
- Cards com campos dinâmicos do lead (`lead.data`)
- Avançar lead no funil com um clique
- Marcar lead como perdido
- Alerta visual (banner + borda vermelha) para leads parados há mais de 24h
- Animação de transição entre colunas

### Dashboard
- 4 cards de métricas: total de leads, convertidos, taxa de conversão, perdidos
- Funil de conversão por etapa
- Leads por campo principal (ex: por curso, por área do direito)
- Série histórica dos últimos 14 dias

### Exportar CSV
- Botão no Kanban que baixa todos os leads em `.csv`
- Separador `;` (compatível com Excel Brasil)
- BOM UTF-8 para acentos funcionarem corretamente

### Configurações do workspace
- Editar nome do negócio e nome do atendente virtual
- Adicionar/remover opções dos campos de seleção do vertical
- Visualizar etapas do pipeline

---

## 7. Arquitetura do backend

### Multi-tenancy
Toda requisição autenticada passa por:
1. **TenantMiddleware** — resolve o `schoolId` pelo header `X-School-Id` (dev) ou subdomínio (prod)
2. **JwtAuthGuard** — valida o token JWT e popula `req.user` com `schoolId`
3. **RbacGuard** — verifica permissões via `@RequirePermission('resource:action:scope')`

Todos os endpoints de dados usam `user.schoolId` do JWT para filtrar — nunca dados de outros workspaces aparecem.

### Sistema de verticals (schema)
```
Vertical
  slug, name, icon, color
  promptTemplate     ← template com {{workspaceName}}, {{fieldDescriptions}}
  defaultFields      ← JSON: [{name, label, type, options[], required, order}]
  defaultStages      ← JSON: [{key, label, color}]
  extractionPrompt   ← instrução para a IA extrair os campos do lead

School (Workspace)
  verticalId         ← FK para Vertical
  customFields       ← JSON (null = usa defaultFields do vertical)
  customStages       ← JSON (null = usa defaultStages do vertical)
  chatbotName        ← nome do atendente virtual

Lead
  name               ← nome sempre extraído
  data               ← JSON com campos específicos do vertical
  status             ← chave da etapa do pipeline
  qualified          ← true quando todos os campos foram coletados
```

### Fluxo do chat com IA
```
POST /simulator/messages { text, history[] }
  1. Carrega escola + vertical do banco
  2. Monta system prompt dinâmico (template + campos do vertical)
  3. Chama OpenAI GPT-4o-mini com histórico (máx 14 mensagens)
  4. Tenta extração de lead via segunda chamada à OpenAI
  5. Se qualificado → salva Lead no banco com data JSON
  6. Retorna { reply, lead }
```

### Endpoints principais
```
AUTH
  POST /auth/register     → cria workspace + usuário (requer verticalId)
  POST /auth/login        → autentica, retorna JWT
  GET  /auth/me           → dados do usuário atual
  POST /auth/logout       → invalida token (incrementa tokenVersion)

VERTICALS (público)
  GET  /verticals         → lista todos os verticals
  GET  /verticals/:slug   → detalhe de um vertical

SIMULATOR (requer auth)
  POST /simulator/messages          → chat com IA
  GET  /simulator/leads             → lista leads do workspace
  GET  /simulator/metrics           → métricas do dashboard
  GET  /simulator/leads/stale       → leads parados há +24h
  PATCH /simulator/leads/:id/status → avançar lead no funil
  GET  /simulator/school/settings   → config do workspace
  PUT  /simulator/school/settings   → salvar config
```

---

## 8. Arquitetura do frontend

### Stores (Pinia)
| Store | Responsabilidade |
|-------|-----------------|
| `auth` | token JWT, dados do usuário, login/logout/register |
| `simulator` | mensagens do chat, leads capturados, sendMessage, fetchLeads |
| `workspace` | vertical ativo, fields, stages, brandColor — carregado uma vez após login |

### AppNav
Componente de navegação compartilhado por todas as telas. Usa `ws.brandColor` como CSS variable `--brand` para colorir o logo e os links ativos conforme o vertical do workspace logado.

### Quick replies
O composable `useQuickReplies(messages, isTyping)` analisa o histórico de mensagens:
- Conta quantas mensagens a IA enviou (excluindo a saudação)
- Mapeia para o índice do campo do vertical
- Se esse campo for do tipo `select`, retorna suas opções como botões

---

## 9. O que falta implementar (próxima sprint)

### Alta prioridade (sem isso não vende)

**1. WhatsApp real — Evolution API** (2-3 dias)
- Subir instância do Evolution API em um VPS
- Criar webhook: mensagem recebida → POST `/simulator/messages`
- Backend responde → Evolution API envia de volta ao número do cliente
- Não precisa de conta Business verificada — conecta via QR code

**2. Configuração dinâmica por workspace** (1 dia)
- O system prompt ainda usa nome fixo do workspace
- Tela de onboarding mais completa ao criar conta
- Testar cada vertical com o chatbot real

### Média prioridade (diferencia do concorrente)

**3. Notificações em tempo real** (1 dia)
- WebSocket com `@nestjs/websockets`
- Badge no menu quando novo lead chega
- Som opcional de notificação

**4. Multi-atendente** (2 dias)
- Campo `assignedTo` no Lead (FK para User)
- Filtro "Meus leads" vs "Todos"
- Atribuir lead a um consultor no card do Kanban

**5. Follow-up automático** (1 dia após WhatsApp real)
- Cron job (`@nestjs/schedule`)
- Leads em primeiro status há mais de 24h → IA manda mensagem de reengajamento

### Quando tiver clientes

**6. Painel Super Admin** — ver todos os workspaces, MRR  
**7. Formulário embutível** — widget para o site do cliente  
**8. Relatório de performance** — tempo médio de resposta, taxa por consultor

---

## 10. Deploy (quando estiver pronto)

Ver arquivo `DEPLOY.md` na raiz do projeto. Resumo:

1. **Banco:** criar projeto no [supabase.com](https://supabase.com), pegar connection strings, rodar `prisma db push` e os seeds
2. **Backend:** novo projeto no Vercel → root dir `backend` → build command `npm run vercel-build` → setar env vars
3. **Frontend:** novo projeto no Vercel → root dir `frontend` → setar `VITE_API_URL` com URL do backend

---

## 11. Observações importantes

- O arquivo `.env` **não vai para o git** (está no `.gitignore`). Cada dev precisa criar o seu próprio com as credenciais
- A chave da OpenAI no `.env` local é para desenvolvimento. Em produção, colocar no painel do Vercel
- O banco de dev é SQLite (arquivo local). O banco de produção é PostgreSQL no Supabase — o schema já está configurado para ambos, basta mudar o `provider` e a `DATABASE_URL`
- Ao mudar o schema Prisma, rodar `pnpm exec prisma db push` no dev. Em produção usar `prisma migrate deploy`
- Para resetar o banco local e recriar tudo do zero: `pnpm exec prisma db push --force-reset` + rodar os 3 seeds na ordem: permissions → verticals → demo-workspaces

---

## 12. Contato e referências

- Repositório: https://github.com/jammessamuel/EDU.IA
- Evolution API (WhatsApp): https://evolution-api.com
- Supabase (banco prod): https://supabase.com
- Vercel (deploy): https://vercel.com
- OpenAI (IA): https://platform.openai.com
