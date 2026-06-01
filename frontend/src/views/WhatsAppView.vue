<script setup lang="ts">
import { ref, computed, reactive, nextTick, onMounted } from 'vue'
import AppNav from '@/components/layout/AppNav.vue'
import { simulatorApi } from '@/api/simulator'
import { useSimulatorStore } from '@/stores/simulator'

const store = useSimulatorStore()
onMounted(() => store.fetchLeads())

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface Msg { id: string; from: 'ai' | 'user'; text: string; ts: Date }

interface ContactDef {
  id: string
  phone: string
  city: string
  lead: { name: string; course: string; unit: string; shift: string; status: string } | null
  history: Array<{ from: 'ai' | 'user'; text: string; minutesAgo: number }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Dados hardcoded — 5 conversas simuladas
// ─────────────────────────────────────────────────────────────────────────────
const CONTACTS: ContactDef[] = [
  {
    id: 'c1',
    phone: '+55 (11) 99234-5678',
    city: 'São Paulo',
    lead: { name: 'Camila Souza', course: 'Enfermagem', unit: 'Centro', shift: 'manhã', status: 'NOVO' },
    history: [
      { from: 'ai',   text: 'Olá! 👋 Seja bem-vindo à nossa instituição. Como posso te ajudar hoje?', minutesAgo: 47 },
      { from: 'user', text: 'Oi, quero saber mais sobre os cursos de saúde', minutesAgo: 46 },
      { from: 'ai',   text: 'Que ótimo! Temos um excelente curso de Enfermagem disponível 🩺 Você teria interesse nessa área?', minutesAgo: 46 },
      { from: 'user', text: 'Sim, Enfermagem mesmo', minutesAgo: 45 },
      { from: 'ai',   text: 'Perfeito! Temos unidades no Centro, Norte e Sul. Qual fica mais conveniente pra você?', minutesAgo: 44 },
      { from: 'user', text: 'Centro, fica perto do meu trabalho', minutesAgo: 43 },
      { from: 'ai',   text: 'Ótimo! E qual turno você prefere: manhã, tarde ou noite?', minutesAgo: 42 },
      { from: 'user', text: 'Manhã', minutesAgo: 41 },
      { from: 'ai',   text: 'Para finalizar, qual é o seu nome completo?', minutesAgo: 40 },
      { from: 'user', text: 'Camila Souza', minutesAgo: 39 },
      { from: 'ai',   text: 'Perfeito, Camila! ✅ Suas informações foram registradas. Um consultor vai entrar em contato em breve com todos os detalhes sobre o curso de Enfermagem na unidade Centro. Qualquer dúvida, estou por aqui! 😊', minutesAgo: 38 },
    ],
  },
  {
    id: 'c2',
    phone: '+55 (21) 97654-3210',
    city: 'Rio de Janeiro',
    lead: { name: 'Lucas Rodrigues', course: 'Direito', unit: 'Sul', shift: 'tarde', status: 'CONTATO' },
    history: [
      { from: 'ai',   text: 'Olá! 👋 Seja bem-vindo. Como posso te ajudar hoje?', minutesAgo: 130 },
      { from: 'user', text: 'Tenho interesse em fazer Direito', minutesAgo: 128 },
      { from: 'ai',   text: 'Excelente escolha! ⚖️ Nosso curso de Direito tem ótima reputação. Temos unidades no Centro, Norte e Sul — qual seria mais acessível para você?', minutesAgo: 127 },
      { from: 'user', text: 'Prefiro a unidade Sul', minutesAgo: 126 },
      { from: 'ai',   text: 'Certo! Qual turno você teria disponibilidade: manhã, tarde ou noite?', minutesAgo: 125 },
      { from: 'user', text: 'Tarde seria ideal', minutesAgo: 124 },
      { from: 'ai',   text: 'Ótimo! Qual é o seu nome completo para eu registrar seu interesse?', minutesAgo: 123 },
      { from: 'user', text: 'Lucas Rodrigues', minutesAgo: 122 },
      { from: 'ai',   text: 'Obrigado, Lucas! ✅ Seus dados foram registrados com sucesso. Nossa equipe vai entrar em contato em breve. Até logo! 😊', minutesAgo: 120 },
      { from: 'user', text: 'Obrigado! Aguardo o contato', minutesAgo: 118 },
      { from: 'ai',   text: 'Qualquer dúvida que surgir pode falar por aqui. Bom dia! 👋', minutesAgo: 117 },
    ],
  },
  {
    id: 'c3',
    phone: '+55 (31) 98123-4567',
    city: 'Belo Horizonte',
    lead: { name: 'Mariana Costa', course: 'Administração', unit: 'Sul', shift: 'tarde', status: 'INSCRITO' },
    history: [
      { from: 'ai',   text: 'Olá! 👋 Seja bem-vindo. Como posso te ajudar hoje?', minutesAgo: 300 },
      { from: 'user', text: 'Quero me inscrever em Administração', minutesAgo: 298 },
      { from: 'ai',   text: 'Ótima escolha! 📊 O curso de Administração forma profissionais muito valorizados pelo mercado. Qual unidade você prefere: Centro, Norte ou Sul?', minutesAgo: 297 },
      { from: 'user', text: 'Sul', minutesAgo: 295 },
      { from: 'ai',   text: 'Perfeito! Qual turno: manhã, tarde ou noite?', minutesAgo: 294 },
      { from: 'user', text: 'Tarde', minutesAgo: 293 },
      { from: 'ai',   text: 'Qual é o seu nome completo?', minutesAgo: 292 },
      { from: 'user', text: 'Mariana Costa', minutesAgo: 290 },
      { from: 'ai',   text: 'Tudo certo, Mariana! ✅ Interesse registrado para o curso de Administração, tarde, unidade Sul. Em breve nosso time vai te contatar. 😊', minutesAgo: 288 },
      { from: 'user', text: 'Perfeito! Já falei com o consultor e vou me inscrever sim 🎉', minutesAgo: 60 },
      { from: 'ai',   text: 'Que notícia incrível, Mariana! 🎉 Seja muito bem-vinda! O time vai te enviar os próximos passos da inscrição. Qualquer dúvida, estou aqui!', minutesAgo: 59 },
    ],
  },
  {
    id: 'c4',
    phone: '+55 (41) 99876-5432',
    city: 'Curitiba',
    lead: { name: 'Thiago Martins', course: 'Enfermagem', unit: 'Sul', shift: 'tarde', status: 'MATRICULADO' },
    history: [
      { from: 'ai',   text: 'Olá! 👋 Seja bem-vindo. Como posso te ajudar hoje?', minutesAgo: 600 },
      { from: 'user', text: 'Boa tarde! Quero informação sobre Enfermagem', minutesAgo: 598 },
      { from: 'ai',   text: 'Boa tarde! 🩺 Nosso curso de Enfermagem é um dos mais completos da região. Qual unidade fica melhor pra você — Centro, Norte ou Sul?', minutesAgo: 597 },
      { from: 'user', text: 'Sul por favor', minutesAgo: 595 },
      { from: 'ai',   text: 'Excelente! E qual turno: manhã, tarde ou noite?', minutesAgo: 594 },
      { from: 'user', text: 'Tarde', minutesAgo: 592 },
      { from: 'ai',   text: 'Perfeito! Me diz seu nome completo para registrar?', minutesAgo: 591 },
      { from: 'user', text: 'Thiago Martins', minutesAgo: 590 },
      { from: 'ai',   text: 'Prontinho, Thiago! ✅ Interesse registrado. Nosso consultor vai te ligar em breve. 😊', minutesAgo: 588 },
      { from: 'user', text: 'Falei com o consultor, gostei muito e já fiz a matrícula! 🎓', minutesAgo: 120 },
      { from: 'ai',   text: 'Parabéns, Thiago! 🎓🎉 Seja muito bem-vindo à família! Você fez uma ótima escolha. Qualquer dúvida durante o curso, pode contar conosco!', minutesAgo: 119 },
      { from: 'user', text: 'Muito obrigado pelo atendimento! Foi rápido e eficiente 👏', minutesAgo: 118 },
      { from: 'ai',   text: 'Fico feliz em ter ajudado! Até breve e bons estudos! 📚', minutesAgo: 117 },
    ],
  },
  {
    id: 'c5',
    phone: '+55 (85) 98421-1234',
    city: 'Fortaleza',
    lead: null,
    history: [
      { from: 'ai',   text: 'Olá! 👋 Seja bem-vindo. Como posso te ajudar hoje?', minutesAgo: 3 },
      { from: 'user', text: 'Oi, quero saber sobre o curso de Pedagogia', minutesAgo: 2 },
      { from: 'ai',   text: 'Que ótimo! 👩‍🏫 O curso de Pedagogia forma educadores incríveis. Temos unidades no Centro, Norte e Sul — qual fica mais perto de você?', minutesAgo: 1 },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Estado reativo das conversas
// ─────────────────────────────────────────────────────────────────────────────
interface ConvState {
  messages: Msg[]
  isTyping: boolean
  isSending: boolean
  lead: ContactDef['lead']
}

function buildMessages(history: ContactDef['history']): Msg[] {
  const now = Date.now()
  return history.map((h, i) => ({
    id: `pre-${i}`,
    from: h.from,
    text: h.text,
    ts: new Date(now - h.minutesAgo * 60_000),
  }))
}

const convs = reactive<Record<string, ConvState>>({})
CONTACTS.forEach((c) => {
  convs[c.id] = {
    messages: buildMessages(c.history),
    isTyping: false,
    isSending: false,
    lead: c.lead,
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Navegação
// ─────────────────────────────────────────────────────────────────────────────
const selectedId = ref(CONTACTS[0].id)
const current     = computed(() => convs[selectedId.value])
const contact     = computed(() => CONTACTS.find((c) => c.id === selectedId.value)!)
const messagesEl  = ref<HTMLElement>()

function select(id: string) {
  selectedId.value = id
  nextTick(scrollToBottom)
}

function scrollToBottom() {
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

// ─────────────────────────────────────────────────────────────────────────────
// Envio de mensagem
// ─────────────────────────────────────────────────────────────────────────────
const inputText = ref('')

async function send() {
  const text = inputText.value.trim()
  const conv  = current.value
  if (!text || conv.isSending) return

  inputText.value = ''
  conv.isSending  = true

  const history = conv.messages
    .filter((m) => !m.id.startsWith('pre-') || true)
    .map((m) => ({
      role: m.from === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }))

  conv.messages.push({ id: crypto.randomUUID(), from: 'user', text, ts: new Date() })
  await nextTick(); scrollToBottom()
  await new Promise((r) => setTimeout(r, 350))
  conv.isTyping = true
  await nextTick(); scrollToBottom()

  try {
    const res = await simulatorApi.sendMessage(text, history)
    conv.isTyping = false
    conv.messages.push({ id: crypto.randomUUID(), from: 'ai', text: res.reply, ts: new Date() })

    if (res.lead && !conv.lead) {
      conv.lead = { ...res.lead, status: res.lead.status }
      if (!store.leads.find((l) => l.id === res.lead!.id)) store.leads.unshift(res.lead)
    }
  } catch {
    conv.isTyping = false
    conv.messages.push({ id: crypto.randomUUID(), from: 'ai', text: '⚠ Erro de conexão. Tente novamente.', ts: new Date() })
  } finally {
    conv.isSending = false
    await nextTick(); scrollToBottom()
  }
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers visuais
// ─────────────────────────────────────────────────────────────────────────────
function fmtTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtTimeAgo(d: Date) {
  const diff = Math.round((Date.now() - d.getTime()) / 60_000)
  if (diff < 1)   return 'agora'
  if (diff < 60)  return `${diff}m`
  if (diff < 1440) return `${Math.round(diff / 60)}h`
  return `${Math.round(diff / 1440)}d`
}

function lastMsg(id: string) {
  const msgs = convs[id].messages
  return msgs[msgs.length - 1]
}

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo Lead', CONTATO: 'Em Contato', INSCRITO: 'Inscrito',
  MATRICULADO: 'Matriculado', PERDIDO: 'Perdido',
}

const STATUS_COLOR: Record<string, string> = {
  NOVO: '#2080f0', CONTATO: '#f0a020', INSCRITO: '#8a2be2',
  MATRICULADO: '#18a058', PERDIDO: '#aaa',
}
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="wa-layout">
      <!-- ── Sidebar ── -->
      <aside class="wa-sidebar">
        <div class="wa-sidebar__header">
          <div class="wa-sidebar__title">
            <span class="wa-icon">W</span> WhatsApp
          </div>
          <span class="wa-sim-pill">simulado</span>
        </div>

        <div
          v-for="c in CONTACTS"
          :key="c.id"
          class="wa-item"
          :class="{ 'wa-item--active': selectedId === c.id }"
          @click="select(c.id)"
        >
          <div class="wa-item__avatar">
            <span>{{ c.phone.slice(-4, -2) }}</span>
            <span
              v-if="convs[c.id].lead?.status === 'MATRICULADO'"
              class="wa-item__check"
            >✓</span>
          </div>

          <div class="wa-item__body">
            <div class="wa-item__row">
              <span class="wa-item__name">
                {{ convs[c.id].lead?.name ?? c.phone }}
              </span>
              <span class="wa-item__time">{{ fmtTimeAgo(lastMsg(c.id).ts) }}</span>
            </div>
            <div class="wa-item__sub">
              <span
                v-if="convs[c.id].lead"
                class="wa-item__pill"
                :style="{ background: STATUS_COLOR[convs[c.id].lead!.status] }"
              >
                {{ STATUS_LABEL[convs[c.id].lead!.status] }}
              </span>
              <span v-else class="wa-item__preview">
                {{ lastMsg(c.id).text.slice(0, 36) }}…
              </span>
            </div>
          </div>
        </div>
      </aside>

      <!-- ── Conversa ── -->
      <section class="wa-chat">

        <!-- Header -->
        <div class="wa-chat__head">
          <div class="wa-chat__avatar">{{ contact.phone.slice(-4, -2) }}</div>
          <div class="wa-chat__info">
            <div class="wa-chat__name">
              {{ current.lead?.name ?? contact.phone }}
            </div>
            <div class="wa-chat__meta">
              <template v-if="current.lead">
                <span class="wa-chat__course">{{ current.lead.course }} · {{ current.lead.unit }} · {{ current.lead.shift }}</span>
                <span
                  class="wa-chat__status"
                  :style="{ background: STATUS_COLOR[current.lead.status] }"
                >{{ STATUS_LABEL[current.lead.status] }}</span>
              </template>
              <span v-else class="wa-chat__city">{{ contact.city }} · qualificando…</span>
            </div>
          </div>
          <span class="wa-badge-pill">via WhatsApp simulado</span>
        </div>

        <!-- Mensagens -->
        <div ref="messagesEl" class="wa-msgs">
          <!-- Separador de data para mensagens antigas -->
          <div class="wa-date-sep">Hoje</div>

          <div
            v-for="msg in current.messages"
            :key="msg.id"
            class="msg-row"
            :class="{ 'msg-row--user': msg.from === 'user' }"
          >
            <div class="bubble" :class="msg.from === 'user' ? 'bubble--user' : 'bubble--ai'">
              <span class="bubble__text">{{ msg.text }}</span>
              <span class="bubble__time">{{ fmtTime(msg.ts) }}</span>
            </div>
          </div>

          <!-- Typing -->
          <div v-if="current.isTyping" class="msg-row">
            <div class="bubble bubble--ai typing">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
          </div>
        </div>

        <!-- Banner de lead capturado -->
        <div v-if="current.lead" class="lead-banner">
          <span class="lead-banner__icon">✅</span>
          <div>
            <strong>{{ current.lead.name }}</strong> qualificado pela IA
            <span class="lead-banner__tags">
              {{ current.lead.course }} · {{ current.lead.unit }} · {{ current.lead.shift }}
            </span>
          </div>
          <span
            class="lead-banner__status"
            :style="{ background: STATUS_COLOR[current.lead.status] }"
          >{{ STATUS_LABEL[current.lead.status] }}</span>
        </div>

        <!-- Input -->
        <div class="wa-input">
          <input
            v-model="inputText"
            class="wa-input__field"
            placeholder="Mensagem…"
            :disabled="current.isSending"
            @keydown="handleKey"
          />
          <button
            class="wa-input__send"
            :disabled="current.isSending || !inputText.trim()"
            @click="send"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </section>

      <!-- ── Painel de detalhe do lead ── -->
      <aside v-if="current.lead" class="lead-panel">
        <div class="lead-panel__title">Perfil do Lead</div>

        <div class="lead-panel__avatar"
          :style="{ background: STATUS_COLOR[current.lead.status] + '22', color: STATUS_COLOR[current.lead.status] }">
          {{ current.lead.name.charAt(0) }}
        </div>
        <div class="lead-panel__name">{{ current.lead.name }}</div>
        <div class="lead-panel__phone">{{ contact.phone }}</div>

        <div class="lead-panel__divider"></div>

        <div class="lead-panel__row">
          <span class="lead-panel__key">Curso</span>
          <span class="lead-panel__val">{{ current.lead.course }}</span>
        </div>
        <div class="lead-panel__row">
          <span class="lead-panel__key">Unidade</span>
          <span class="lead-panel__val">{{ current.lead.unit }}</span>
        </div>
        <div class="lead-panel__row">
          <span class="lead-panel__key">Turno</span>
          <span class="lead-panel__val">{{ current.lead.shift }}</span>
        </div>
        <div class="lead-panel__row">
          <span class="lead-panel__key">Status</span>
          <span
            class="lead-panel__badge"
            :style="{ background: STATUS_COLOR[current.lead.status] }"
          >{{ STATUS_LABEL[current.lead.status] }}</span>
        </div>

        <div class="lead-panel__divider"></div>
        <p class="lead-panel__hint">Abra o Pipeline para avançar este lead no funil.</p>
      </aside>

      <aside v-else class="lead-panel lead-panel--empty">
        <div class="lead-panel__empty-icon">🤖</div>
        <p class="lead-panel__empty-text">A IA está qualificando este contato. Quando coletar todos os dados, o perfil aparecerá aqui.</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

.wa-layout { flex: 1; display: flex; overflow: hidden; }

/* ── Sidebar ── */
.wa-sidebar {
  width: 300px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e9edef;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.wa-sidebar__header {
  background: #075e54;
  padding: 13px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.wa-sidebar__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.wa-icon {
  width: 26px;
  height: 26px;
  background: #25d366;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.wa-sim-pill {
  font-size: 10px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  padding: 2px 7px;
  border-radius: 10px;
}

.wa-item {
  display: flex;
  gap: 11px;
  padding: 11px 14px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.1s;
}

.wa-item:hover { background: #f9f9f9; }
.wa-item--active { background: #e8f5e9; }

.wa-item__avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #128c7e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
  position: relative;
}

.wa-item__check {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background: #18a058;
  border-radius: 50%;
  font-size: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}

.wa-item__body { flex: 1; min-width: 0; }

.wa-item__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}

.wa-item__name {
  font-size: 13px;
  font-weight: 600;
  color: #111b21;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wa-item__time { font-size: 11px; color: #aaa; flex-shrink: 0; }

.wa-item__sub {
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.wa-item__pill {
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  padding: 2px 7px;
  border-radius: 10px;
}

.wa-item__preview {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Chat ── */
.wa-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ece5dd;
}

.wa-chat__head {
  background: #075e54;
  padding: 10px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.wa-chat__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wa-chat__info { flex: 1; min-width: 0; }

.wa-chat__name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wa-chat__meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
}

.wa-chat__course { font-size: 11px; color: rgba(255,255,255,0.7); }

.wa-chat__status {
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  padding: 1px 7px;
  border-radius: 10px;
}

.wa-chat__city { font-size: 12px; color: rgba(255,255,255,0.65); }

.wa-badge-pill {
  font-size: 10px;
  color: rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.12);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Messages ── */
.wa-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wa-date-sep {
  text-align: center;
  font-size: 11px;
  color: #666;
  background: rgba(255,255,255,0.6);
  border-radius: 8px;
  padding: 3px 10px;
  align-self: center;
  margin-bottom: 4px;
}

.msg-row { display: flex; justify-content: flex-start; padding: 1px 0; }
.msg-row--user { justify-content: flex-end; }

.bubble {
  max-width: 68%;
  padding: 7px 11px 4px;
  border-radius: 16px;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.bubble--ai  { background: #fff; color: #111b21; border-radius: 16px 16px 16px 4px; }
.bubble--user{ background: #dcf8c6; color: #111b21; border-radius: 16px 16px 4px 16px; }

.bubble__text { display: block; font-size: 13.5px; line-height: 1.5; }
.bubble__time { display: block; font-size: 10px; margin-top: 2px; text-align: right; opacity: 0.5; }

.typing { padding: 10px 14px; display: flex; gap: 4px; align-items: center; }

.dot {
  width: 7px; height: 7px; background: #aaa; border-radius: 50%;
  animation: bounce 1.2s infinite ease-in-out;
}
.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes bounce {
  0%,60%,100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* ── Lead banner ── */
.lead-banner {
  background: #e8f8f0;
  border-top: 1px solid #b2dfdb;
  padding: 9px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  font-size: 13px;
  color: #1e8449;
}

.lead-banner__icon { font-size: 16px; flex-shrink: 0; }

.lead-banner__tags {
  display: block;
  font-size: 11px;
  color: #555;
  font-weight: normal;
}

.lead-banner__status {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  padding: 2px 9px;
  border-radius: 10px;
  flex-shrink: 0;
}

/* ── Input ── */
.wa-input {
  background: #f0f2f5;
  border-top: 1px solid #e9edef;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.wa-input__field {
  flex: 1;
  border: none;
  background: #fff;
  border-radius: 24px;
  padding: 9px 16px;
  font-size: 14px;
  outline: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}

.wa-input__field::placeholder { color: #bbb; }

.wa-input__send {
  width: 42px; height: 42px; border-radius: 50%;
  background: #075e54; border: none; color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background 0.15s;
}

.wa-input__send:hover:not(:disabled) { background: #128c7e; }
.wa-input__send:disabled { background: #ccc; cursor: not-allowed; }

/* ── Lead panel ── */
.lead-panel {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #e9edef;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  overflow-y: auto;
}

.lead-panel--empty {
  justify-content: center;
  text-align: center;
}

.lead-panel__title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #aaa;
  align-self: flex-start;
  margin-bottom: 8px;
}

.lead-panel__avatar {
  width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 800;
}

.lead-panel__name {
  font-size: 15px;
  font-weight: 700;
  color: #111b21;
  text-align: center;
}

.lead-panel__phone { font-size: 12px; color: #aaa; }

.lead-panel__divider {
  width: 100%; height: 1px; background: #f0f0f0; margin: 4px 0;
}

.lead-panel__row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.lead-panel__key { font-size: 12px; color: #888; }
.lead-panel__val { font-size: 12px; font-weight: 600; color: #333; }

.lead-panel__badge {
  font-size: 11px; font-weight: 700; color: #fff;
  padding: 2px 9px; border-radius: 10px;
}

.lead-panel__hint {
  font-size: 11px; color: #aaa; text-align: center; margin: 4px 0 0; line-height: 1.5;
}

.lead-panel__empty-icon { font-size: 40px; opacity: 0.3; }

.lead-panel__empty-text {
  font-size: 12px; color: #aaa; text-align: center; line-height: 1.6;
  margin: 0;
}
</style>
