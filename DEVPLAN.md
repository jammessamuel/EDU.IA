# Plano de execução — Demo em 5 dias

> Reunião com o empresário confirmada para a semana que vem.
> Meta: demonstração funcionando com simulador de WhatsApp + IA + Kanban de leads.

---

## O que a demo precisa mostrar

1. **Simulador de WhatsApp** — você digita como se fosse o aluno, a IA responde em segundos com as perguntas de qualificação da escola
2. **Lead aparecendo no Kanban** — após a IA coletar os dados, o lead aparece automaticamente no funil com nome, curso e turno preenchidos
3. **Prompt personalizado** — a IA sabe o nome da escola, os cursos e as unidades do empresário

---

## Divisão de trabalho

| Samuel | Dev |
|---|---|
| Backend: OpenAI + Simulator API | Frontend: Vue + Simulator screen |
| Prisma schema + migrations | Frontend: Kanban de leads |
| Deploy no Railway | Integração com a API do backend |

---

## Dia 1 — Hoje

### Backend (Samuel)

```bash
# 1. Subir infra local
cp .env.example .env
# editar .env com sua OPENAI_API_KEY
docker compose up -d

# 2. Criar projeto NestJS
cd /Users/samueljammes/Developer/EDU.IA
npx @nestjs/cli new backend --package-manager pnpm --skip-git
cd backend

# 3. Instalar dependências
pnpm add @prisma/client prisma openai @nestjs/config class-validator class-transformer

# 4. Inicializar Prisma
npx prisma init
```

Depois, substituir o conteúdo de `backend/prisma/schema.prisma` pelo schema simplificado abaixo (ver Seção "Schema da demo").

```bash
# 5. Rodar migration
npx prisma migrate dev --name init

# 6. Rodar backend
pnpm start:dev
```

### Frontend (Jucelino)

```bash
cd /Users/samueljammes/Developer/EDU.IA
pnpm create vue@latest frontend
# selecionar: TypeScript ✅, Vue Router ✅, Pinia ✅
cd frontend
pnpm add axios tailwindcss @tailwindcss/vite
pnpm dev
```

---

## Dia 2 — Backend: OpenAI + Simulator API

Criar os seguintes arquivos no backend:

### `src/simulator/simulator.controller.ts`
```typescript
import { Controller, Post, Body, Delete, Session } from '@nestjs/common';
import { SimulatorService } from './simulator.service';

@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('messages')
  send(@Body() body: { text: string }, @Session() session: any) {
    if (!session.messages) session.messages = [];
    return this.simulatorService.chat(body.text, session.messages);
  }

  @Delete('session')
  reset(@Session() session: any) {
    session.messages = [];
    return { ok: true };
  }
}
```

### `src/simulator/simulator.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

// Trocar pelos dados reais da escola na reunião
const SCHOOL_NAME = 'Colégio Exemplo';
const COURSES = ['Enfermagem', 'Administração', 'Direito', 'Pedagogia'];
const UNITS = ['Centro', 'Norte', 'Sul'];

const SYSTEM_PROMPT = `
Você é o atendente virtual do ${SCHOOL_NAME}.
Seu objetivo é qualificar o interesse do aluno coletando as seguintes informações, UMA POR VEZ:
1. Qual curso tem interesse
2. Qual unidade prefere (${UNITS.join(', ')})
3. Qual turno prefere (manhã, tarde ou noite)
4. Nome completo
5. Se é maior de 18 anos

REGRAS:
- Seja cordial e objetivo, em português brasileiro
- Faça apenas UMA pergunta por mensagem
- Quando tiver todas as informações, diga que um atendente vai entrar em contato em breve e agradeça

CURSOS DISPONÍVEIS: ${COURSES.join(', ')}
`.trim();

@Injectable()
export class SimulatorService {
  private client: OpenAI;

  constructor(private config: ConfigService) {
    this.client = new OpenAI({ apiKey: config.get('OPENAI_API_KEY') });
  }

