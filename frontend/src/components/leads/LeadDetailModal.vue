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
            <h3 class="modal-section__title">Dados qualificados</h3>
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
            <h3 class="modal-section__title">Conversa de qualificação</h3>
            <p class="modal-section__sub">Conversa que levou à qualificação deste lead</p>
            <div class="conv-thread">
              <div
                v-for="(msg, i) in lead.conversation"
                :key="i"
                class="conv-msg"
                :class="msg.role === 'user' ? 'conv-msg--user' : 'conv-msg--ai'"
              >
                <span class="conv-msg__who">{{ msg.role === 'user' ? 'Cliente' : 'Atendimento' }}</span>
                <p class="conv-msg__text">{{ msg.content }}</p>
              </div>
            </div>
          </section>

          <section v-else class="modal-section">
            <h3 class="modal-section__title">Conversa</h3>
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
  background: rgba(16, 32, 28, 0.48);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 100%;
  max-width: 580px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

/* Header */
.modal-header {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--brand, #075e54) 90%, #0f766e), var(--brand, #075e54));
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.modal-header__avatar {
  width: 46px;
  height: 46px;
  border-radius: 8px;
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
  font-weight: 900;
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
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
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
  font-weight: 900;
  color: var(--text);
  margin: 0 0 12px;
}

.modal-section__sub {
  font-size: 12px;
  color: var(--muted);
  margin: -8px 0 12px;
}

/* Dados */
.data-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.data-item {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 13px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.data-item__label {
  font-size: 11px;
  color: var(--muted);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0;
}

.data-item__value {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}

/* Conversa */
.conv-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
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
  font-weight: 800;
  color: var(--muted);
}

.conv-msg__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 85%;
}

.conv-msg--ai   .conv-msg__text { background: var(--surface); color: var(--text); border-radius: 5px 8px 8px 8px; box-shadow: var(--shadow-xs); }
.conv-msg--user .conv-msg__text { background: #dff9cf; color: var(--text); border-radius: 8px 8px 5px 8px; }

.modal-empty {
  font-size: 13px;
  color: var(--muted);
  font-style: italic;
  margin: 0;
}
</style>
