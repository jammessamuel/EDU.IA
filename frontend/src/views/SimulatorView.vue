<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NScrollbar, NAlert } from 'naive-ui'
import { useSimulatorStore } from '@/stores/simulator'
import AppNav from '@/components/layout/AppNav.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import QuickReplies from '@/components/chat/QuickReplies.vue'
import { useQuickReplies } from '@/composables/useQuickReplies'
import type { Lead } from '@/types'

const store  = useSimulatorStore()
const router = useRouter()

const quickReplies = useQuickReplies(
  computed(() => store.messages),
  computed(() => store.isTyping),
)

function sendQuickReply(opt: string) {
  store.sendMessage(opt)
}

const selectedLead = ref<Lead | null>(null)

onMounted(() => store.fetchLeads())

function openLead(lead: Lead) {
  selectedLead.value = selectedLead.value?.id === lead.id ? null : lead
}

function goToPipeline() {
  router.push('/kanban')
}

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo Lead', CONTATO: 'Em Contato', INSCRITO: 'Inscrito',
  MATRICULADO: 'Matriculado', PERDIDO: 'Perdido',
}

const STATUS_COLOR: Record<string, string> = {
  NOVO: '#2080f0', CONTATO: '#f0a020', INSCRITO: '#8a2be2',
  MATRICULADO: '#18a058', PERDIDO: '#aaa',
}

const COURSE_COLORS: Record<string, { bg: string; text: string }> = {
  Enfermagem:    { bg: '#ffeaea', text: '#c0392b' },
  Direito:       { bg: '#fff7e6', text: '#d97706' },
  Administração: { bg: '#e8f4fd', text: '#1d6fa4' },
  Pedagogia:     { bg: '#e8f8f0', text: '#1e8449' },
}

function courseStyle(course: string) {
  return COURSE_COLORS[course] ?? { bg: '#f5f5f5', text: '#555' }
}

function formattedDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="workspace">
      <!-- ── Coluna esquerda: chat ── -->
      <section class="chat-col">
        <!-- Banner de contexto -->
        <div class="chat-purpose">
          🧪 <strong>Modo Teste</strong> — simule a conversa do aluno para testar a IA antes de conectar ao WhatsApp real.
        </div>
        <ChatHeader @reset="store.resetSession()" />
        <ChatMessages :messages="store.messages" :is-typing="store.isTyping" />
        <QuickReplies
          v-if="quickReplies && !store.isSending"
          :options="quickReplies"
          @select="sendQuickReply"
        />
        <ChatInput :disabled="store.isSending" @send="store.sendMessage($event)" />
      </section>

      <!-- ── Coluna direita: leads capturados ── -->
      <section class="leads-col">
        <div class="leads-header">
          <div class="leads-header__left">
            <h2 class="leads-header__title">Leads Capturados</h2>
            <span v-if="store.hasLeads" class="leads-header__badge">{{ store.leadCount }}</span>
          </div>
          <button v-if="store.hasLeads" class="btn-pipeline" @click="goToPipeline">
            Ver no Pipeline →
          </button>
        </div>

        <NAlert v-if="store.error" type="error" closable style="margin: 0 16px 8px" @close="store.error = null">
          {{ store.error }}
        </NAlert>

        <NScrollbar class="leads-scroll">
          <div class="leads-list">
            <!-- Empty state -->
            <div v-if="!store.hasLeads" class="empty-state">
              <div class="empty-state__steps">
                <div class="step">
                  <span class="step__num">1</span>
                  <span class="step__text">Digite uma mensagem no chat ao lado como se fosse um aluno</span>
                </div>
                <div class="step">
                  <span class="step__num">2</span>
                  <span class="step__text">A IA vai coletar: curso, unidade, turno e nome</span>
                </div>
                <div class="step">
                  <span class="step__num">3</span>
                  <span class="step__text">O lead aparece aqui e vai automaticamente para o Pipeline</span>
                </div>
              </div>
            </div>

            <!-- Lead cards clicáveis -->
            <div
              v-for="lead in store.leads"
              :key="lead.id"
              class="lead-card"
              :class="{ 'lead-card--selected': selectedLead?.id === lead.id }"
              @click="openLead(lead)"
            >
              <div class="lead-card__bar" :style="{ background: courseStyle(lead.course).text }"></div>
              <div class="lead-card__body">
                <div class="lead-card__top">
                  <div class="lead-card__avatar"
                    :style="{ background: courseStyle(lead.course).bg, color: courseStyle(lead.course).text }">
                    {{ lead.name.charAt(0) }}
                  </div>
                  <div class="lead-card__info">
                    <span class="lead-card__name">{{ lead.name }}</span>
                    <span class="lead-card__time">{{ formattedDate(lead.createdAt) }}</span>
                  </div>
                  <span
                    class="lead-card__status"
                    :style="{ background: STATUS_COLOR[lead.status] }"
                  >{{ STATUS_LABEL[lead.status] }}</span>
                </div>

                <div class="lead-card__tags">
                  <span class="tag" :style="{ background: courseStyle(lead.course).bg, color: courseStyle(lead.course).text }">
                    {{ lead.course }}
                  </span>
                  <span class="tag">🏫 {{ lead.unit }}</span>
                  <span class="tag">{{ lead.shift }}</span>
                </div>

                <!-- Detalhe expandido ao clicar -->
                <div v-if="selectedLead?.id === lead.id" class="lead-detail">
                  <div class="lead-detail__actions">
                    <button class="btn-action btn-action--primary" @click.stop="goToPipeline">
                      Abrir no Pipeline →
                    </button>
                  </div>
                  <p class="lead-detail__hint">
                    No Pipeline você pode avançar este lead de Novo Lead → Em Contato → Inscrito → Matriculado.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </NScrollbar>
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
  background: #f5f7fa;
}