  async chat(text: string, history: any[]) {
    history.push({ role: 'user', content: text });

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-10),
      ],
      temperature: 0.4,
      max_tokens: 300,
    });

    const reply = response.choices[0].message.content ?? '';
    history.push({ role: 'assistant', content: reply });

    // Extrai lead quando qualificado
    const lead = await this.tryExtractLead(history);

    return { reply, lead };
  }

  private async tryExtractLead(history: any[]) {
    if (history.length < 8) return null;

    const extraction = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analise a conversa e extraia os dados do lead em JSON.
          Se ainda não tiver nome + curso + unidade + turno, retorne null.
          Formato: {"name":"...","course":"...","unit":"...","shift":"...","qualified":true}`,
        },
        {
          role: 'user',
          content: history.map(m => `${m.role}: ${m.content}`).join('\n'),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 200,
    });

    try {
      const data = JSON.parse(extraction.choices[0].message.content ?? '{}');
      return data.qualified ? data : null;
    } catch {
      return null;
    }
  }
}
```

---

## Dia 3 — Frontend: Tela do Simulador

Criar `frontend/src/pages/Simulator.vue`:

```vue
<script setup lang="ts">
import { ref, nextTick } from 'vue'
import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:3000', withCredentials: true })

interface Message { from: 'user' | 'ai'; text: string }
interface Lead { name: string; course: string; unit: string; shift: string }

const messages = ref<Message[]>([
  { from: 'ai', text: 'Olá! Seja bem-vindo. Em que posso te ajudar hoje?' }
])
const input = ref('')
const loading = ref(false)
const leads = ref<Lead[]>([])
const container = ref<HTMLElement>()

async function send() {
  const text = input.value.trim()
  if (!text || loading.value) return

  messages.value.push({ from: 'user', text })
  input.value = ''
  loading.value = true

  await nextTick()
  container.value?.scrollTo({ top: container.value.scrollHeight, behavior: 'smooth' })

  const { data } = await api.post('/simulator/messages', { text })
  messages.value.push({ from: 'ai', text: data.reply })

  if (data.lead) {
    leads.value.unshift(data.lead)
  }

  loading.value = false
  await nextTick()
  container.value?.scrollTo({ top: container.value.scrollHeight, behavior: 'smooth' })
}

async function reset() {
  await api.delete('/simulator/session')
  messages.value = [{ from: 'ai', text: 'Olá! Seja bem-vindo. Em que posso te ajudar hoje?' }]
  input.value = ''
}
</script>

<template>
  <div class="flex h-screen bg-gray-100">

    <!-- Chat -->
    <div class="flex flex-col w-[420px] bg-white shadow-xl">
      <!-- Header estilo WhatsApp -->
      <div class="flex items-center gap-3 bg-green-600 px-4 py-3 text-white">
        <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">E</div>
        <div>
          <p class="font-semibold text-sm">Colégio Exemplo</p>
          <p class="text-xs text-green-200">IA Atendente • online</p>
        </div>
        <button @click="reset" class="ml-auto text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30">
          Reiniciar
        </button>
      </div>

      <!-- Mensagens -->
      <div ref="container" class="flex-1 overflow-y-auto p-4 space-y-3" style="background: #ece5dd">
        <div v-for="(msg, i) in messages" :key="i" class="flex" :class="msg.from === 'user' ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[75%] px-3 py-2 rounded-lg text-sm shadow-sm"
            :class="msg.from === 'user' ? 'bg-green-500 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'"
          >
            {{ msg.text }}
          </div>
        </div>
        <div v-if="loading" class="flex justify-start">
          <div class="bg-white px-4 py-2 rounded-lg text-gray-400 text-sm shadow-sm">digitando...</div>
        </div>
      </div>

      <!-- Input -->
      <div class="flex items-center gap-2 p-3 bg-gray-50 border-t">
        <input
          v-model="input"
          @keydown.enter="send"
          placeholder="Digite uma mensagem..."
          class="flex-1 px-3 py-2 rounded-full border border-gray-300 text-sm focus:outline-none focus:border-green-500"
        />
        <button @click="send" :disabled="loading || !input.trim()" class="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-green-600">
          ▶
        </button>
      </div>
    </div>

    <!-- Kanban de leads qualificados -->
    <div class="flex-1 p-6">
      <h2 class="text-lg font-semibold text-gray-700 mb-4">Leads qualificados pela IA</h2>

      <div v-if="leads.length === 0" class="text-gray-400 text-sm">
        Converse com o simulador até a IA coletar todos os dados. O lead vai aparecer aqui automaticamente.
      </div>

      <div class="space-y-3">
        <div v-for="(lead, i) in leads" :key="i" class="bg-white rounded-xl p-4 shadow border-l-4 border-green-500">
          <p class="font-semibold text-gray-800">{{ lead.name }}</p>
          <div class="flex gap-3 mt-2 text-xs text-gray-500">
            <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{{ lead.course }}</span>
            <span class="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{{ lead.unit }}</span>
            <span class="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{{ lead.shift }}</span>
          </div>
          <p class="text-xs text-green-600 mt-2 font-medium">✓ Qualificado pela IA</p>
        </div>
      </div>
    </div>

  </div>
</template>
```

---

## Dia 4 — Ajustar para a escola do empresário

Antes da reunião, editar em `simulator.service.ts`:

```typescript
const SCHOOL_NAME = 'Nome Real da Escola';
const COURSES = ['Curso 1', 'Curso 2', ...]; // cursos reais
const UNITS = ['Unidade 1', 'Unidade 2', ...]; // unidades reais
```

---

## Dia 5 — Deploy para acesso externo

```bash
# Railway (gratuito para demo)
npm install -g @railway/cli
railway login
railway new
railway add postgresql redis
railway up
```

Você vai ter uma URL pública para abrir na reunião — sem precisar ligar notebook.

---

## Schema simplificado para a demo

Usar um schema mínimo apenas para salvar os leads qualificados:

```prisma
model Lead {
  id        String   @id @default(uuid())
  name      String
  course    String
  unit      String
  shift     String
  qualified Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

O schema completo do ARCHITECTURE.md entra depois que o investimento for confirmado.

---

## Script da demonstração (ensaiar antes da reunião)

1. Abrir a URL no celular do empresário
2. Dizer: *"Isso é o WhatsApp da sua escola. Você vai ser o aluno."*
3. Pedir para ele digitar: *"Oi, quero saber sobre o curso de enfermagem"*
4. Deixar a conversa fluir — a IA vai coletar os dados automaticamente
5. Quando o lead aparecer no painel: *"Olha — nome, curso, unidade, turno. Sem nenhum atendente, em menos de 2 minutos."*
6. Perguntar: *"Quantos leads assim chegam no WhatsApp de vocês por semana e ninguém responde a tempo?"*

A pergunta final é a que fecha o investimento.
