<script setup lang="ts">
import { ref, computed, reactive, nextTick } from 'vue'
import { NSpin } from 'naive-ui'
import AppNav from '@/components/layout/AppNav.vue'
import { simulatorApi } from '@/api/simulator'
import { useSimulatorStore } from '@/stores/simulator'
import type { ChatMessage } from '@/types'

const store = useSimulatorStore()

// ── Contatos hardcoded (simulam números do WhatsApp) ──────────────────────────
interface Contact {
  id: string
  phone: string
  city: string
}

const CONTACTS: Contact[] = [
  { id: 'c1', phone: '+55 (11) 99234-5678', city: 'São Paulo' },
  { id: 'c2', phone: '+55 (21) 97654-3210', city: 'Rio de Janeiro' },
  { id: 'c3', phone: '+55 (31) 98123-4567', city: 'Belo Horizonte' },
  { id: 'c4', phone: '+55 (41) 99876-5432', city: 'Curitiba' },
  { id: 'c5', phone: '+55 (85) 98421-1234', city: 'Fortaleza' },
]

const WELCOME: ChatMessage = {
  id: 'welcome',
  from: 'ai',
  text: 'Olá! 👋 Seja bem-vindo. Como posso te ajudar hoje?',
  timestamp: new Date(),
}

interface ConvState {
  messages: ChatMessage[]
  isTyping: boolean
  isSending: boolean
  leadName: string | null
  leadStatus: string | null
}

const conversations = reactive<Record<string, ConvState>>({})

CONTACTS.forEach((c) => {
  conversations[c.id] = {
    messages: [{ ...WELCOME, id: `welcome-${c.id}`, timestamp: new Date() }],
    isTyping: false,
    isSending: false,
    leadName: null,
    leadStatus: null,
  }
})

// ── Selecção ──────────────────────────────────────────────────────────────────
const selectedId = ref(CONTACTS[0].id)
const current = computed(() => conversations[selectedId.value])
const currentContact = computed(() => CONTACTS.find((c) => c.id === selectedId.value)!)

function select(id: string) {
  selectedId.value = id
  nextTick(() => scrollToBottom())
}

// ── Envio de mensagem ─────────────────────────────────────────────────────────
const inputText = ref('')
const messagesEl = ref<HTMLElement>()

function scrollToBottom() {
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

async function send() {
  const text = inputText.value.trim()
  const conv = current.value
  if (!text || conv.isSending) return

  inputText.value = ''
  conv.isSending = true

  const history = conv.messages
    .filter((m) => m.id !== `welcome-${selectedId.value}`)
    .map((m) => ({
      role: m.from === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }))

  conv.messages.push({
    id: crypto.randomUUID(),
    from: 'user',
    text,
    timestamp: new Date(),
  })
  await nextTick(); scrollToBottom()

  await new Promise((r) => setTimeout(r, 400))
  conv.isTyping = true
  await nextTick(); scrollToBottom()

  try {
    const res = await simulatorApi.sendMessage(text, history)
    conv.isTyping = false
    conv.messages.push({
      id: crypto.randomUUID(),
      from: 'ai',
      text: res.reply,
      timestamp: new Date(),
    })

    if (res.lead) {
      conv.leadName = res.lead.name
      conv.leadStatus = res.lead.status
      if (!store.leads.find((l) => l.id === res.lead!.id)) {
        store.leads.unshift(res.lead)
      }
    }
  } catch {
    conv.isTyping = false
    conv.messages.push({
      id: crypto.randomUUID(),
      from: 'ai',
      text: '⚠ Erro ao conectar com a IA. Tente novamente.',
      timestamp: new Date(),
    })
  } finally {
    conv.isSending = false
    await nextTick(); scrollToBottom()
  }
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function lastMsg(id: string) {
  const msgs = conversations[id].messages
  return msgs[msgs.length - 1]
}

const STATUS_COLOR: Record<string, string> = {
  NOVO: '#2080f0', CONTATO: '#f0a020', INSCRITO: '#8a2be2',
  MATRICULADO: '#18a058', PERDIDO: '#999',
}
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="wa-layout">
      <!-- ── Sidebar: lista de conversas ── -->
      <aside class="wa-sidebar">
        <div class="wa-sidebar__header">
          <span class="wa-sidebar__title">WhatsApp</span>
          <span class="wa-sidebar__badge">simulado</span>
        </div>

        <div
          v-for="c in CONTACTS"
          :key="c.id"
          class="wa-contact"
          :class="{ 'wa-contact--active': selectedId === c.id }"
          @click="select(c.id)"
        >
          <div class="wa-contact__avatar">
            {{ c.phone.slice(-4, -2) }}
          </div>
          <div class="wa-contact__info">
            <div class="wa-contact__top">
              <span class="wa-contact__phone">
                {{ conversations[c.id].leadName ?? c.phone }}
              </span>
              <span class="wa-contact__time">
                {{ formatTime(lastMsg(c.id).timestamp) }}
              </span>
            </div>
            <div class="wa-contact__preview">
              <span
                v-if="conversations[c.id].leadStatus"
                class="wa-contact__status-dot"
                :style="{ background: STATUS_COLOR[conversations[c.id].leadStatus!] }"
              ></span>
              {{ lastMsg(c.id).text.slice(0, 42) }}{{ lastMsg(c.id).text.length > 42 ? '…' : '' }}
            </div>
          </div>
        </div>
      </aside>

      <!-- ── Conversa ── -->
      <section class="wa-chat">
        <!-- Header da conversa -->
        <div class="wa-chat__header">
          <div class="wa-chat__avatar">{{ currentContact.phone.slice(-4, -2) }}</div>
          <div class="wa-chat__info">
            <div class="wa-chat__name">
              {{ current.leadName ?? currentContact.phone }}
            </div>
            <div class="wa-chat__sub">
              <span v-if="current.leadStatus" class="wa-chat__lead-tag"
                :style="{ background: STATUS_COLOR[current.leadStatus] }">
                {{ current.leadStatus }}
              </span>
              <span v-else class="wa-chat__sub-text">{{ currentContact.city }} · aguardando atendimento</span>
            </div>
          </div>
          <div class="wa-chat__via">via WhatsApp <span class="wa-sim-badge">simulado</span></div>
        </div>

        <!-- Mensagens -->
        <div ref="messagesEl" class="wa-messages">
          <template v-for="msg in current.messages" :key="msg.id">
            <div class="msg-row" :class="{ 'msg-row--user': msg.from === 'user' }">
              <div class="bubble" :class="msg.from === 'user' ? 'bubble--user' : 'bubble--ai'">
                <span class="bubble__text">{{ msg.text }}</span>
                <span class="bubble__time">{{ formatTime(msg.timestamp) }}</span>
              </div>
            </div>
          </template>

          <!-- Typing indicator -->
          <div v-if="current.isTyping" class="msg-row">
            <div class="bubble bubble--ai typing">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
          </div>
        </div>

        <!-- Lead capturado banner -->
        <div v-if="current.leadName" class="wa-lead-banner">
          ✅ Lead <strong>{{ current.leadName }}</strong> capturado e adicionado ao Pipeline
        </div>

        <!-- Input -->
        <div class="wa-input">
          <input
            v-model="inputText"
            class="wa-input__field"
            placeholder="Digite uma mensagem..."
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
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wa-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── Sidebar ── */
.wa-sidebar {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid #e9edef;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow-y: auto;
}

.wa-sidebar__header {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #f0f0f0;
  background: #075e54;
}

.wa-sidebar__title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
}

.wa-sidebar__badge {
  font-size: 10px;
  font-weight: 600;
  background: rgba(255,255,255,0.2);
  color: #fff;
  padding: 2px 7px;
  border-radius: 10px;
  letter-spacing: 0.3px;
}

.wa-contact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.1s;
}

