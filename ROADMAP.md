# EDU.IA — Roadmap Comercial e Técnico

## Visão do produto

EDU.IA é uma plataforma SaaS de captação de alunos com IA.
A proposta de valor central é: **a IA qualifica o lead sozinha, sem formulário, sem script fixo** —
algo que nenhum concorrente direto (ChatPro, Harux) oferece hoje.

O lead chega, conversa com a IA no WhatsApp como se estivesse falando com um atendente humano.
A IA coleta curso, unidade, turno e nome de forma natural. O time comercial só precisa fechar.

---

## O que já está pronto (Fase 1 — concluída)

| Módulo | Status |
|---|---|
| Auth com JWT e logout forçado | ✅ |
| Multi-tenancy — cada escola vê só seus dados | ✅ |
| RBAC — perfis SUPER_ADMIN / SCHOOL_ADMIN / CONSULTANT | ✅ |
| Simulador de chat com IA (GPT-4o-mini) | ✅ |
| Captura automática de leads da conversa | ✅ |
| Pipeline Kanban (5 colunas + animação) | ✅ |
| Avançar/perder lead pelo Kanban | ✅ |
| Dashboard com métricas e gráficos | ✅ |
| Exportar leads para CSV | ✅ |
| Alerta visual de leads parados há +24h | ✅ |
| Backend serverless (Vercel-ready) | ✅ |
| Banco PostgreSQL via Supabase | ✅ |

---

## Fase 2 — O que implementar para ter o produto comercial completo

### 🔴 Alta prioridade — sem isso não tem produto vendável

---

#### 2.1 WhatsApp real (Evolution API)
**Por que é crítico:** hoje temos um simulador dentro do sistema. O cliente quer que a IA responda
no WhatsApp de verdade — é o canal que os alunos já usam.

**Como implementar:**
- Subir uma instância do [Evolution API](https://evolution-api.com) (open source, gratuito)
  em um VPS barato (R$ 20-40/mês na DigitalOcean ou Contabo)
- O Evolution API conecta via QR code — não precisa de conta Business verificada
- Criar webhook: quando chega mensagem no WhatsApp → chama o endpoint `/simulator/messages`
- Backend responde → Evolution API envia a resposta de volta pro aluno

**Esforço estimado:** 2-3 dias de desenvolvimento

---

#### 2.2 Separação por escola (nome da escola na IA)
**Por que é crítico:** hoje a IA fala em nome de "Colégio Exemplo".
Cada escola precisa ter sua própria identidade configurável.

**Como implementar:**
- Adicionar campo `chatbotName`, `courses`, `units` no model `School` do Prisma
- Tela de configuração para o SCHOOL_ADMIN editar esses dados
- System prompt da IA usa os dados da escola em vez de valores fixos no código

**Esforço estimado:** 1 dia

---

### 🟡 Média prioridade — diferencia do concorrente

---

#### 2.3 Follow-up automático (sequência de mensagens)
**O que é:** se um lead fica X horas sem responder, a IA manda uma mensagem de lembrete automático.

**Como implementar:**
- Cron job no backend (NestJS `@nestjs/schedule`)
- Busca leads em status NOVO com `createdAt` há mais de 24h
- Envia mensagem via Evolution API: "Oi [nome], ainda tem interesse no curso de [curso]?"
- Configura até 3 tentativas (24h, 48h, 72h)

**Esforço estimado:** 1 dia (depois do WhatsApp real estar funcionando)

---

#### 2.4 Multi-atendente (inbox compartilhado)
**O que é:** vários consultores vendo e assumindo leads da fila.
Hoje qualquer SCHOOL_ADMIN vê todos os leads — falta atribuir leads a consultores específicos.

**Como implementar:**
- Campo `assignedTo` (userId) no model Lead
- Tela de atribuição no Kanban (dropdown por card)
- Filtro "Meus leads" vs "Todos os leads"
- Notificação quando um lead é atribuído

**Esforço estimado:** 2 dias

---

#### 2.5 Notificações em tempo real
**O que é:** badge ou som quando um novo lead chega, sem precisar recarregar a página.

**Como implementar:**
- WebSocket com `@nestjs/websockets` (Socket.io)
- Emite evento `new-lead` quando um lead é criado
- Frontend escuta o evento e atualiza o Kanban + mostra toast

**Esforço estimado:** 1 dia

---

### 🟢 Baixa prioridade — para quando tiver clientes pagando

---

#### 2.6 Painel Super Admin
Tela para o sócio ver todas as escolas cadastradas, leads totais por escola, MRR.
Necessário para gestão do próprio negócio quando tiver 10+ clientes.

**Esforço estimado:** 2 dias

---

#### 2.7 Formulário de captação embutível
Widget JavaScript que a escola cola no próprio site.
O visitante preenche nome + telefone → vira lead automaticamente no sistema.
Complementa o WhatsApp (não substitui).

**Esforço estimado:** 2 dias

---

#### 2.8 Disparos em massa (broadcast)
Enviar mensagem para uma lista de leads de uma vez.
Útil para campanhas de matrícula ("Últimas vagas para Enfermagem!").
**Atenção:** WhatsApp Business API tem regras rígidas — risco de banimento se abusado.

**Esforço estimado:** 2 dias (após Evolution API)

---

#### 2.9 Integração com sistemas acadêmicos (SIS)
Quando o lead vira MATRICULADO, exportar automaticamente para o sistema da escola
(Totvs, Lyceum, SGB, etc) via API ou planilha.
**Esforço estimado:** variável por sistema (1-5 dias cada)

---

## Sequência recomendada de implementação

```
Agora (sem custos extras):
  ✅ Dashboard + CSV + Alertas de follow-up  ← já implementado

Próxima sprint (1-2 semanas):
  → 2.2 Configuração por escola (nome, cursos, unidades)
  → 2.1 Evolution API (WhatsApp real)

Sprint seguinte:
  → 2.3 Follow-up automático
  → 2.5 Notificações em tempo real

Quando tiver 5+ clientes:
  → 2.4 Multi-atendente
  → 2.6 Super Admin
  → 2.7 Formulário embutível
```

---

## Modelo de negócio sugerido

| Plano | Preço/mês | Limites |
|---|---|---|
| **Starter** | R$ 197 | 1 unidade, até 200 leads/mês |
| **Pro** | R$ 397 | 3 unidades, leads ilimitados |
| **Enterprise** | R$ 797 | Unidades ilimitadas + suporte prioritário |

**Custo de infraestrutura por cliente:**
- Vercel (frontend + backend): gratuito até ~100k req/mês
- Supabase: gratuito até 500MB
- OpenAI: ~R$ 5-15/cliente/mês dependendo do volume de conversas
- Evolution API: ~R$ 30/mês compartilhado entre todos os clientes

**Margem estimada no plano Starter:** ~85%

---

## Concorrência — onde a EDU.IA ganha

| Critério | ChatPro | Harux | **EDU.IA** |
|---|---|---|---|
| IA que qualifica sozinha | ❌ | ❌ | ✅ |
| Configuração sem TI | ✅ | ❌ | ✅ |
| Foco em educação | ❌ | ✅ | ✅ |
| Preço acessível | ❌ (caro) | ❌ (caro) | ✅ |
| Pipeline Kanban | ✅ | ✅ | ✅ |
| WhatsApp real | ✅ | ✅ | 🔄 em breve |

**O pitch:** "A IA atende o aluno, qualifica o interesse e organiza os leads automaticamente.
Seu time só entra em contato com quem já demonstrou interesse."
