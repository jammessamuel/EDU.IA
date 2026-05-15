# Plataforma SaaS EdTech — Arquitetura Técnica Completa
> Documento de arquitetura para construção de SaaS educacional multi-tenant focado em WhatsApp, CRM, IA SDR, automação comercial e integração acadêmica.
>
> **Stack:** NestJS · TypeScript · Prisma · PostgreSQL · Vue 3 · Tailwind · Redis · BullMQ · OpenAI · WhatsApp Cloud API
>
> **Nome de trabalho:** `EduFlow` (substituir pelo nome final do produto)

---

## Sumário
1. [Documento MVP — Passo 1](#1-documento-mvp--passo-1)
2. [Princípios de Arquitetura](#2-princípios-de-arquitetura)
3. [Visão de Alto Nível](#3-visão-de-alto-nível)
4. [Estratégia Multi-Tenant](#4-estratégia-multi-tenant)
5. [Estrutura de Módulos (NestJS)](#5-estrutura-de-módulos-nestjs)
6. [Estrutura de Pastas](#6-estrutura-de-pastas)
7. [Modelagem de Banco — Prisma Schema](#7-modelagem-de-banco--prisma-schema)
8. [Integração WhatsApp Cloud API](#8-integração-whatsapp-cloud-api)
9. [Integração OpenAI e Agente IA SDR](#9-integração-openai-e-agente-ia-sdr)
10. [Controle de Custos de Tokens](#10-controle-de-custos-de-tokens)
11. [Filas, Workers e Automação (BullMQ)](#11-filas-workers-e-automação-bullmq)
12. [APIs RESTful — Contratos](#12-apis-restful--contratos)
13. [Exemplos de Código — NestJS](#13-exemplos-de-código--nestjs)
14. [Exemplos de Código — Vue 3](#14-exemplos-de-código--vue-3)
15. [Segurança](#15-segurança)
16. [Escalabilidade](#16-escalabilidade)
17. [Arquitetura Cloud](#17-arquitetura-cloud)
18. [Roadmap em 4 Fases](#18-roadmap-em-4-fases)
19. [Backlog Técnico do MVP](#19-backlog-técnico-do-mvp)

---

## 1. Documento MVP — Passo 1

### 1.1 Quem é o usuário?

Três personas no MVP, com prioridades claras:

**P1 — Atendente comercial (usuário principal e mais frequente)**
- Responsável: receber leads, conversar, qualificar, registrar matrícula.
- Dor: troca de contexto entre WhatsApp pessoal, planilha e sistema acadêmico; perde leads por demora.
- Sucesso: ver tudo em uma tela, responder rápido, deixar a IA tratar o trivial.

**P2 — Gestor da escola (decisor de compra, usuário esporádico)**
- Responsável: contratar o SaaS, acompanhar funil, cobrar resultado.
- Dor: não sabe quantos leads chegaram, de onde vieram, taxa de conversão real.
- Sucesso: dashboard com funil, origem do lead, conversão, tempo de resposta.

**P3 — Aluno/lead (usuário indireto, no WhatsApp)**
- Responsável: tirar dúvida, se interessar, decidir matrícula.
- Dor: demora resposta, fica sem informação, desiste.
- Sucesso: respondido em segundos, fluxo claro até a pré-matrícula sem precisar baixar nada.

> **Decisão:** o produto se vende para o gestor (P2), mas é usado todos os dias pelo atendente (P1). A UI da plataforma é otimizada para P1; relatórios e métricas para P2. P3 nunca abre a plataforma — ele só vê o WhatsApp.

### 1.2 Qual dor vamos resolver primeiro?

Hierarquia de dor, da mais urgente para a menos:

1. **Lead chega no WhatsApp e demora horas para ser respondido** → IA SDR responde em segundos, 24/7.
2. **Atendente copia nome/CPF/curso manualmente para a planilha** → IA extrai dado da conversa e cria lead automaticamente.
3. **Não existe follow-up estruturado** → sistema agenda mensagens de retomada (1h, 24h, 72h, 7d).
4. **Matrícula demora porque é em outro sistema** → pré-matrícula coletada via WhatsApp, dados prontos para envio ao sistema acadêmico.
5. **Gestor não enxerga o funil** → CRM com pipeline visível.

> **Não resolvemos no MVP:** financeiro, boleto, marketing outbound, campanhas em massa, multi-unidade complexa, app mobile.

### 1.3 Qual fluxo vamos provar?

```
Aluno envia mensagem no WhatsApp da escola
            │
            ▼
WhatsApp Cloud API → Webhook EduFlow
            │
            ▼
Sistema identifica/cria Lead + Conversation
            │
            ▼
IA SDR lê histórico + mensagem → decide ação
            │
            ├─► Responder com pergunta de qualificação
            │   (curso, unidade, turno, idade, CPF)
            │
            ├─► Atualizar dados do lead (extração estruturada)
            │
            ├─► Calcular lead score
            │
            ├─► Se "quente" → criar pré-matrícula e notificar humano
            │
            └─► Se humano já assumiu → não responder, só registrar
            │
            ▼
Pré-matrícula gerada com dados estruturados
            │
            ▼
Atendente revisa, confirma, envia para sistema acadêmico
```

**Critério de "sucesso do fluxo" no MVP:** 70% das conversas chegam a `lead.qualified = true` sem intervenção humana, e 30% delas chegam a `pre_enrollment.created`.

### 1.4 O que entra na primeira versão?

| Funcionalidade | Detalhe | Por que entra |
|---|---|---|
| Login + multi-tenant básico | Email/senha, JWT, `school_id` em tudo | Sem isso não há produto vendável |
| Cadastro de leads | CRUD + importação CSV | Carregar base existente do cliente |
| Tela de conversas | Inbox estilo WhatsApp Web | UI principal do atendente |
| Funil CRM | Kanban com etapas configuráveis | Visão do gestor |
| Simulador de WhatsApp | Tela de teste sem precisar conectar número real | Onboarding, demo, vendas |
| IA SDR básica | Agente com prompt configurável por escola | Diferencial central |
| Pré-matrícula | Form estruturado + checklist de docs | Conversão real |
| Follow-up automático simples | 3 templates: 1h, 24h (dentro da janela WA), 72h com verificação de janela | Recupera 20-30% dos leads |

### 1.5 O que fica para depois?

- WhatsApp Business API com número oficial verificado (no MVP: WhatsApp Cloud API com número de teste ou número da escola via verificação Meta).
- Templates aprovados Meta para mensagens além de 24h (Fase 2).
- Financeiro, boleto, split de pagamento.
- App mobile nativo (PWA do painel já resolve no MVP).
- Marketing outbound (disparo em massa, campanhas).
- Microcertificações, trilhas, marketplace.
- Multi-unidade avançada com permissões granulares por departamento.
- Integração com ERPs acadêmicos (Sponte, TOTVS, Lyceum): no MVP exportamos CSV/JSON, integração nativa fica para fase Scale.

---

## 2. Princípios de Arquitetura

Decisões que valem para todo o produto e não devem ser revisitadas a cada feature:

1. **Multi-tenant desde o dia 1.** Toda tabela tem `school_id`. Todo query passa por middleware que injeta filtro. Sem exceções.
2. **Eventos + filas, não chamadas síncronas longas.** Qualquer operação > 200ms ou que depende de terceiro vai para fila.
3. **IA é um serviço, não um framework.** Encapsular OpenAI em um módulo `AiModule` com interface estável. Trocar de modelo (ou de provedor) não pode quebrar o resto.
4. **WhatsApp é apenas um canal.** Modelar `Channel` abstrato; WhatsApp Cloud é a primeira implementação. Instagram DM, webchat, e-mail entram depois sem refactor.
5. **Soft delete em tudo que é lead/conversa/mensagem.** Auditoria e LGPD.
6. **Idempotência em webhooks.** Meta reenvia eventos; processar duas vezes não pode duplicar lead.
7. **Observabilidade > log.** Estruturado (JSON), com `trace_id`, `school_id`, `lead_id` em todo log.
8. **TypeScript estrito.** `strict: true`, `noImplicitAny`, `strictNullChecks`. DTOs validados com `class-validator`.
9. **Janela de 24h é uma restrição de negócio, não detalhe de infra.** Todo follow-up verifica se a janela está aberta antes de enviar. Mensagens fora da janela só via template aprovado Meta.

---

## 3. Visão de Alto Nível

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENTES                                    │
│  Painel Web (Vue 3) · WhatsApp do Lead · Webhook Meta · Site/Forms      │
└──────────────────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY / LOAD BALANCER                        │
│                    (CloudFront + ALB / Nginx)                            │
└──────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       BACKEND NestJS (Monolito Modular)                  │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Auth    │ │ Tenants  │ │  Leads   │ │   CRM    │ │ Conversations│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ AI-SDR   │ │ WhatsApp │ │ Webhooks │ │  Queues  │ │ PreEnrollment│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│                                                                          │
│  Realtime: Socket.IO com rooms por escola (school:{id})                  │
└──────────────────────────────────────────────────────────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐    ┌──────────┐    ┌──────────┐
   │PostgreSQL│  │  Redis  │    │ OpenAI   │    │ Meta WA  │
   │ (Prisma)│   │ (Bull,  │    │ (LLM,    │    │ Cloud API│
   │         │   │  cache, │    │  Whisper)│    │          │
   │         │   │  pub/sub)   └──────────┘    └──────────┘
   └─────────┘   └─────────┘
        │
        ▼
   ┌─────────────────────────────────────────┐
   │  S3 (mídia: áudio, imagem, documento)   │
   └─────────────────────────────────────────┘
```

**Por que monolito modular (não microsserviços) no MVP:**
- 1 deploy, 1 banco, 1 contexto de transação → velocidade de iteração.
- Módulos bem isolados permitem extrair microserviço quando uma fronteira justificar (ex: `ai-sdr` ou `whatsapp-gateway` viram serviços próprios na fase Scale).
- Microsserviço prematuro é a forma mais cara de destruir uma startup.

---

## 4. Estratégia Multi-Tenant

**Modelo adotado: Shared Database, Shared Schema com `school_id` (Discriminator Column).**

| Modelo | Custo | Isolamento | Operação | Decisão |
|---|---|---|---|---|
| DB por tenant | Alto | Máximo | Pesado | ❌ |
| Schema por tenant | Médio | Alto | Médio | ❌ MVP, ✅ Enterprise futuro |
| Row-level (`school_id`) | Baixo | Médio | Leve | ✅ MVP/Scale |

**Como garantir isolamento sem depender da memória do desenvolvedor:**

1. **Prisma `$extends`** (Prisma 5+) que injeta `where: { schoolId }` em todo find/update/delete.
2. **JWT contém `school_id`** e é colocado em `AsyncLocalStorage` no início da request.
3. **Repositórios não recebem `schoolId` como parâmetro** — ele vem do contexto. Impossível esquecer.
4. **PostgreSQL Row-Level Security (RLS)** habilitado como segunda camada de defesa. Mesmo se o Prisma falhar, o banco bloqueia.

```sql
-- Exemplo de RLS no Postgres
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING (school_id = current_setting('app.current_school_id')::uuid);
```

```typescript
// Antes de cada query, o middleware faz:
await prisma.$executeRawUnsafe(
  `SET LOCAL app.current_school_id = '${schoolId}'`
);
```

**Quando migrar para schema-per-tenant?**
- Cliente Enterprise exige isolamento físico (contrato, LGPD reforçada).
- Escola passa de ~1M de mensagens/mês e precisa de tuning isolado.
- Compliance específico (rede pública de ensino, etc.).

---

## 5. Estrutura de Módulos (NestJS)

Cada módulo é um **bounded context**. Comunicação entre módulos por evento (EventEmitter2) ou por interface pública (`*.service.ts`), nunca acessando repositório alheio.

```
AuthModule          → login, JWT, refresh, RBAC
TenantsModule       → schools, planos, billing (stub no MVP)
UsersModule         → atendentes, gestores, permissões
LeadsModule         → CRUD lead, lead score, tags
PipelinesModule     → funis, etapas, kanban
ConversationsModule → threads, mensagens, anexos
ChannelsModule      → abstração de canal (WA, IG, web)
WhatsAppModule      → adapter WhatsApp Cloud API + webhook + status de entrega
AiSdrModule         → orquestrador do agente (prompt, decisão, action, compressão de histórico)
OpenAiModule        → cliente low-level: chat, embed, whisper, vision
PreEnrollmentModule → formulário, validação, exportação, documentos (tabela dedicada)
FollowUpModule      → cadências, regras, scheduler, verificação de janela 24h
WebhooksModule      → recebe eventos externos
QueueModule         → BullMQ producers/consumers
RealtimeModule      → Socket.IO gateway com rooms por escola
NotificationsModule → push web, e-mail interno
SupportModule       → tickets pós-venda, categorias, roteamento por setor
TicketsModule       → CRUD ticket, histórico, status, integração com helpdesk
AuditModule         → log de ações (LGPD)
HealthModule        → liveness, readiness
```

---

## 6. Estrutura de Pastas

### Backend

```
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/         # @CurrentUser, @CurrentSchool, @Public
│   │   ├── guards/             # JwtAuthGuard, RolesGuard, TenantGuard
│   │   ├── interceptors/       # LoggingInterceptor, TimeoutInterceptor
│   │   ├── filters/            # AllExceptionsFilter
│   │   ├── pipes/              # ZodValidationPipe
│   │   ├── context/            # AsyncLocalStorage (school context)
│   │   └── dto/                # PaginationDto, etc.
│   ├── config/
│   │   ├── env.validation.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── openai.config.ts
│   ├── infra/
│   │   ├── prisma/             # PrismaService + $extends multi-tenant (Prisma 5+)
│   │   ├── redis/
│   │   ├── queue/              # BullMQ setup
│   │   ├── storage/            # S3 client
│   │   └── realtime/           # Socket.IO gateway com rooms por escola
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── strategies/
│       │   ├── dto/
│       │   └── tests/
│       ├── tenants/
│       ├── users/
│       ├── leads/
│       ├── pipelines/
│       ├── conversations/
│       ├── channels/
│       ├── whatsapp/
│       │   ├── whatsapp.controller.ts      # webhook
│       │   ├── whatsapp.service.ts         # send message
│       │   ├── whatsapp-webhook.handler.ts
│       │   ├── whatsapp-status.processor.ts # processa delivered/read/failed
│       │   └── dto/
│       ├── ai-sdr/
│       │   ├── ai-sdr.service.ts           # orquestrador
│       │   ├── history-compressor.ts       # comprime histórico longo
│       │   ├── prompts/                    # templates de prompt
│       │   ├── tools/                      # function calling
│       │   └── agents/
│       ├── openai/
│       │   ├── openai.service.ts
│       │   ├── token-counter.ts
│       │   └── cost-tracker.ts
│       ├── pre-enrollment/
│       ├── follow-up/
│       │   ├── follow-up.service.ts
│       │   ├── follow-up.processor.ts      # verifica janela 24h antes de enviar
│       │   └── whatsapp-window.helper.ts   # helper: está dentro da janela?
│       ├── support/
│       │   ├── support.module.ts
│       │   ├── support.service.ts          # identifica aluno, abre/roteia ticket
│       │   ├── tickets.controller.ts
│       │   ├── tickets.service.ts
│       │   ├── conversation-router.ts      # decide: fluxo SDR ou fluxo Suporte
│       │   └── dto/
│       ├── webhooks/
│       └── health/
├── test/
├── .env.example
├── docker-compose.yml          # dev local
├── Dockerfile
├── package.json
├── tsconfig.json
└── nest-cli.json
```

### Frontend

```
frontend/
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   │   └── index.ts
│   ├── stores/                 # Pinia
│   │   ├── auth.store.ts
│   │   ├── leads.store.ts
│   │   ├── conversations.store.ts
│   │   └── pipeline.store.ts
│   ├── api/                    # Axios clients tipados
│   │   ├── client.ts
│   │   ├── leads.api.ts
│   │   ├── conversations.api.ts
│   │   └── auth.api.ts
│   ├── composables/
│   │   ├── useSocket.ts
│   │   ├── useToast.ts
│   │   └── useLeadScore.ts
│   ├── components/
│   │   ├── ui/                 # Button, Input, Modal, Drawer
│   │   ├── inbox/              # ConversationList, MessageThread, Composer
│   │   ├── leads/              # LeadCard, LeadDrawer, LeadForm
│   │   ├── pipeline/           # KanbanBoard, StageColumn, LeadCard
│   │   └── layout/             # Sidebar, Topbar
│   ├── pages/
│   │   ├── Login.vue
│   │   ├── Dashboard.vue
│   │   ├── Inbox.vue
│   │   ├── Leads.vue
│   │   ├── Pipeline.vue
│   │   ├── Simulator.vue
│   │   └── Settings.vue
│   ├── types/                  # Tipos compartilhados (idealmente gerados via openapi)
│   ├── utils/
│   └── assets/
├── public/
├── index.html
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 7. Modelagem de Banco — Prisma Schema

Schema completo para o MVP com correções aplicadas.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============== TENANT ==============
model School {
  id            String   @id @default(uuid())
  name          String
  slug          String   @unique
  cnpj          String?  @unique
  plan          Plan     @default(STARTER)
  status        SchoolStatus @default(ACTIVE)
  settings      Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  users              User[]
  leads              Lead[]
  pipelines          Pipeline[]
  conversations      Conversation[]
  channels           Channel[]
  preEnrollments     PreEnrollment[]
  followUpRules      FollowUpRule[]
  aiAgents           AiAgent[]
  tokenUsage         TokenUsage[]

  @@map("schools")
}

enum Plan { STARTER GROWTH SCALE ENTERPRISE }
enum SchoolStatus { ACTIVE SUSPENDED TRIAL }

// ============== USERS ==============
model User {
  id            String   @id @default(uuid())
  schoolId      String
  email         String
  passwordHash  String
  name          String
  role          Role     @default(AGENT)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())

  school        School   @relation(fields: [schoolId], references: [id])
  conversations Conversation[]
  messages      Message[]
  auditLogs     AuditLog[]

  @@unique([schoolId, email])
  @@index([schoolId])
  @@map("users")
}

enum Role { OWNER ADMIN MANAGER AGENT VIEWER }

// ============== CHANNELS ==============
model Channel {
  id            String   @id @default(uuid())
  schoolId      String
  type          ChannelType
  identifier    String   // phone_number_id do WA, etc.
  credentials   Json     // tokens encriptados (AES-256-GCM via KMS)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())

  school        School   @relation(fields: [schoolId], references: [id])
  conversations Conversation[]
  aiAgents      AiAgent[]  // cada canal pode ter seu próprio agente configurado

  @@unique([schoolId, type, identifier])
  @@index([schoolId])
  @@map("channels")
}

enum ChannelType { WHATSAPP_CLOUD INSTAGRAM WEBCHAT EMAIL }

// ============== LEADS ==============
model Lead {
  id               String    @id @default(uuid())
  schoolId         String
  name             String?
  phone            String?   // E.164 (ex: +5511999999999)
  email            String?
  cpf              String?   // AES-256-GCM encrypted em repouso
  cpfHmac          String?   // HMAC(cpf, HMAC_SECRET) — indexável para lookup sem descriptografar
  birthDate        DateTime?
  source           LeadSource @default(WHATSAPP)
  sourceDetails    Json?
  status           LeadStatus @default(NEW)
  score            Int       @default(0)
  scoreReason      Json?
  pipelineId       String?
  stageId          String?
  interestCourse   String?
  interestUnit     String?
  interestShift    String?
  tags             String[]  @default([])
  notes            String?
  assignedToUserId String?
  qualified        Boolean   @default(false)
  qualifiedAt      DateTime?
  lostReason       String?
  lastInteractionAt DateTime?
  deletedAt        DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  school           School        @relation(fields: [schoolId], references: [id])
  pipeline         Pipeline?     @relation(fields: [pipelineId], references: [id])
  stage            PipelineStage? @relation(fields: [stageId], references: [id])
  conversations    Conversation[]
  preEnrollments   PreEnrollment[]
  followUpJobs     FollowUpJob[]

  @@unique([schoolId, phone])
  @@index([schoolId, status])
  @@index([schoolId, stageId])
  @@index([schoolId, createdAt])
  @@index([schoolId, cpfHmac])         // lookup por CPF sem descriptografar
  @@index([tags], type: Gin)           // busca por tag via @> no Postgres
  @@map("leads")
}

enum LeadSource { WHATSAPP META_ADS INSTAGRAM SITE MANUAL IMPORT REFERRAL }
enum LeadStatus { NEW QUALIFYING QUALIFIED PRE_ENROLLED ENROLLED LOST }

// ============== PIPELINE ==============
model Pipeline {
  id          String   @id @default(uuid())
  schoolId    String
  name        String
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())

  school      School   @relation(fields: [schoolId], references: [id])
  stages      PipelineStage[]
  leads       Lead[]

  @@index([schoolId])
  @@map("pipelines")
}

model PipelineStage {
  id          String   @id @default(uuid())
  pipelineId  String
  name        String
  order       Int
  color       String?
  isWon       Boolean  @default(false)
  isLost      Boolean  @default(false)

  pipeline    Pipeline @relation(fields: [pipelineId], references: [id])
  leads       Lead[]

  @@index([pipelineId, order])
  @@map("pipeline_stages")
}

// ============== CONVERSATIONS ==============
model Conversation {
  id                 String   @id @default(uuid())
  schoolId           String
  leadId             String
  channelId          String
  status             ConversationStatus @default(OPEN)
  assignedToUserId   String?
  aiHandling         Boolean  @default(true)
  lastMessageAt      DateTime?
  lastInboundAt      DateTime? // rastreia última mensagem DO lead — usado para verificar janela 24h
  unreadCount        Int      @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  school             School   @relation(fields: [schoolId], references: [id])
  lead               Lead     @relation(fields: [leadId], references: [id])
  channel            Channel  @relation(fields: [channelId], references: [id])
  assignedTo         User?    @relation(fields: [assignedToUserId], references: [id])
  messages           Message[]

  @@index([schoolId, status])
  @@index([schoolId, lastMessageAt(sort: Desc)])
  @@index([schoolId, aiHandling, status])  // queries frequentes do worker de IA
  @@map("conversations")
}

enum ConversationStatus { OPEN PENDING RESOLVED ARCHIVED }

model Message {
  id                  String   @id @default(uuid())
  schoolId            String
  conversationId      String
  direction           MessageDirection
  senderType          SenderType
  senderUserId        String?
  content             String   @db.Text
  mediaType           MediaType?
  mediaUrl            String?
  mediaMimeType       String?
  transcription       String?  @db.Text
  visionAnalysis      String?  @db.Text
  whatsappMessageId   String?  @unique   // idempotência
  status              MessageStatus @default(SENT)
  error               String?
  metadata            Json?

  // Campos de status de entrega (atualizados via webhook de status da Meta)
  deliveredAt         DateTime?
  readAt              DateTime?
  failedAt            DateTime?

  createdAt           DateTime @default(now())

  conversation        Conversation @relation(fields: [conversationId], references: [id])
  senderUser          User?        @relation(fields: [senderUserId], references: [id])

  @@index([conversationId, createdAt])
  @@index([whatsappMessageId])
  @@map("messages")
}

enum MessageDirection { INBOUND OUTBOUND }
enum SenderType { LEAD AGENT AI SYSTEM }
enum MediaType { TEXT IMAGE AUDIO VIDEO DOCUMENT LOCATION }
enum MessageStatus { QUEUED SENT DELIVERED READ FAILED }

// ============== AI ==============
model AiAgent {
  id            String   @id @default(uuid())
  schoolId      String
  channelId     String?  // null = agente padrão da escola; preenchido = agente específico por canal
  name          String   @default("Atendente Virtual")
  systemPrompt  String   @db.Text
  knowledgeBase Json?
  model         String   @default("gpt-4o-mini")
  temperature   Float    @default(0.4)
  maxTokens     Int      @default(500)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  school        School   @relation(fields: [schoolId], references: [id])
  channel       Channel? @relation(fields: [channelId], references: [id])

  @@index([schoolId])
  @@map("ai_agents")
}

model TokenUsage {
  id               String   @id @default(uuid())
  schoolId         String
  model            String
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  costUsd          Decimal  @db.Decimal(10, 6)
  feature          String   // "sdr", "transcription", "vision", "summary"
  metadata         Json?
  createdAt        DateTime @default(now())

  school           School   @relation(fields: [schoolId], references: [id])

  @@index([schoolId, createdAt])
  @@map("token_usage")
}

// ============== PRE-ENROLLMENT ==============
model PreEnrollment {
  id               String   @id @default(uuid())
  schoolId         String
  leadId           String
  course           String
  unit             String
  shift            String
  studentName      String
  studentCpf       String   // AES-256-GCM encrypted
  studentCpfHmac   String?  // HMAC para lookup
  birthDate        DateTime?
  responsibleName  String?
  responsibleCpf   String?
  status           PreEnrollmentStatus @default(DRAFT)
  exportedToErp    Boolean  @default(false)
  erpReference     String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  school           School   @relation(fields: [schoolId], references: [id])
  lead             Lead     @relation(fields: [leadId], references: [id])
  documents        PreEnrollmentDocument[]

  @@index([schoolId, status])
  @@map("pre_enrollments")
}

// Tabela dedicada para documentos — permite filtrar por status sem JSONB
model PreEnrollmentDocument {
  id               String   @id @default(uuid())
  preEnrollmentId  String
  type             String   // "rg", "cpf", "comprovante_residencia", etc.
  url              String   // URL S3
  mimeType         String?
  status           DocumentStatus @default(PENDING)
  reviewNote       String?
  uploadedAt       DateTime @default(now())
  reviewedAt       DateTime?

  preEnrollment    PreEnrollment @relation(fields: [preEnrollmentId], references: [id])

  @@index([preEnrollmentId, status])
  @@map("pre_enrollment_documents")
}

enum PreEnrollmentStatus { DRAFT IN_REVIEW APPROVED REJECTED EXPORTED }
enum DocumentStatus { PENDING APPROVED REJECTED }

// ============== FOLLOW-UP ==============
model FollowUpRule {
  id              String   @id @default(uuid())
  schoolId        String
  name            String
  trigger         FollowUpTrigger
  delayMinutes    Int
  messageTemplate String   @db.Text
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())

  school          School   @relation(fields: [schoolId], references: [id])
  jobs            FollowUpJob[]

  @@index([schoolId])
  @@map("follow_up_rules")
}

enum FollowUpTrigger {
  NO_RESPONSE_AFTER_AI
  PRE_ENROLLMENT_INCOMPLETE
  STAGE_INACTIVE
  ABANDONED
}

model FollowUpJob {
  id            String   @id @default(uuid())
  schoolId      String
  ruleId        String
  leadId        String
  scheduledFor  DateTime
  status        FollowUpStatus @default(SCHEDULED)
  executedAt    DateTime?
  cancelReason  String?

  rule          FollowUpRule @relation(fields: [ruleId], references: [id])
  lead          Lead         @relation(fields: [leadId], references: [id])

  @@index([scheduledFor, status])
  @@index([schoolId, leadId])
  @@map("follow_up_jobs")
}

enum FollowUpStatus { SCHEDULED SENT CANCELLED FAILED }

// ============== SUPPORT (pós-venda) ==============

// Aluno já matriculado — sincronizado do ERP ou criado manualmente
model Student {
  id            String   @id @default(uuid())
  schoolId      String
  name          String
  phone         String   // E.164 — chave de identificação no WhatsApp
  email         String?
  ra            String?  // Registro do Aluno no ERP
  cpf           String?  // encrypted
  cpfHmac       String?
  courseId      String?  // referência livre (nome do curso no ERP)
  unit          String?
  status        StudentStatus @default(ACTIVE)
  erpReference  String?  // ID no sistema acadêmico externo
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  school        School   @relation(fields: [schoolId], references: [id])
  tickets       Ticket[]

  @@unique([schoolId, phone])
  @@unique([schoolId, ra])
  @@index([schoolId, cpfHmac])
  @@map("students")
}

enum StudentStatus { ACTIVE INACTIVE GRADUATED SUSPENDED }

model TicketCategory {
  id          String   @id @default(uuid())
  schoolId    String
  name        String   // "Secretaria", "Financeiro", "TI", "Pedagógico"
  description String?
  routeToRole Role     @default(AGENT) // qual papel recebe esses tickets
  slaMinutes  Int      @default(480)   // SLA padrão em minutos (8h)
  active      Boolean  @default(true)

  school      School   @relation(fields: [schoolId], references: [id])
  tickets     Ticket[]

  @@index([schoolId])
  @@map("ticket_categories")
}

model Ticket {
  id               String   @id @default(uuid())
  schoolId         String
  studentId        String
  categoryId       String?
  conversationId   String?  // conversa WhatsApp onde o ticket foi aberto
  title            String
  description      String   @db.Text
  status           TicketStatus @default(OPEN)
  priority         TicketPriority @default(NORMAL)
  assignedToUserId String?
  resolvedAt       DateTime?
  closedAt         DateTime?
  satisfactionScore Int?    // 1-5 (CSAT pós-resolução)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  school           School         @relation(fields: [schoolId], references: [id])
  student          Student        @relation(fields: [studentId], references: [id])
  category         TicketCategory? @relation(fields: [categoryId], references: [id])
  messages         TicketMessage[]

  @@index([schoolId, status])
  @@index([schoolId, studentId])
  @@index([assignedToUserId, status])
  @@map("tickets")
}

enum TicketStatus   { OPEN IN_PROGRESS WAITING_STUDENT RESOLVED CLOSED }
enum TicketPriority { LOW NORMAL HIGH URGENT }

model TicketMessage {
  id          String   @id @default(uuid())
  ticketId    String
  senderType  SenderType
  senderUserId String?
  content     String   @db.Text
  createdAt   DateTime @default(now())

  ticket      Ticket   @relation(fields: [ticketId], references: [id])

  @@index([ticketId, createdAt])
  @@map("ticket_messages")
}

// ============== AUDIT ==============
model AuditLog {
  id          String   @id @default(uuid())
  schoolId    String
  userId      String?
  action      String
  entityType  String
  entityId    String
  diff        Json?
  ip          String?
  userAgent   String?
  createdAt   DateTime @default(now())

  user        User?    @relation(fields: [userId], references: [id])

  @@index([schoolId, createdAt])
  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

**Decisões e correções em relação à versão anterior:**

- `cpfHmac` adicionado em `Lead` e `PreEnrollment` → permite lookup por CPF sem descriptografar. O HMAC usa uma chave separada do segredo de criptografia.
- `lastInboundAt` em `Conversation` → campo dedicado para checar a janela de 24h do WhatsApp sem precisar joinar com `messages`.
- `@@index([schoolId, aiHandling, status])` em `Conversation` → queries frequentes do worker de IA não fazem seq scan.
- `@@index([tags], type: Gin)` em `Lead` → busca por tag via operador `@>` do Postgres.
- `channelId` em `AiAgent` → suporta agente diferente por canal (WA vs Instagram) sem refactor posterior.
- `PreEnrollmentDocument` virou tabela dedicada → permite filtrar `WHERE status = 'PENDING'` com índice, sem JSONB scan.
- Campos `deliveredAt`, `readAt`, `failedAt` em `Message` → necessários para processar webhooks de status da Meta.
- `tags: String[]` mantém array nativo do Postgres; GIN index explícito adicionado no schema.

---

## 8. Integração WhatsApp Cloud API

### 8.1 Como funciona

A WhatsApp Cloud API da Meta é um serviço HTTPS:
- Você se inscreve em um webhook → Meta envia POST quando recebe mensagem **e** quando o status de uma mensagem enviada muda.
- Você manda POST para `graph.facebook.com/.../messages` para responder.
- Cada escola tem seu próprio `phone_number_id` e `access_token` (Business Account).

### 8.2 Janela de 24h — restrição crítica

A Meta só permite enviar mensagens de texto livre dentro de uma janela de 24h após a última mensagem **recebida** do usuário. Após esse prazo, somente **templates aprovados** podem ser enviados.

```
Usuário envia mensagem → janela de 24h se abre/renova
        │
        ├─ Dentro de 24h → pode enviar qualquer texto
        │
        └─ Após 24h sem nova mensagem do usuário
               │
               ├─ Template aprovado Meta → OK (Fase 2)
               └─ Texto livre → erro 131047 da API
```

Todo follow-up agendado **deve verificar se a janela está aberta antes de enviar**. No MVP, se a janela estiver fechada, o job é cancelado com `cancelReason: 'outside_24h_window'`. Templates aprovados entram na Fase 2.

### 8.3 Roteamento: Lead (SDR) vs Aluno (Suporte)

Toda mensagem que chega pelo WhatsApp passa primeiro por um roteador que decide qual fluxo ativar:

```
Mensagem recebida do número X
        │
        ▼
ConversationRouter verifica:
  → Student.phone = X? (aluno matriculado)
        │
        ├─ SIM → fluxo de Suporte
        │         └─ AiAgent com persona de suporte
        │             → coleta: assunto, categoria
        │             → abre Ticket e roteia para setor
        │
        └─ NÃO → fluxo SDR (lead)
                  └─ comportamento atual de qualificação
```

```typescript
// src/modules/support/conversation-router.ts
@Injectable()
export class ConversationRouter {
  constructor(private readonly prisma: PrismaService) {}

  async route(phone: string, schoolId: string): Promise<'sdr' | 'support'> {
    const student = await this.prisma.student.findUnique({
      where: { schoolId_phone: { schoolId, phone } },
      select: { id: true, status: true },
    });

    if (student && student.status === 'ACTIVE') return 'support';
    return 'sdr';
  }
}
```

O worker de `whatsapp:incoming` chama o router antes de acionar o agente. Se o número for de um aluno ativo, o `AiSdrService` não é acionado — em seu lugar entra o `SupportService`.

**Regra de transição:** um lead que finaliza matrícula pode se tornar `Student` via sincronização com o ERP (Fase 2) ou manualmente pelo gestor. A partir daí, qualquer mensagem dele vai para o fluxo de suporte.

### 8.4 Fluxo de entrada (webhook)

```
Meta → POST /webhooks/whatsapp
  → Verifica X-Hub-Signature-256 (HMAC SHA256 com APP_SECRET)
  → Identifica school via phone_number_id
  → Enfileira job "whatsapp.message.incoming"
  → Retorna 200 imediatamente (< 5s, regra da Meta)

Worker consome a fila:
  → Cria/atualiza Lead
  → Cria/atualiza Conversation
  → Atualiza Conversation.lastInboundAt (para controle da janela 24h)
  → Cria Message (inbound)
  → Se for áudio → enfileira "media.transcribe"
  → Se for imagem → enfileira "media.vision"
  → Emite evento "conversation.message.received"
  → AiSdrModule escuta → decide responder

Meta → POST /webhooks/whatsapp (evento de status)
  → Identifica mensagem pelo whatsappMessageId
  → Atualiza Message.status + deliveredAt/readAt/failedAt
  → Emite evento para o frontend via Socket.IO
```

### 8.5 Fluxo de saída

```
AiSdrService.respond(conversationId, text)
  → Cria Message (outbound, status=QUEUED)
  → Enfileira job "whatsapp.message.send"

Worker:
  → Chama Meta API
  → Salva whatsappMessageId
  → Atualiza status para SENT
  → Em caso de erro 4xx → marca FAILED, não retry
  → Em caso de erro 5xx → BullMQ retry com backoff exponencial
```

### 8.6 Pontos críticos

- **Verificação do webhook na assinatura:** a Meta exige um GET inicial com `hub.challenge`. Implementar com cuidado.
- **Janela de 24h:** após 24h sem mensagem do usuário, só templates aprovados. `lastInboundAt` em `Conversation` é a fonte de verdade; atualizar a cada mensagem `INBOUND`.
- **Webhooks de status:** a Meta envia `delivered`, `read` e `failed` para mensagens enviadas. Processar esses eventos atualiza `Message.status` e os campos `deliveredAt`/`readAt`/`failedAt`. Sem isso o status nunca sai de `SENT`.
- **Rate limit:** ~80 msg/s por número no início; sobe conforme tier. Worker tem que respeitar.
- **Mídia:** o webhook traz `media_id`. Você baixa via `GET /{media_id}` (com token) → sobe pro S3 → salva URL.

---

## 9. Integração OpenAI e Agente IA SDR

### 9.1 Arquitetura do agente

O `AiSdrService` é o cérebro. Recebe uma conversa, decide o que fazer. Implementado com **OpenAI Tool/Function Calling** — não com LangChain.

**Tools disponíveis para a IA:**

```typescript
const tools = [
  {
    name: 'update_lead',
    description: 'Atualiza dados do lead (nome, curso de interesse, unidade, turno, CPF)',
    parameters: { /* JSON Schema */ },
  },
  {
    name: 'mark_qualified',
    description: 'Marca lead como qualificado quando tem: nome, curso, unidade, contato confirmado',
    parameters: { reason: 'string' },
  },
  {
    name: 'create_pre_enrollment',
    description: 'Inicia pré-matrícula quando lead confirmou intenção',
    parameters: { /* ... */ },
  },
  {
    name: 'escalate_to_human',
    description: 'Transfere para atendente humano (lead pediu, IA não sabe responder, etc.)',
    parameters: { reason: 'string' },
  },
  {
    name: 'send_message',
    description: 'Resposta direta ao lead',
    parameters: { text: 'string' },
  },
];
```

### 9.2 Janela de contexto com compressão de histórico

Para conversas longas, não enviamos todas as mensagens ao modelo — isso aumenta custo linearmente e polui o contexto com informações antigas já resolvidas.

**Estratégia de compressão em camadas:**

```
Conversa com N mensagens
        │
        ├─ Últimas 10 mensagens → enviadas cruas (contexto imediato)
        │
        └─ Mensagens mais antigas → substituídas por resumo cacheado
               │
               ├─ Resumo existe no Redis (TTL 1h) → usa sem chamar OpenAI
               └─ Resumo não existe → gera com gpt-4o-mini, cacheia no Redis
```

O resumo é regenerado a cada 10 novas mensagens (threshold configurável). Isso mantém a janela de contexto estável independente do tamanho da conversa.

### 9.3 Seleção de agente por canal

Ao iniciar uma conversa, o orquestrador busca o agente na seguinte ordem de precedência:

```typescript
// 1. Agente específico para o canal da conversa
const agent = await prisma.aiAgent.findFirst({
  where: { schoolId, channelId: conversation.channelId, active: true },
}) ??
// 2. Agente padrão da escola (channelId = null)
await prisma.aiAgent.findFirst({
  where: { schoolId, channelId: null, active: true },
});
```

Isso permite, por exemplo, configurar um tom mais formal no WhatsApp e mais casual no webchat sem duplicar lógica.

### 9.4 Prompt base (template por escola)

```
Você é o atendente virtual da {{school.name}}, uma instituição de ensino.

REGRAS:
- Sempre cordial, em português brasileiro, tom {{school.settings.tone}} (formal/casual).
- Coleta progressiva: NÃO peça tudo de uma vez. Uma pergunta por mensagem.
- Sequência de qualificação:
  1. Saudação + identificação do interesse (qual curso)
  2. Unidade desejada (lista: {{school.units}})
  3. Turno (manhã/tarde/noite)
  4. Nome completo
  5. Idade ou se é maior/menor
  6. Telefone confirmado (o número da conversa)
- Se o lead pedir "falar com humano", use escalate_to_human.
- Se a pergunta sair do escopo (financeiro detalhado, processo seletivo específico), use escalate_to_human.
- NUNCA invente valores, datas ou regras que não estejam em CONHECIMENTO.

CONHECIMENTO:
{{school.knowledgeBase}}

CURSOS DISPONÍVEIS:
{{school.courses}}
```

### 9.5 Modelos por tarefa

| Tarefa | Modelo | Por quê |
|---|---|---|
| Conversa SDR | `gpt-4o-mini` | Custo baixo, latência ~1s, bom o bastante para qualificação |
| Resumo de histórico | `gpt-4o-mini` | Mesmo motivo; resultado cacheado no Redis |
| Extração estruturada (CPF, nome, curso) | `gpt-4o-mini` + structured output | Tokens previsíveis |
| Casos complexos (negociação) | `gpt-4o` (escalado pelo orquestrador) | Qualidade |
| Áudio → texto | `whisper-1` | Estado da arte, barato |
| Imagem (RG, comprovante) | `gpt-4o` (vision) | OCR + interpretação |

---

## 10. Controle de Custos de Tokens

**Camada 1 — Modelo certo para a tarefa.** Default em `gpt-4o-mini`. Escalar para `gpt-4o` só quando necessário.

**Camada 2 — Janela de contexto com compressão.** Resumo das mensagens antigas cacheado no Redis + últimas 10 mensagens cruas. Descrito em detalhes na Seção 9.2.

**Camada 3 — Cache de embeddings.** Se usar RAG para FAQ da escola, embeddings da knowledge base ficam no Postgres (pgvector). Embeddings de mensagens nunca: caro e baixo retorno.

**Camada 4 — Structured outputs.** JSON Schema reduz tokens de output vs. texto livre.

**Camada 5 — Quota por escola.**

```typescript
const usage = await tokenUsageService.getMonthly(schoolId);
const limit = school.plan === 'STARTER' ? 500_000 : 5_000_000;
if (usage.totalTokens > limit) {
  await this.escalateToHuman(conversationId, 'token_limit_reached');
  return;
}
```

**Camada 6 — Tracking obrigatório.** Toda chamada OpenAI passa por wrapper que registra em `TokenUsage`. Sem exceção.

**Camada 7 — Throttling de IA por lead.** Se um lead manda 50 mensagens em 1 minuto (bot, troll), a IA para de responder após X mensagens em Y segundos.

**Custo de referência:**
- `gpt-4o-mini`: ~$0.15/1M input, $0.60/1M output.
- Conversa média de qualificação: ~5k tokens input + 1k output → ~$0.0014/conversa.
- 10.000 conversas/mês/escola → ~$14/mês de IA.

---

## 11. Filas, Workers e Automação (BullMQ)

### 11.1 Filas no MVP

| Fila | Job | Worker |
|---|---|---|
| `whatsapp:incoming` | mensagem recebida | persiste + dispara IA |
| `whatsapp:status` | status de entrega (delivered/read/failed) | atualiza Message |
| `whatsapp:outgoing` | enviar mensagem | chama API Meta |
| `media:transcribe` | áudio → texto | Whisper |
| `media:vision` | imagem → análise | GPT-4o vision |
| `ai:sdr` | rodar agente | OpenAI |
| `followup:scheduled` | mensagem agendada | verifica janela 24h + cria job em `whatsapp:outgoing` |
| `webhook:deliver` | webhook saída (futuro) | HTTP POST |

### 11.2 Padrões obrigatórios

- **Idempotência:** todo job carrega um `idempotencyKey`. Worker verifica antes de processar.
- **Retry:** `attempts: 5`, backoff exponencial (`{type: 'exponential', delay: 2000}`).
- **DLQ:** falhas terminais vão para fila `*:dead`. Alerta para o Slack interno.
- **Rate limiter por escola:** BullMQ `limiter` por `phone_number_id` em `whatsapp:outgoing`.
- **Concurrency:** workers iniciam com `concurrency: 5`; ajustar via env.

### 11.3 Cadência de follow-up com verificação de janela

```typescript
// followup.processor.ts
async process(job: Job<{ leadId: string; ruleId: string; conversationId: string }>) {
  const conv = await prisma.conversation.findUnique({
    where: { id: job.data.conversationId },
    select: { lastInboundAt: true, status: true },
  });

  // Cancela se lead respondeu após o agendamento
  if (conv.status === 'RESOLVED') {
    return this.cancel(job.data, 'conversation_resolved');
  }

  // Verifica janela de 24h (margem de 30min para segurança)
  const windowOpenUntil = conv.lastInboundAt
    ? new Date(conv.lastInboundAt.getTime() + 23.5 * 60 * 60 * 1000)
    : null;

  const withinWindow = windowOpenUntil && windowOpenUntil > new Date();

  if (!withinWindow) {
    // MVP: cancela. Fase 2: tenta enviar template aprovado.
    return this.cancel(job.data, 'outside_24h_window');
  }

  const rule = await prisma.followUpRule.findUnique({ where: { id: job.data.ruleId } });
  await outgoingQueue.add('send', {
    conversationId: job.data.conversationId,
    text: rule.messageTemplate,
  });
}
```

O campo `Conversation.lastInboundAt` é atualizado pelo worker de `whatsapp:incoming` a cada mensagem recebida, cancelando automaticamente jobs de follow-up se o lead responder no meio tempo.

---

## 12. APIs RESTful — Contratos

Versionamento via prefixo `/api/v1`.

### 12.1 Auth
```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### 12.2 Leads
```
GET    /api/v1/leads?stage=&search=&tag=&page=&limit=
POST   /api/v1/leads
GET    /api/v1/leads/:id
PATCH  /api/v1/leads/:id
DELETE /api/v1/leads/:id                  (soft delete)
POST   /api/v1/leads/:id/assign           { userId }
POST   /api/v1/leads/:id/move-stage       { stageId }
POST   /api/v1/leads/import               (CSV)
GET    /api/v1/leads/:id/timeline
POST   /api/v1/leads/:id/anonymize        (LGPD)
```

### 12.3 Conversations & Messages
```
GET    /api/v1/conversations?status=&assignedTo=&page=
GET    /api/v1/conversations/:id
POST   /api/v1/conversations/:id/assume
POST   /api/v1/conversations/:id/release
PATCH  /api/v1/conversations/:id
GET    /api/v1/conversations/:id/messages?cursor=
POST   /api/v1/conversations/:id/messages   { text, mediaUrl? }
```

### 12.4 Pipelines
```
GET    /api/v1/pipelines
POST   /api/v1/pipelines
GET    /api/v1/pipelines/:id
PATCH  /api/v1/pipelines/:id
POST   /api/v1/pipelines/:id/stages
PATCH  /api/v1/pipelines/:id/stages/:stageId
DELETE /api/v1/pipelines/:id/stages/:stageId
```

### 12.5 Pre-enrollment
```
GET    /api/v1/pre-enrollments
POST   /api/v1/pre-enrollments
GET    /api/v1/pre-enrollments/:id
PATCH  /api/v1/pre-enrollments/:id
POST   /api/v1/pre-enrollments/:id/documents     (upload)
PATCH  /api/v1/pre-enrollments/:id/documents/:docId  { status, reviewNote }
POST   /api/v1/pre-enrollments/:id/approve
POST   /api/v1/pre-enrollments/:id/export
```

### 12.6 Webhooks (entrada)
```
GET    /api/v1/webhooks/whatsapp   (verificação Meta)
POST   /api/v1/webhooks/whatsapp   (mensagens + eventos de status)
POST   /api/v1/webhooks/meta-ads   (futuro)
POST   /api/v1/webhooks/forms      (formulário do site)
```

### 12.7 Suporte pós-venda

```
// Alunos
GET    /api/v1/students?search=&status=&page=
POST   /api/v1/students                         (cadastro manual)
PATCH  /api/v1/students/:id
POST   /api/v1/students/import                  (CSV do ERP)

// Categorias de ticket
GET    /api/v1/ticket-categories
POST   /api/v1/ticket-categories
PATCH  /api/v1/ticket-categories/:id

// Tickets
GET    /api/v1/tickets?status=&categoryId=&assignedTo=&page=
POST   /api/v1/tickets                          (abertura manual pelo atendente)
GET    /api/v1/tickets/:id
PATCH  /api/v1/tickets/:id                      { status, priority, assignedToUserId }
POST   /api/v1/tickets/:id/messages             { content }
POST   /api/v1/tickets/:id/resolve
POST   /api/v1/tickets/:id/close
POST   /api/v1/tickets/:id/satisfaction         { score: 1-5 }
```

### 12.8 AI Simulator (MVP)
```
POST   /api/v1/simulator/messages   { text }
DELETE /api/v1/simulator/session
```

### 12.9 Convenções
- Erros padronizados: `{ statusCode, error, message, traceId }`.
- Paginação cursor-based para mensagens; offset para listas de admin.
- `If-None-Match` / `ETag` em GETs de lead/conversa.
- Validação com `class-validator` em DTOs.
- OpenAPI auto-gerado via `@nestjs/swagger`, exportado para o frontend via `openapi-typescript`.

---

## 13. Exemplos de Código — NestJS

### 13.1 Context de tenant (AsyncLocalStorage)

```typescript
// src/common/context/tenant-context.ts
import { AsyncLocalStorage } from 'async_hooks';

interface TenantContext {
  schoolId: string;
  userId: string;
  role: string;
  traceId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getCurrentTenant(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) throw new Error('Tenant context not initialized');
  return ctx;
}
```

```typescript
// src/common/middleware/tenant.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { tenantStorage } from '../context/tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    const traceId = (req.headers['x-trace-id'] as string) ?? randomUUID();
    if (!user) return next();

    tenantStorage.run(
      { schoolId: user.schoolId, userId: user.id, role: user.role, traceId },
      () => next(),
    );
  }
}
```

### 13.2 Prisma com `$extends` multi-tenant (Prisma 5+)

> **Atenção:** a API `$use` foi depreciada no Prisma 5. Use `$extends` com client extensions.

```typescript
// src/infra/prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantStorage } from '../../common/context/tenant-context';

const TENANT_MODELS = new Set([
  'User', 'Lead', 'Pipeline', 'PipelineStage', 'Conversation',
  'Message', 'Channel', 'AiAgent', 'PreEnrollment', 'PreEnrollmentDocument',
  'FollowUpRule', 'FollowUpJob', 'TokenUsage',
]);

const READ_OPS = new Set(['findUnique', 'findFirst', 'findMany', 'count', 'aggregate']);
const WRITE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

function buildTenantExtension(getSchoolId: () => string | undefined) {
  return {
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          const schoolId = getSchoolId();
          if (!schoolId || !TENANT_MODELS.has(model)) return query(args);

          if (READ_OPS.has(operation)) {
            args.where = { ...args.where, schoolId };
          } else if (operation === 'create') {
            args.data = { ...args.data, schoolId };
          } else if (WRITE_OPS.has(operation)) {
            args.where = { ...args.where, schoolId };
          }

          return query(args);
        },
      },
    },
  };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  // Retorna um client com o filtro de tenant injetado via $extends
  withTenant() {
    const schoolId = tenantStorage.getStore()?.schoolId;
    return this.$extends(buildTenantExtension(() => schoolId)) as unknown as PrismaClient;
  }
}
```

> Nos serviços, usar `this.prisma.withTenant()` em vez de `this.prisma` diretamente para garantir o isolamento. O `PrismaService` puro fica reservado para operações de sistema (workers sem contexto de usuário) que já injetam o `schoolId` manualmente.

### 13.3 WhatsApp Webhook Controller

```typescript
// src/modules/whatsapp/whatsapp-webhook.controller.ts
import {
  Controller, Get, Post, Query, Body, Headers,
  HttpCode, BadRequestException, Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Public } from '../../common/decorators/public.decorator';

@Controller('webhooks/whatsapp')
@Public()
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue('whatsapp:incoming') private readonly incomingQueue: Queue,
    @InjectQueue('whatsapp:status') private readonly statusQueue: Queue,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    if (mode === 'subscribe' && token === this.config.get('WHATSAPP_VERIFY_TOKEN')) {
      return challenge;
    }
    throw new BadRequestException();
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: any,
  ) {
    if (!this.isValidSignature(JSON.stringify(body), signature)) {
      this.logger.warn('Invalid WhatsApp signature');
      return { ok: true }; // sempre 200 para não gerar retry na Meta
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const phoneNumberId = change.value?.metadata?.phone_number_id;

        // Mensagens recebidas
        for (const message of change.value?.messages ?? []) {
          await this.incomingQueue.add(
            'incoming',
            { phoneNumberId, message, contact: change.value?.contacts?.[0] },
            {
              jobId: message.id,
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: 1000,
              removeOnFail: false,
            },
          );
        }

        // Eventos de status (delivered, read, failed)
        for (const status of change.value?.statuses ?? []) {
          await this.statusQueue.add(
            'status',
            { phoneNumberId, status },
            {
              jobId: `status-${status.id}-${status.status}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
              removeOnComplete: 500,
            },
          );
        }
      }
    }

    return { ok: true };
  }

  private isValidSignature(raw: string, signature?: string): boolean {
    if (!signature) return false;
    const expected =
      'sha256=' +
      createHmac('sha256', this.config.get('META_APP_SECRET')!)
        .update(raw)
        .digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
```

### 13.4 Worker de status de entrega

```typescript
// src/modules/whatsapp/whatsapp-status.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RealtimeGateway } from '../../infra/realtime/realtime.gateway';

@Processor('whatsapp:status')
export class WhatsAppStatusProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<{ phoneNumberId: string; status: any }>) {
    const { status } = job.data;

    const statusMap: Record<string, Partial<{ status: any; deliveredAt: Date; readAt: Date; failedAt: Date }>> = {
      delivered: { status: 'DELIVERED', deliveredAt: new Date(Number(status.timestamp) * 1000) },
      read:      { status: 'READ',      readAt:      new Date(Number(status.timestamp) * 1000) },
      failed:    { status: 'FAILED',    failedAt:    new Date(Number(status.timestamp) * 1000) },
    };

    const update = statusMap[status.status];
    if (!update) return;

    const message = await this.prisma.message.update({
      where: { whatsappMessageId: status.id },
      data: update,
      select: { id: true, conversationId: true, schoolId: true },
    });

    // Notifica o frontend em tempo real
    this.realtime.toSchool(message.schoolId, 'message.status', {
      messageId: message.id,
      conversationId: message.conversationId,
      status: update.status,
    });
  }
}
```

### 13.5 Worker que processa mensagens recebidas

```typescript
// src/modules/whatsapp/whatsapp-incoming.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { ConversationsService } from '../conversations/conversations.service';
import { AiSdrService } from '../ai-sdr/ai-sdr.service';
import { tenantStorage } from '../../common/context/tenant-context';

@Processor('whatsapp:incoming')
export class WhatsAppIncomingProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppIncomingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    private readonly conversations: ConversationsService,
    private readonly aiSdr: AiSdrService,
  ) {
    super();
  }

  async process(job: Job<{ phoneNumberId: string; message: any; contact: any }>) {
    const { phoneNumberId, message, contact } = job.data;

    const channel = await this.prisma.channel.findFirst({
      where: { type: 'WHATSAPP_CLOUD', identifier: phoneNumberId, active: true },
      select: { id: true, schoolId: true },
    });

    if (!channel) {
      this.logger.warn(`Unknown phone_number_id=${phoneNumberId}`);
      return;
    }

    await tenantStorage.run(
      { schoolId: channel.schoolId, userId: 'system', role: 'SYSTEM', traceId: job.id! },
      async () => {
        const lead = await this.leads.findOrCreateByPhone({
          phone: contact.wa_id,
          name: contact.profile?.name,
          source: 'WHATSAPP',
        });

        const conv = await this.conversations.findOrCreateOpen({
          leadId: lead.id,
          channelId: channel.id,
        });

        // Atualiza lastInboundAt — fonte de verdade para a janela de 24h
        await this.prisma.conversation.update({
          where: { id: conv.id },
          data: { lastInboundAt: new Date() },
        });

        await this.conversations.appendInboundMessage(conv.id, message);

        if (conv.aiHandling && !conv.assignedToUserId) {
          await this.aiSdr.handle(conv.id);
        }
      },
    );
  }
}
```

### 13.6 Orquestrador IA SDR com compressão de histórico

```typescript
// src/modules/ai-sdr/ai-sdr.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../openai/openai.service';
import { LeadsService } from '../leads/leads.service';
import { ConversationsService } from '../conversations/conversations.service';
import { PreEnrollmentService } from '../pre-enrollment/pre-enrollment.service';
import { HistoryCompressor } from './history-compressor';
import { buildSdrPrompt } from './prompts/sdr.prompt';
import { sdrTools } from './tools/sdr.tools';

const RECENT_MESSAGES_LIMIT = 10;

@Injectable()
export class AiSdrService {
  private readonly logger = new Logger(AiSdrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly leads: LeadsService,
    private readonly conversations: ConversationsService,
    private readonly preEnrollment: PreEnrollmentService,
    private readonly historyCompressor: HistoryCompressor,
  ) {}

  async handle(conversationId: string): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: true,
        messages: { orderBy: { createdAt: 'desc' }, take: RECENT_MESSAGES_LIMIT },
      },
    });
    if (!conv) return;

    // Seleciona agente: específico do canal ou padrão da escola
    const agent = await this.prisma.aiAgent.findFirst({
      where: { schoolId: conv.schoolId, channelId: conv.channelId, active: true },
    }) ?? await this.prisma.aiAgent.findFirst({
      where: { schoolId: conv.schoolId, channelId: null, active: true },
    });
    if (!agent) return;

    const recentMessages = conv.messages.reverse().map((m) => ({
      role: m.direction === 'INBOUND' ? 'user' : 'assistant' as const,
      content: m.transcription ?? m.visionAnalysis ?? m.content,
    }));

    // Obtém resumo do histórico antigo (cacheado no Redis)
    const historySummary = await this.historyCompressor.getSummary(
      conversationId,
      conv.schoolId,
    );

    const school = await this.prisma.school.findUnique({ where: { id: conv.schoolId } });
    const systemPrompt = buildSdrPrompt({ agent, lead: conv.lead, school });

    const contextMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...(historySummary
        ? [{ role: 'system' as const, content: `Resumo das interações anteriores:\n${historySummary}` }]
        : []),
      ...recentMessages,
    ];

    const response = await this.openai.chat({
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      messages: contextMessages,
      tools: sdrTools,
      feature: 'sdr',
      schoolId: conv.schoolId,
    });

    const toolCalls = response.choices[0].message.tool_calls ?? [];
    for (const call of toolCalls) {
      await this.executeTool(call, conv);
    }

    const directText = response.choices[0].message.content;
    if (directText && !toolCalls.some((t) => t.function.name === 'send_message')) {
      await this.conversations.queueOutboundMessage(conv.id, directText);
    }
  }

  private async executeTool(call: any, conv: any) {
    const args = JSON.parse(call.function.arguments);
    switch (call.function.name) {
      case 'send_message':
        return this.conversations.queueOutboundMessage(conv.id, args.text);
      case 'update_lead':
        return this.leads.update(conv.leadId, args);
      case 'mark_qualified':
        return this.leads.markQualified(conv.leadId, args.reason);
      case 'create_pre_enrollment':
        return this.preEnrollment.createFromLead(conv.leadId, args);
      case 'escalate_to_human':
        return this.conversations.escalateToHuman(conv.id, args.reason);
      default:
        this.logger.warn(`Unknown tool: ${call.function.name}`);
    }
  }
}
```

### 13.7 Compressor de histórico (cache Redis)

```typescript
// src/modules/ai-sdr/history-compressor.ts
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../openai/openai.service';

const SUMMARY_TTL_SECONDS = 3600; // 1h
const COMPRESS_AFTER = 10; // mensagens antigas além das últimas 10

@Injectable()
export class HistoryCompressor {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
  ) {}

  async getSummary(conversationId: string, schoolId: string): Promise<string | null> {
    const key = `conv:summary:${conversationId}`;
    const cached = await this.redis.get(key);
    if (cached) return cached;

    const totalCount = await this.prisma.message.count({ where: { conversationId } });
    if (totalCount <= COMPRESS_AFTER) return null;

    // Busca mensagens antigas (além das últimas COMPRESS_AFTER)
    const oldMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: totalCount - COMPRESS_AFTER,
      select: { direction: true, content: true, transcription: true, createdAt: true },
    });

    const transcript = oldMessages
      .map((m) => `${m.direction === 'INBOUND' ? 'Lead' : 'Atendente'}: ${m.transcription ?? m.content}`)
      .join('\n');

    const response = await this.openai.chat({
      model: 'gpt-4o-mini',
      temperature: 0,
      maxTokens: 300,
      messages: [
        {
          role: 'system',
          content: 'Resuma o histórico da conversa abaixo em até 5 bullet points. Foque em: dados coletados do lead, interesses, objeções, estado da qualificação.',
        },
        { role: 'user', content: transcript },
      ],
      feature: 'summary',
      schoolId,
    });

    const summary = response.choices[0].message.content ?? '';
    await this.redis.setex(key, SUMMARY_TTL_SECONDS, summary);
    return summary;
  }

  // Invalida cache quando novas mensagens chegam (a cada N mensagens)
  async invalidate(conversationId: string) {
    await this.redis.del(`conv:summary:${conversationId}`);
  }
}
```

### 13.8 OpenAI Service com tracking

```typescript
// src/modules/openai/openai.service.ts
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';

interface ChatParams {
  model: string;
  messages: any[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
  feature: 'sdr' | 'transcription' | 'vision' | 'summary';
  schoolId: string;
}

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o':      { input: 2.50, output: 10.00 },
};

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  async chat(params: ChatParams) {
    const start = Date.now();
    const response = await this.client.chat.completions.create({
      model: params.model,
      messages: params.messages,
      tools: params.tools,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    });

    await this.trackUsage({
      schoolId: params.schoolId,
      feature: params.feature,
      model: params.model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - start,
    });

    return response;
  }

  private async trackUsage(data: {
    schoolId: string; feature: string; model: string;
    promptTokens: number; completionTokens: number; latencyMs: number;
  }) {
    const price = PRICING[data.model] ?? { input: 0, output: 0 };
    const costUsd =
      (data.promptTokens / 1_000_000) * price.input +
      (data.completionTokens / 1_000_000) * price.output;

    await this.prisma.tokenUsage.create({
      data: {
        schoolId: data.schoolId,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.promptTokens + data.completionTokens,
        costUsd,
        feature: data.feature,
        metadata: { latencyMs: data.latencyMs },
      },
    });
  }
}
```

### 13.9 Helper de lookup de CPF via HMAC

```typescript
// src/modules/leads/cpf-hmac.helper.ts
import { createHmac } from 'crypto';

export function hashCpf(cpf: string, secret: string): string {
  return createHmac('sha256', secret).update(cpf.replace(/\D/g, '')).digest('hex');
}
```

```typescript
// uso em leads.service.ts ao criar/atualizar lead com CPF
async updateCpf(leadId: string, cpf: string) {
  const cleaned = cpf.replace(/\D/g, '');
  const encrypted = await this.kms.encrypt(cleaned);          // AES-256-GCM via KMS
  const hmac = hashCpf(cleaned, this.config.get('CPF_HMAC_SECRET'));

  return this.prisma.lead.update({
    where: { id: leadId },
    data: { cpf: encrypted, cpfHmac: hmac },
  });
}

async findByCpf(cpf: string, schoolId: string) {
  const hmac = hashCpf(cpf, this.config.get('CPF_HMAC_SECRET'));
  return this.prisma.lead.findFirst({ where: { schoolId, cpfHmac: hmac } });
}
```

---

## 14. Exemplos de Código — Vue 3

### 14.1 Pinia store de conversas com realtime

```typescript
// src/stores/conversations.store.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { conversationsApi } from '@/api/conversations.api';
import { useSocket } from '@/composables/useSocket';
import type { Conversation, Message } from '@/types';

export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<Map<string, Conversation>>(new Map());
  const messagesByConv = ref<Map<string, Message[]>>(new Map());
  const activeId = ref<string | null>(null);
  const loading = ref(false);

  const list = computed(() =>
    [...conversations.value.values()].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    ),
  );

  const active = computed(() =>
    activeId.value ? conversations.value.get(activeId.value) : null,
  );

  const activeMessages = computed(() =>
    activeId.value ? messagesByConv.value.get(activeId.value) ?? [] : [],
  );

  async function load() {
    loading.value = true;
    try {
      const res = await conversationsApi.list({ status: 'OPEN' });
      conversations.value = new Map(res.data.map((c) => [c.id, c]));
    } finally {
      loading.value = false;
    }
  }

  async function open(id: string) {
    activeId.value = id;
    if (!messagesByConv.value.has(id)) {
      const res = await conversationsApi.messages(id);
      messagesByConv.value.set(id, res.data);
    }
  }

  async function send(text: string) {
    if (!activeId.value) return;
    const id = activeId.value;
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      conversationId: id,
      direction: 'OUTBOUND',
      senderType: 'AGENT',
      content: text,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    };
    messagesByConv.value.get(id)?.push(optimistic);

    const res = await conversationsApi.sendMessage(id, { text });
    const arr = messagesByConv.value.get(id)!;
    const idx = arr.findIndex((m) => m.id === optimistic.id);
    if (idx !== -1) arr[idx] = res.data;
  }

  async function assume(id: string) {
    await conversationsApi.assume(id);
    const c = conversations.value.get(id);
    if (c) c.aiHandling = false;
  }

  function bindRealtime() {
    const socket = useSocket();

    socket.on('message.received', (payload: { conversationId: string; message: Message }) => {
      const arr = messagesByConv.value.get(payload.conversationId);
      if (arr) arr.push(payload.message);

      const conv = conversations.value.get(payload.conversationId);
      if (conv) {
        conv.lastMessageAt = payload.message.createdAt;
        if (activeId.value !== payload.conversationId) {
          conv.unreadCount = (conv.unreadCount ?? 0) + 1;
        }
      }
    });

    // Atualiza status de entrega de mensagens individuais
    socket.on('message.status', (payload: { messageId: string; conversationId: string; status: string }) => {
      const arr = messagesByConv.value.get(payload.conversationId);
      if (!arr) return;
      const msg = arr.find((m) => m.id === payload.messageId);
      if (msg) msg.status = payload.status as any;
    });
  }

  return {
    list, active, activeMessages, loading,
    load, open, send, assume, bindRealtime,
  };
});
```

### 14.2 Socket.IO Gateway com rooms por escola

```typescript
// src/infra/realtime/realtime.gateway.ts
import {
  WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token as string;
      const payload = this.jwt.verify(token);

      // Isola o socket na room da escola
      client.join(`school:${payload.schoolId}`);
      client.data.schoolId = payload.schoolId;
    } catch {
      this.logger.warn(`Rejected socket connection: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // Emite evento apenas para sockets da escola correta
  toSchool(schoolId: string, event: string, data: unknown) {
    this.server.to(`school:${schoolId}`).emit(event, data);
  }
}
```

### 14.3 Componente da inbox

```vue
<!-- src/pages/Inbox.vue -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { useConversationsStore } from '@/stores/conversations.store';
import ConversationList from '@/components/inbox/ConversationList.vue';
import MessageThread from '@/components/inbox/MessageThread.vue';
import LeadDrawer from '@/components/leads/LeadDrawer.vue';

const store = useConversationsStore();

onMounted(async () => {
  store.bindRealtime();
  await store.load();
});
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50">
    <ConversationList
      :items="store.list"
      :active-id="store.active?.id"
      :loading="store.loading"
      class="w-80 border-r border-gray-200 bg-white"
      @select="store.open"
    />

    <MessageThread
      v-if="store.active"
      :conversation="store.active"
      :messages="store.activeMessages"
      class="flex-1"
      @send="store.send"
      @assume="store.assume(store.active.id)"
    />

    <div v-else class="flex-1 flex items-center justify-center text-gray-400">
      Selecione uma conversa
    </div>

    <LeadDrawer
      v-if="store.active"
      :lead-id="store.active.leadId"
      class="w-96 border-l border-gray-200 bg-white"
    />
  </div>
</template>
```

### 14.4 Composer com aviso de janela 24h

```vue
<!-- src/components/inbox/Composer.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  disabled?: boolean;
  aiHandling?: boolean;
  lastInboundAt?: string | null;
}>();

const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'assume'): void;
}>();

const text = ref('');
const sending = ref(false);

// Avisa se estiver perto do fim da janela de 24h
const windowWarning = computed(() => {
  if (!props.lastInboundAt) return null;
  const expiresAt = new Date(props.lastInboundAt).getTime() + 24 * 60 * 60 * 1000;
  const remaining = expiresAt - Date.now();
  if (remaining < 2 * 60 * 60 * 1000 && remaining > 0) {
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / 60000);
    return `Janela WhatsApp fecha em ${hours}h ${minutes}min`;
  }
  if (remaining <= 0) return 'Janela de 24h encerrada — apenas templates aprovados';
  return null;
});

async function submit() {
  const t = text.value.trim();
  if (!t || sending.value) return;
  sending.value = true;
  emit('send', t);
  text.value = '';
  sending.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="border-t border-gray-200 bg-white p-3">
    <div
      v-if="aiHandling"
      class="mb-2 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700"
    >
      <span>IA está respondendo essa conversa</span>
      <button class="font-medium underline hover:text-blue-900" @click="emit('assume')">
        Assumir manualmente
      </button>
    </div>

    <div
      v-if="windowWarning"
      class="mb-2 rounded-lg px-3 py-2 text-sm"
      :class="windowWarning.includes('encerrada') ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'"
    >
      {{ windowWarning }}
    </div>

    <div class="flex items-end gap-2">
      <textarea
        v-model="text"
        rows="2"
        :disabled="disabled || aiHandling"
        placeholder="Digite uma mensagem..."
        class="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
        @keydown="onKeydown"
      />
      <button
        :disabled="disabled || aiHandling || !text.trim()"
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        @click="submit"
      >
        Enviar
      </button>
    </div>
  </div>
</template>
```

### 14.5 Cliente HTTP tipado

```typescript
// src/api/client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore();
      const ok = await auth.tryRefresh();
      if (ok) return http(error.config);
      auth.logout();
    }
    return Promise.reject(error);
  },
);
```

---

## 15. Segurança

**Autenticação**
- JWT access token curto (15min) + refresh token (7d) com rotação.
- Hash de senha com `argon2id`.
- Login com rate limit: 5/min por IP, 10/min por email.

**Autorização**
- RBAC: `OWNER > ADMIN > MANAGER > AGENT > VIEWER`.
- Guard verifica role no controller; service nunca confia em params.

**Multi-tenant**
- Prisma `$extends` + RLS no Postgres como segunda camada.

**Dados sensíveis**
- CPF: AES-256-GCM com KMS (chave nunca no `.env`) + HMAC separado para lookup indexável.
- Tokens WhatsApp/Meta em `Channel.credentials` também encriptados.
- LGPD: `POST /api/v1/leads/:id/anonymize` zera PII, mantém eventos de auditoria.

**Transporte**
- HTTPS + HSTS. TLS 1.2+.

**Webhooks**
- Validação de assinatura HMAC + timestamp window de 5min.

**Logs**
- Nunca logar CPF, senha, token. Mascarar se aparecer.
- Logs estruturados com `pino` em JSON.

**Dependências**
- `npm audit` no CI + Renovate/Dependabot.

**Headers**
- Helmet.js + CSP. CORS estrito por ambiente.

**Auditoria**
- `AuditLog` para toda ação sensível. Retenção: 12 meses.

**Pentest / SAST**
- Snyk + Semgrep no CI.
- Pentest externo antes do primeiro cliente enterprise.

---

## 16. Escalabilidade

### 10 escolas — MVP
- 1 instância do backend (1 vCPU, 2GB).
- 1 Postgres pequeno (db.t4g.medium) com backup diário.
- 1 Redis ElastiCache (cache.t4g.micro).
- Tudo num único cluster ECS Fargate.
- Custo: ~US$ 150–250/mês de infra.

### 1.000 escolas — fase Scale
- Backend horizontal: 4–8 réplicas atrás de ALB.
- Workers em ECS separado (escala por `queue depth`).
- Postgres com Read Replica + PgBouncer para connection pooling.
- Redis com cluster mode.
- CDN (CloudFront) para o frontend Vue.
- S3 para mídia (lifecycle: glacier após 90d).
- Particionamento de `messages` e `audit_logs` por mês.

### 10.000 escolas — fase Enterprise
- Schema-per-tenant para os top 50 clientes; row-level para a long tail.
- Extrair `whatsapp-gateway` e `ai-sdr` como serviços próprios.
- Edge functions para webhook (Cloudflare Workers).
- Multi-região (active-passive → active-active).

### Pontos de atenção desde o dia 1
- `connection_limit` do Prisma ajustado por instância.
- Sem fan-out síncrono. Notificações = fila.
- Paginação cursor-based em mensagens e leads.
- Cache de leitura em endpoints quentes.
- Backpressure nos workers WhatsApp (rate limit Meta).

---

## 17. Arquitetura Cloud

**Recomendação primária: AWS.**

```
┌─────────────────────────────────────────────────────────────────┐
│                          Route 53                               │
└─────────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CloudFront (CDN)                           │
│       app.eduflow.com.br → S3 (frontend Vue build)              │
│       api.eduflow.com.br → ALB                                  │
└─────────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ALB + WAF (regras OWASP)                      │
└─────────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ECS Fargate (containers)                      │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  Service: api    │  │ Service: workers │                     │
│  │  (2-N tasks)     │  │ (2-N tasks)      │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
        │                          │                  │
        ▼                          ▼                  ▼
┌──────────────┐         ┌──────────────┐    ┌──────────────────┐
│   RDS        │         │ ElastiCache  │    │   S3             │
│  PostgreSQL  │         │   Redis      │    │  (mídia)         │
│   Multi-AZ   │         │ Cluster Mode │    └──────────────────┘
└──────────────┘         └──────────────┘
        │
        ▼
┌──────────────┐
│  Read        │
│  Replica     │
└──────────────┘

Serviços auxiliares:
- KMS: chaves de criptografia (CPF, credentials)
- Secrets Manager: credenciais de banco, OpenAI, Meta
- CloudWatch + AWS X-Ray → observabilidade
- ECR: registry de imagens Docker
- Route 53 + ACM: DNS + TLS
- SES: e-mails transacionais
```

**CI/CD**
- GitHub Actions → build → push ECR → deploy ECS (blue/green ou rolling).
- Migrations Prisma em job dedicado antes do deploy.
- Preview environments para PRs (Fly.io ou Render).

**Custo estimado MVP (10 escolas)**
- ECS Fargate (2 tasks): ~$70
- RDS db.t4g.medium: ~$60
- ElastiCache cache.t4g.micro: ~$15
- ALB: ~$20
- CloudFront + S3: ~$10
- Logs/CloudWatch: ~$20
- **Total: ~US$ 200/mês de infra** (sem contar OpenAI e Meta)

---

## 18. Roadmap em 4 Fases

### Fase 1 — MVP (3 meses, equipe 2-3 devs)

**Objetivo:** primeira escola usando em produção, fluxo "WhatsApp → IA → pré-matrícula" funcionando.

**Entregas:**
- Auth + multi-tenant (row-level).
- CRUD lead + tag + score básico.
- Pipeline com etapas fixas.
- Inbox com Socket.IO e rooms por escola.
- WhatsApp Cloud (1 número por escola).
- Processamento de webhooks de status (delivered/read/failed).
- IA SDR com 5 tools + compressão de histórico.
- Transcrição de áudio (Whisper).
- Pré-matrícula com form + `PreEnrollmentDocument` (tabela dedicada).
- Follow-up: 3 regras com verificação de janela 24h antes de enviar.
- Simulador de WhatsApp.
- Dashboard básico.
- Settings: prompt do agente, cursos, unidades.
- CPF com HMAC para lookup seguro.

**Não entra:** templates Meta aprovados, financeiro, marketing outbound, integração ERP nativa, app mobile.

**Critérios de pronto:**
- Onboarding de nova escola em < 1h.
- IA responde em < 3s P95.
- 99% de uptime nos workers.
- LGPD: endpoint de exportação e anonimização do lead.

---

### Fase 2 — Scale (6 meses)

**Objetivo:** 100-500 escolas ativas, processo de venda autônomo, NPS > 50.

**Entregas:**
- Onboarding self-service (OAuth Meta Embedded Signup).
- **Templates aprovados Meta** — habilita follow-up fora da janela de 24h.
- Múltiplos canais: Instagram Direct, webchat, formulário Meta Lead Ads.
- Agente por canal configurável (já suportado no schema desde a Fase 1).
- Campanhas de disparo em massa (com opt-in registrado).
- Pipeline customizável.
- Permissões granulares.
- **Integração nativa com ERPs (Sponte, TOTVS, Lyceum):** sincronização bidirecional — aluno matriculado no ERP vira `Student` automaticamente, eliminando a entrada manual de dados após a venda.
- **Módulo de Suporte pós-venda via WhatsApp:**
  - Roteamento automático: aluno matriculado → fluxo de suporte; lead → fluxo SDR.
  - IA de suporte com knowledge base de FAQ pós-venda (financeiro, secretaria, TI, pedagógico).
  - Abertura, categorização e roteamento de tickets por setor diretamente do WhatsApp.
  - Fila de tickets por categoria com SLA configurável.
  - CSAT automático ao fechar ticket (nota 1-5 via WhatsApp).
  - Importação de base de alunos via CSV do ERP para popular `Student`.
- Gateway de pagamento (taxa de matrícula).
- Workspace de IA: testar prompt, A/B (SDR e Suporte separados).
- Audit log na UI.

---

### Fase 3 — Enterprise (12 meses)

- Schema-per-tenant para clientes premium.
- SSO (Google Workspace, Microsoft Entra, SAML).
- Multi-unidade com roteamento de lead.
- API pública + webhooks de saída.
- White-label completo.
- SLA 99.9% + status page.
- ISO 27001, LGPD avançado.
- Data Warehouse para BI.
- Fine-tuning por escola.

---

### Fase 4 — Marketplace Educacional (18+ meses)

- Catálogo de cursos publicáveis.
- Microcertificações.
- Trilhas educacionais.
- Programa de afiliados.
- Split de pagamento.
- App mobile do aluno.

---

## 19. Backlog Técnico do MVP

### Épico 1 — Fundação (sprint 1-2)
- [3] Setup monorepo + NestJS + Vue + ESLint + Prettier + Husky.
- [5] Docker Compose dev (postgres, redis, mailhog).
- [3] CI básico (lint + test + build).
- [5] Prisma schema inicial + migrations + seed.
- [8] Auth: login, JWT, refresh, guards, RBAC.
- [5] Multi-tenant: AsyncLocalStorage + `$extends` Prisma 5.
- [3] Logger estruturado (`pino`) + interceptor de tracing.
- [5] PrismaService + health check.
- [3] Layout base do frontend (sidebar, topbar, router, store auth).

### Épico 2 — Leads & Pipeline (sprint 3)
- [5] CRUD lead (backend + frontend).
- [3] Lookup e deduplicação de CPF via HMAC.
- [3] Importação CSV.
- [5] Pipeline + stages (CRUD).
- [8] Tela Kanban (drag-and-drop).
- [3] Tela de lead detalhado (drawer com tabs).
- [3] Lead score básico.
- [3] Filtros, busca, paginação.

### Épico 3 — WhatsApp (sprint 4)
- [5] Channel CRUD + persistência de credenciais encriptadas (KMS).
- [8] Webhook receiver + validação de assinatura.
- [5] Fila `whatsapp:incoming` + worker (atualiza `lastInboundAt`).
- [5] Fila `whatsapp:outgoing` + worker.
- **[5] Fila `whatsapp:status` + worker (delivered/read/failed → atualiza Message).**
- [5] Conversation + Message models + repositórios.
- [5] Download e upload de mídia (S3).
- [3] Fila `media:transcribe` (Whisper).
- [3] Idempotência (`whatsappMessageId` como `jobId`).

### Épico 4 — Inbox (sprint 5)
- [5] Lista de conversas (Vue + Pinia).
- [5] Thread de mensagens com paginação reversa.
- **[8] Socket.IO gateway com rooms por escola (`school:{id}`) + cliente.**
- [5] Composer com aviso de janela 24h.
- [3] Indicadores de status de entrega (enviado/entregue/lido).
- [3] Assumir / liberar conversa.
- [3] Drawer do lead lateral.

### Épico 5 — IA SDR (sprint 6-7)
- [3] OpenAiService com tracking de tokens.
- [8] Prompt builder + tools.
- **[5] HistoryCompressor com cache Redis (resumo de histórico longo).**
- [13] AiSdrService com seleção de agente por canal + compressão de histórico.
- [5] AiAgent CRUD + tela de configuração (com suporte a `channelId` opcional).
- [5] Knowledge base (cursos, unidades, FAQ) editável.
- [5] Simulador in-app.
- [3] Limites de token por escola.

### Épico 6 — Pré-matrícula (sprint 8)
- [5] PreEnrollment model + service.
- **[3] PreEnrollmentDocument (tabela dedicada, não JSON).**
- [5] Tool `create_pre_enrollment` na IA.
- [8] Tela de pré-matrícula (form com docs).
- [3] Upload, validação e revisão de documentos por tipo.
- [3] Exportação CSV/JSON.

### Épico 7 — Follow-up (sprint 9)
- [3] FollowUpRule + FollowUpJob models.
- [5] Scheduler com BullMQ delayed jobs.
- **[5] Helper `whatsapp-window.helper.ts` + verificação de janela 24h no worker.**
- [5] 3 regras default (1h, 24h com check, 72h com check).
- [3] Tela de configuração de regras.
- [3] Cancelamento automático ao receber resposta do lead.

### Épico 8 — Dashboard & Observabilidade (sprint 10)
- [5] Dashboard com KPIs (leads/dia, conversão, tempo de resposta).
- [3] Página de uso de IA (tokens, custo, top conversas).
- [5] Métricas internas (Prometheus exporter).
- [3] Sentry/Datadog para erros.

### Épico 10 — Suporte pós-venda (Fase 2 — após MVP validado)
- [3] `Student`, `Ticket`, `TicketCategory`, `TicketMessage` — migrations.
- [5] `ConversationRouter` — identifica lead vs aluno pelo número do WhatsApp.
- [5] `SupportService` — agente IA de suporte com prompt e knowledge base separados.
- [3] Importação de alunos via CSV do ERP → popula `Student`.
- [8] Integração nativa com ERP: aluno matriculado → `Student` criado automaticamente.
- [5] Tela de tickets (lista, detalhe, troca de status, atribuição por setor).
- [3] Categorias de ticket configuráveis por escola + roteamento por role.
- [3] SLA por categoria com alerta quando próximo de vencer.
- [3] CSAT automático pós-resolução via WhatsApp (nota 1-5).
- [5] Dashboard de suporte: volume de tickets, tempo médio de resolução, CSAT.

### Épico 9 — Polish & Lançamento (sprint 11-12)
- [5] Auditoria (`AuditLog`) em ações sensíveis.
- [5] LGPD: exportação e anonimização.
- [3] Settings da escola (prompt, cursos, branding básico).
- [5] Documentação de onboarding (público).
- [5] Setup de infra AWS (Terraform).
- [5] Pipeline de deploy ECS.
- [3] Beta com 1 escola parceira.

---

## Apêndice — Decisões Técnicas Resumidas

| Tema | Decisão | Alternativa rejeitada | Por quê |
|---|---|---|---|
| Backend | NestJS modular | Express puro, Fastify | Estrutura, DI, ecossistema |
| ORM | Prisma 5 (`$extends`) | TypeORM, Drizzle | DX superior, tipo seguro, migrations versionadas |
| Multi-tenant | `$extends` + RLS | Schema-per-tenant | Custo/manutenção no MVP |
| DB | PostgreSQL | MySQL, MongoDB | JSONB + RLS + GIN index + pgvector futuro |
| Lookup CPF | HMAC indexável | Descriptografar tudo | Permite busca sem expor dado em memória |
| Documentos de pré-matrícula | Tabela dedicada | JSON array | Permite filtro por status com índice |
| Realtime | Socket.IO com rooms por escola | Broadcast global | Isolamento de tenant na camada de realtime |
| Filas | BullMQ (inclui `whatsapp:status`) | SQS, RabbitMQ | Mesma stack (Redis), DX excelente |
| Janela 24h WA | Verificação no worker de follow-up | Tratar na Fase 2 | Evita erros 131047 em produção desde o MVP |
| Histórico de IA | Resumo comprimido cacheado no Redis | Contexto completo | Custo de tokens linear sem compressão |
| Agente IA | Por canal ou padrão da escola | Único por escola | Suporta tom diferente por canal sem refactor |
| Frontend | Vue 3 + Pinia | React, Svelte | Decisão do time |
| UI | TailwindCSS | Vuetify, PrimeVue | Customização, sem peso de framework |
| Auth | JWT + refresh | Sessions, NextAuth | Stateless, fácil para mobile futuro |
| Roteamento lead/aluno | `ConversationRouter` por phone | Flag manual por conversa | Automático e sem depender do atendente |
| Tickets de suporte | Módulo interno com `Ticket` + `TicketMessage` | Zendesk/Freshdesk | Evita integração externa no MVP; suficiente até escala |
| Identificação de aluno | `Student.phone` com sync do ERP | Perguntar RA no WhatsApp | Experiência transparente para o aluno |
| Cloud | AWS ECS Fargate | EKS, EC2 | Menos ops para MVP |

---

**Próximos passos imediatos (semana 1):**
1. Validar este documento com o time.
2. Criar repositório monorepo + boilerplate.
3. Provisionar conta AWS + ambiente staging.
4. Iniciar Épico 1.
5. Em paralelo: pedir acesso à Meta for Developers, criar app, número de teste.
6. Definir 1 escola parceira para beta.

Fim do documento.