.wa-contact:hover { background: #f5f7fa; }
.wa-contact--active { background: #e8f5e9; }

.wa-contact__avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #128c7e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.wa-contact__info { flex: 1; min-width: 0; }

.wa-contact__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px;
}

.wa-contact__phone {
  font-size: 14px;
  font-weight: 600;
  color: #111b21;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wa-contact__time { font-size: 11px; color: #aaa; flex-shrink: 0; }

.wa-contact__preview {
  font-size: 12px;
  color: #667;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.wa-contact__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Chat ── */
.wa-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ece5dd;
}

.wa-chat__header {
  background: #075e54;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.wa-chat__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.wa-chat__info { flex: 1; }

.wa-chat__name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.wa-chat__sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.wa-chat__lead-tag {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  padding: 1px 8px;
  border-radius: 10px;
}

.wa-chat__sub-text {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
}

.wa-chat__via {
  font-size: 11px;
  color: rgba(255,255,255,0.6);
  display: flex;
  align-items: center;
  gap: 5px;
}

.wa-sim-badge {
  background: rgba(255,255,255,0.2);
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
}

/* ── Messages ── */
.wa-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.msg-row {
  display: flex;
  justify-content: flex-start;
  padding: 1px 4px;
}

.msg-row--user { justify-content: flex-end; }

.bubble {
  max-width: 65%;
  padding: 8px 12px 4px;
  border-radius: 18px;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.bubble--ai {
  background: #fff;
  color: #111b21;
  border-radius: 18px 18px 18px 4px;
}

.bubble--user {
  background: #dcf8c6;
  color: #111b21;
  border-radius: 18px 18px 4px 18px;
}

.bubble__text {
  display: block;
  font-size: 14px;
  line-height: 1.5;
}

.bubble__time {
  display: block;
  font-size: 11px;
  margin-top: 2px;
  text-align: right;
  opacity: 0.55;
}

/* Typing */
.typing {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 7px;
  height: 7px;
  background: #999;
  border-radius: 50%;
  animation: bounce 1.2s infinite ease-in-out;
}

.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* ── Lead banner ── */
.wa-lead-banner {
  background: #e8f8f0;
  border-top: 1px solid #b2dfdb;
  color: #1e8449;
  padding: 8px 20px;
  font-size: 13px;
  flex-shrink: 0;
}

/* ── Input ── */
.wa-input {
  background: #f0f2f5;
  border-top: 1px solid #e9edef;
  padding: 10px 16px;
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
  padding: 10px 18px;
  font-size: 14px;
  outline: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.wa-input__field::placeholder { color: #aaa; }

.wa-input__send {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #075e54;
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.wa-input__send:hover:not(:disabled) { background: #128c7e; }
.wa-input__send:disabled { background: #ccc; cursor: not-allowed; }
</style>
