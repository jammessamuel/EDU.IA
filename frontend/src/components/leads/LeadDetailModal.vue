<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Lead } from '@/types'

const props = defineProps<{ lead: Lead | null }>()
const emit  = defineEmits<{ close: [] }>()

const ws = useWorkspaceStore()

const dataEntries = computed(() =>
  Object.entries(props.lead?.data ?? {}).map(([key, val]) => ({
    label: ws.fieldLabel(key),
    value: val,
  })),
)

const formattedDate = computed(() =>
  props.lead
    ? new Date(props.lead.createdAt).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '',
)

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo Lead', CONTATO: 'Em Contato', ANALISE: 'Em Análise',
  INSCRITO: 'Inscrito', INTERESSE: 'Interesse', VISITA: 'Visita Agendada',
  PROPOSTA: 'Proposta Enviada', NEGOCIACAO: 'Negociação',
  AGENDADO: 'Agendado', CONFIRMADO: 'Confirmado', ATENDIDO: 'Atendido',
  MATRICULADO: 'Matriculado', CONTRATADO: 'Contratado',
  FECHADO: 'Fechado', PERDIDO: 'Perdido',
}

const stageColor = computed(() =>
  ws.stages.find(s => s.key === props.lead?.status)?.color ?? '#aaa'
)

const hasConversation = computed(() =>
  (props.lead?.conversation?.length ?? 0) > 0
)
</script>

<template>
  <Teleport to="body">
    <div v-if="lead" class="modal-overlay" @click.self="emit('close')">
      <div class="modal">

        <!-- Header -->
        <div class="modal-header" :style="{ '--brand': ws.brandColor }">
          <div class="modal-header__avatar">{{ lead.name.charAt(0).toUpperCase() }}</div>
          <div class="modal-header__info">
            <h2 class="modal-header__name">{{ lead.name }}</h2>
            <span class="modal-header__date">Capturado em {{ formattedDate }}</span>
          </div>
          <span class="modal-header__status" :style="{ background: stageColor }">
            {{ STATUS_LABEL[lead.status] ?? lead.status }}
          </span>
          <button class="modal-close" @click="emit('close')">✕</button>
        </div>

        <div class="modal-body">

          <!-- Dados coletados -->
          <section class="modal-section">
            <h3 class="modal-section__title">📋 Dados qualificados</h3>
            <div class="data-grid">
              <div v-for="entry in dataEntries" :key="entry.label" class="data-item">
                <span class="data-item__label">{{ entry.label }}</span>
                <span class="data-item__value">{{ entry.value }}</span>
              </div>
              <div v-if="lead.phone" class="data-item">
                <span class="data-item__label">Telefone</span>
                <span class="data-item__value">{{ lead.phone }}</span>
              </div>
            </div>
          </section>

          <!-- Conversa qualificadora -->
          <section v-if="hasConversation" class="modal-section">
            <h3 class="modal-section__title">💬 Por que foi qualificado</h3>
            <p class="modal-section__sub">Conversa que levou à qualificação deste lead</p>
            <div class="conv-thread">
              <div
                v-for="(msg, i) in lead.conversation"
                :key="i"
                class="conv-msg"
                :class="msg.role === 'user' ? 'conv-msg--user' : 'conv-msg--ai'"
              >
                <span class="conv-msg__who">{{ msg.role === 'user' ? '👤 Cliente' : '🤖 IA' }}</span>
                <p class="conv-msg__text">{{ msg.content }}</p>
              </div>
            </div>
          </section>

          <section v-else class="modal-section">
            <h3 class="modal-section__title">💬 Conversa</h3>
            <p class="modal-empty">Leads criados antes desta atualização não têm histórico salvo.</p>
          </section>

        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 580px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.2);
  overflow: hidden;
}

/* Header */
.modal-header {
  background: var(--brand, #075e54);
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.modal-header__avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-header__info {
  flex: 1;
  min-width: 0;
}

.modal-header__name {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-header__date {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  display: block;
  margin-top: 2px;
}

.modal-header__status {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  padding: 3px 11px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.modal-close:hover { background: rgba(255,255,255,0.25); }

/* Body */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modal-section__title {
  font-size: 14px;
  font-weight: 700;
  color: #111b21;
  margin: 0 0 12px;
}

.modal-section__sub {
  font-size: 12px;
  color: #888;
  margin: -8px 0 12px;
}

/* Dados */
.data-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.data-item {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 10px 13px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.data-item__label {
  font-size: 11px;
  color: #888;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.data-item__value {
  font-size: 14px;
  font-weight: 600;
  color: #111b21;
}

/* Conversa */
.conv-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #f5f7fa;
  border-radius: 12px;
  padding: 14px;
}

.conv-msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conv-msg--user { align-items: flex-end; }
.conv-msg--ai   { align-items: flex-start; }

.conv-msg__who {
  font-size: 11px;
  font-weight: 600;
  color: #888;
}

.conv-msg__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  padding: 8px 12px;
  border-radius: 12px;
  max-width: 85%;
}

.conv-msg--ai   .conv-msg__text { background: #fff; color: #111b21; border-radius: 4px 12px 12px 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.conv-msg--user .conv-msg__text { background: #dcf8c6; color: #111b21; border-radius: 12px 12px 4px 12px; }

.modal-empty {
  font-size: 13px;
  color: #aaa;
  font-style: italic;
  margin: 0;
}
</style>
