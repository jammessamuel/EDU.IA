<template>
  <div class="kanban-card" :class="`kanban-card--${lead.status.toLowerCase()}`">
    <div class="kanban-card__name">{{ lead.name }}</div>

    <div class="kanban-card__tags">
      <NTag :type="courseTagType" size="small" round>{{ lead.course }}</NTag>
      <NTag type="default" size="small" round>{{ lead.unit }}</NTag>
      <NTag type="default" size="small" round>{{ lead.shift }}</NTag>
    </div>

    <div class="kanban-card__date">{{ formatDate(lead.createdAt) }}</div>

    <div v-if="lead.status !== 'PERDIDO'" class="kanban-card__actions">
      <NButton
        v-if="nextStatus"
        size="tiny"
        type="primary"
        :loading="loading"
        @click="advance"
      >
        {{ nextLabel }} →
      </NButton>
      <NButton
        v-if="lead.status !== 'MATRICULADO'"
        size="tiny"
        quaternary
        type="error"
        :disabled="loading"
        @click="markLost"
      >
        Perdido
      </NButton>
    </div>

    <div v-else class="kanban-card__lost-label">Lead perdido</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NTag, NButton } from 'naive-ui'
import type { Lead } from '../../types'
import { useSimulatorStore } from '../../stores/simulator'

const props = defineProps<{ lead: Lead }>()
const store = useSimulatorStore()
const loading = ref(false)

const FLOW = ['NOVO', 'CONTATO', 'INSCRITO', 'MATRICULADO']

const nextStatus = computed(() => {
  const idx = FLOW.indexOf(props.lead.status)
  return idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null
})

const LABELS: Record<string, string> = {
  CONTATO: 'Contato',
  INSCRITO: 'Inscrito',
  MATRICULADO: 'Matriculado',
}
const nextLabel = computed(() => (nextStatus.value ? LABELS[nextStatus.value] : ''))

const COURSE_TYPES: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  Enfermagem: 'error',
  Direito: 'warning',
  Administração: 'info',
  Pedagogia: 'success',
}
const courseTagType = computed(
  () => COURSE_TYPES[props.lead.course] ?? 'default',
)

async function advance() {
  if (!nextStatus.value) return
  loading.value = true
  try {
    await store.updateLeadStatus(props.lead.id, nextStatus.value)
  } finally {
    loading.value = false
  }
}

async function markLost() {
  loading.value = true
  try {
    await store.updateLeadStatus(props.lead.id, 'PERDIDO')
  } finally {
    loading.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
</script>

<style scoped>
.kanban-card {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  border-left: 4px solid #d0d0d0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow 0.15s;
}

.kanban-card:hover {
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
}

.kanban-card--novo       { border-left-color: #2080f0; }
.kanban-card--contato    { border-left-color: #f0a020; }
.kanban-card--inscrito   { border-left-color: #8a2be2; }
.kanban-card--matriculado{ border-left-color: #18a058; }
.kanban-card--perdido    { border-left-color: #999; opacity: 0.6; }

.kanban-card__name {
  font-weight: 600;
  font-size: 14px;
  color: #111b21;
  line-height: 1.3;
}

.kanban-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.kanban-card__date {
  font-size: 11px;
  color: #999;
}

.kanban-card__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.kanban-card__lost-label {
  font-size: 11px;
  color: #999;
  font-style: italic;
}
</style>