.workspace { flex: 1; display: flex; overflow: hidden; }

/* ── Chat col ── */
.chat-col {
  width: 460px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e9edef;
  background: #fff;
  overflow: hidden;
}

.chat-purpose {
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  padding: 8px 16px;
  font-size: 12px;
  color: #92400e;
  flex-shrink: 0;
}

/* ── Leads col ── */
.leads-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.leads-header {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e9edef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.leads-header__left { display: flex; align-items: center; gap: 10px; }

.leads-header__title {
  font-size: 16px;
  font-weight: 700;
  color: #111b21;
  margin: 0;
}

.leads-header__badge {
  background: #075e54;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
}

.btn-pipeline {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #075e54;
  background: #e8f5e9;
  border: 1px solid #b2dfdb;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-pipeline:hover { background: #c8e6c9; }

.leads-scroll { flex: 1; }

.leads-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Empty state ── */
.empty-state { padding: 24px 8px; }

.empty-state__steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.step__num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #075e54;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step__text {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  padding-top: 4px;
}

/* ── Lead cards ── */
.lead-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  display: flex;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.lead-card:hover {
  box-shadow: 0 4px 14px rgba(0,0,0,0.11);
  transform: translateY(-1px);
}

.lead-card--selected {
  box-shadow: 0 0 0 2px #075e54, 0 4px 14px rgba(0,0,0,0.1);
  transform: translateY(-1px);
}

.lead-card__bar { width: 4px; flex-shrink: 0; }

.lead-card__body {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lead-card__top { display: flex; align-items: center; gap: 10px; }

.lead-card__avatar {
  width: 36px; height: 36px; border-radius: 50%;
  font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.lead-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.lead-card__name {
  font-size: 14px;
  font-weight: 600;
  color: #111b21;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-card__time { font-size: 11px; color: #aaa; }

.lead-card__status {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

.lead-card__tags { display: flex; flex-wrap: wrap; gap: 5px; }

.tag {
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 20px;
  background: #f5f7fa;
  color: #555;
  font-weight: 500;
}

/* ── Lead detail (expandido) ── */
.lead-detail {
  border-top: 1px solid #f0f0f0;
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lead-detail__actions { display: flex; gap: 8px; }

.btn-action {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn-action--primary {
  background: #075e54;
  color: #fff;
}

.btn-action--primary:hover { background: #128c7e; }

.lead-detail__hint {
  font-size: 12px;
  color: #888;
  margin: 0;
  line-height: 1.5;
}
</style>
