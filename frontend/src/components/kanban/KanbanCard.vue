<template>
  <div class="kanban-card" :class="{ 'kanban-card--stale': isStale, 'kanban-card--lost': isLost }"
    :style="{ '--stage-color': stageColor }">
    <div class="kanban-card__bar"></div>
    <div class="kanban-card__body">
      <div class="kanban-card__header">
        <span class="kanban-card__name">{{ lead.name }}</span>
        <span v-if="isStale" class="kanban-card__stale">⚠</span>
      </div>

      <div class="kanban-card__tags">
        <span v-for="[, val] in dataEntries" :key="val" class="tag">{{ val }}</span>
      </div>

      <div class="kanban-card__date-row">
        <span class="kanban-card__date">{{ formatDate(lead.createdAt) }}</span>
        <button class="btn-detail" title="Ver detalhes" @click.stop="emit('open', lead)">👁</button>
      </div>

      <div v-if="!isLost" class="kanban-card__actions">
        <button v-if="nextStage" class="btn-advance" :disabled="loading" @click="advance">
          {{ nextStage.label }} →
        </button>
        <button v-if="!isLastActive" class="btn-lost" :disabled="loading" @click="markLost">
          Perdido
        </button>
      </div>
      <div v-else class="kanban-card__lost-label">Lead perdido</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Lead } from '../../types'
import { useSimulatorStore } from '../../stores/simulator'
import { useWorkspaceStore } from '../../stores/workspace'

const props   = defineProps<{ lead: Lead }>()
const emit    = defineEmits<{ open: [lead: Lead] }>()
const store   = useSimulatorStore()
const ws      = useWorkspaceStore()
const loading = ref(false)

const dataEntries = computed(() => Object.entries(props.lead.data ?? {}))

// Usar stages do vertical ou fallback
const stages = computed(() => ws.stages)
const lostKey = computed(() => ws.lostStage)

const currentIdx = computed(() => stages.value.findIndex(s => s.key === props.lead.status))
const stageColor = computed(() => stages.value[currentIdx.value]?.color ?? '#aaa')

const isLost      = computed(() => props.lead.status === lostKey.value)
const isLastActive = computed(() => {
  const activeStages = stages.value.filter(s => s.key !== lostKey.value)
  return activeStages[activeStages.length - 1]?.key === props.lead.status
})

const nextStage = computed(() => {
  const idx = currentIdx.value
  if (idx < 0 || isLost.value) return null
  const next = stages.value[idx + 1]
  return next?.key === lostKey.value ? null : next
})

const isStale = computed(() => {
  if (props.lead.status !== ws.firstStage) return false
  return (Date.now() - new Date(props.lead.createdAt).getTime()) / 3_600_000 > 24
})

async function advance() {
  if (!nextStage.value) return
  loading.value = true
  try { await store.updateLeadStatus(props.lead.id, nextStage.value.key) }
  finally { loading.value = false }
}

async function markLost() {
  loading.value = true
  try { await store.updateLeadStatus(props.lead.id, lostKey.value) }
  finally { loading.value = false }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
</script>

<style scoped>
.kanban-card {
  background: #fff;
  border-radius: 10px;
  display: flex;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.kanban-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.12); }

.kanban-card--stale .kanban-card__bar { background: #d03050 !important; }
.kanban-card--lost { opacity: 0.55; }

.kanban-card__bar {
  width: 4px;
  flex-shrink: 0;
  background: var(--stage-color, #aaa);
}

.kanban-card__body {
  flex: 1;
  padding: 10px 11px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.kanban-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}

.kanban-card__name {
  font-weight: 600;
  font-size: 13px;
  color: #111b21;
  line-height: 1.3;
}

.kanban-card__stale {
  font-size: 13px;
  flex-shrink: 0;
}

.kanban-card__tags { display: flex; flex-wrap: wrap; gap: 4px; }

.tag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  background: #f0f2f5;
  color: #555;
}

.kanban-card__date-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kanban-card__date { font-size: 11px; color: #bbb; }

.btn-detail {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  opacity: 0.4;
  padding: 0;
  line-height: 1;
  transition: opacity 0.15s;
}

.btn-detail:hover { opacity: 1; }

.kanban-card__actions { display: flex; gap: 5px; flex-wrap: wrap; }

.btn-advance {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--stage-color, #2080f0);
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.15s;
}

.btn-advance:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-lost {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 6px;
  background: transparent;
  color: #d03050;
  border: 1px solid #d0305033;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-lost:hover:not(:disabled) { background: #fff0f3; }
.btn-lost:disabled { opacity: 0.4; cursor: not-allowed; }

.kanban-card__lost-label { font-size: 11px; color: #bbb; font-style: italic; }
</style>
