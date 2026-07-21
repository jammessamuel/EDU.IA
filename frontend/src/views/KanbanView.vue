<template>
  <div class="kanban-page">
    <AppNav />

    <!-- Sub-header do pipeline -->
    <div class="kanban-subheader">
      <div class="kanban-subheader__left">
        <h1 class="kanban-subheader__title">{{ ws.vertical ? `Pipeline — ${ws.vertical.name}` : 'Pipeline' }}</h1>
        <span class="kanban-subheader__badge">{{ totalLeads }} leads ativos</span>
      </div>
      <button class="btn-csv" @click="exportCsv">
        <NIcon :component="DownloadOutline" size="15" />
        Exportar CSV
      </button>
      <button class="btn-csv" @click="createOpen = true">+ Novo lead manual</button>
    </div>

    <!-- Banner de follow-up -->
    <div v-if="staleCount > 0" class="kanban-alert">
      ⚠ {{ staleCount }} lead{{ staleCount > 1 ? 's' : '' }} em "Novo Lead" sem contato há mais de 24h —
      avance-{{ staleCount > 1 ? 'os' : 'o' }} para <strong>Em Contato</strong>.
    </div>

    <!-- Modal de detalhe -->
    <LeadDetailModal
      :lead="detailLead"
      @close="detailLead = null"
      @updated="detailLead = $event"
    />

    <div v-if="createOpen" class="lead-create-backdrop" @click.self="createOpen = false">
      <form class="lead-create-modal" @submit.prevent="createManualLead">
        <header>
          <div>
            <strong>Novo lead manual</strong>
            <span>Cadastre sem depender da conversa com IA.</span>
          </div>
          <button type="button" @click="createOpen = false">✕</button>
        </header>
        <label>
          <span>Nome</span>
          <input v-model="createName" required />
        </label>
        <label>
          <span>Telefone</span>
          <input v-model="createPhone" type="tel" />
        </label>
        <label v-for="field in ws.fields" :key="field.name">
          <span>{{ field.label }}</span>
          <select v-if="field.type === 'select'" v-model="createData[field.name]">
            <option value="">Selecione</option>
            <option v-for="option in field.options || []" :key="option" :value="option">{{ option }}</option>
          </select>
          <input v-else v-model="createData[field.name]" />
        </label>
        <p v-if="createError">{{ createError }}</p>
        <button type="submit" :disabled="createBusy">{{ createBusy ? 'Salvando...' : 'Criar lead' }}</button>
      </form>
    </div>

    <!-- Board -->
    <div class="kanban-board">
      <div v-for="col in columns" :key="col.status" class="kanban-column" :style="{ '--stage': col.color }">
        <div class="kanban-column__header" :style="{ background: col.color }">
          <span class="kanban-column__title">{{ col.label }}</span>
          <span class="kanban-column__count">{{ leadsForStatus(col.status).length }}</span>
        </div>

        <NScrollbar class="kanban-column__body">
          <div class="kanban-column__cards">
            <TransitionGroup name="card">
              <KanbanCard
                v-for="lead in leadsForStatus(col.status)"
                :key="lead.id"
                :lead="lead"
                @open="detailLead = $event"
              />
            </TransitionGroup>
            <div v-if="leadsForStatus(col.status).length === 0" class="kanban-column__empty">
              <NEmpty description="Vazio" size="small" />
            </div>
          </div>
        </NScrollbar>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NIcon, NScrollbar, NEmpty } from 'naive-ui'
import { DownloadOutline } from '@vicons/ionicons5'
import KanbanCard from '../components/kanban/KanbanCard.vue'
import LeadDetailModal from '../components/leads/LeadDetailModal.vue'
import AppNav from '../components/layout/AppNav.vue'
import { useSimulatorStore } from '../stores/simulator'
import { useWorkspaceStore } from '../stores/workspace'
import type { Lead } from '../types'

const store      = useSimulatorStore()
const ws         = useWorkspaceStore()
const detailLead = ref<Lead | null>(null)
const createOpen = ref(false)
const createBusy = ref(false)
const createName = ref('')
const createPhone = ref('')
const createData = ref<Record<string, string>>({})
const createError = ref('')

// Colunas dinâmicas vindas do vertical
const columns = computed(() => ws.stages.map(s => ({ status: s.key, label: s.label, color: s.color })))

const totalLeads = computed(() =>
  store.leads.filter((l) => l.status !== ws.lostStage).length,
)

const staleCount = computed(() => {
  const cutoff = Date.now() - 24 * 3_600_000
  return store.leads.filter(
    (l) => l.status === ws.firstStage && new Date(l.createdAt).getTime() < cutoff,
  ).length
})

function leadsForStatus(status: string) {
  return store.leads.filter((l) => l.status === status)
}

function exportCsv() {
  const header = ['Nome', 'Curso', 'Unidade', 'Turno', 'Status', 'Data']
  const STATUS_LABEL: Record<string, string> = {
    NOVO: 'Novo Lead', CONTATO: 'Em Contato', INSCRITO: 'Inscrito',
    MATRICULADO: 'Matriculado', PERDIDO: 'Perdido',
  }
  const rows = store.leads.map((l) => [
    `"${l.name}"`, `"${l.data.course ?? ''}"`, `"${l.data.unit ?? ''}"`, `"${l.data.shift ?? ''}"`,
    `"${STATUS_LABEL[l.status] ?? l.status}"`,
    `"${new Date(l.createdAt).toLocaleDateString('pt-BR')}"`,
  ])
  const csv = [header, ...rows].map((r) => r.join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function createManualLead() {
  if (createBusy.value) return
  createBusy.value = true
  createError.value = ''
  try {
    const lead = await store.createLead({
      name: createName.value,
      phone: createPhone.value || null,
      data: createData.value,
      status: ws.firstStage,
    })
    createOpen.value = false
    createName.value = ''
    createPhone.value = ''
    createData.value = {}
    detailLead.value = lead
  } catch {
    createError.value = 'Não foi possível criar o lead.'
  } finally {
    createBusy.value = false
  }
}

onMounted(() => Promise.all([store.fetchLeads(), ws.load()]))
</script>

<style scoped>
.kanban-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  overflow: hidden;
}

.lead-create-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.55);
  padding: 20px;
}

.lead-create-modal {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: min(680px, 100%);
  max-height: 85vh;
  overflow-y: auto;
  border-radius: 12px;
  background: var(--surface);
  padding: 20px;
}

.lead-create-modal header,
.lead-create-modal > button,
.lead-create-modal > p {
  grid-column: 1 / -1;
}

.lead-create-modal header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.lead-create-modal header div,
.lead-create-modal label {
  display: grid;
  gap: 5px;
}

.lead-create-modal header span,
.lead-create-modal label span {
  color: var(--muted);
  font-size: 12px;
}

.lead-create-modal input,
.lead-create-modal select {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
  padding: 10px;
}

.lead-create-modal > button {
  border: 0;
  border-radius: 8px;
  background: var(--brand);
  color: white;
  cursor: pointer;
  font-weight: 800;
  padding: 11px;
}

.kanban-subheader {
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}

.kanban-subheader__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kanban-subheader__title {
  font-size: 18px;
  font-weight: 900;
  color: var(--text);
  margin: 0;
}

.kanban-subheader__badge {
  background: var(--brand);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 999px;
}

.btn-csv {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
  color: var(--brand);
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--brand) 24%, white);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-shadow: var(--shadow-xs);
}

.btn-csv:hover {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
  box-shadow: var(--shadow-sm);
}

.kanban-alert {
  background: var(--warning-soft);
  color: var(--warning);
  border-bottom: 1px solid #f7df9b;
  padding: 10px 24px;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.kanban-board {
  flex: 1;
  display: flex;
  gap: 14px;
  padding: 18px;
  overflow-x: auto;
  overflow-y: hidden;
}

.kanban-column {
  flex: 1;
  min-width: 230px;
  max-width: 270px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-xs);
}

.kanban-column__header {
  padding: 11px 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text);
  font-weight: 900;
  font-size: 13px;
  flex-shrink: 0;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--stage) 16%, var(--surface)), var(--surface-raised)) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--stage) 20%, white);
}

.kanban-column__count {
  background: color-mix(in srgb, var(--stage) 15%, white);
  color: color-mix(in srgb, var(--stage) 70%, #10201c);
  border: 1px solid color-mix(in srgb, var(--stage) 25%, white);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 900;
}

.kanban-column__body { flex: 1; }

.kanban-column__cards {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px;
  min-height: 60px;
}

.kanban-column__empty {
  display: flex;
  justify-content: center;
  padding: 24px 0;
  opacity: 0.5;
}

.card-move, .card-enter-active, .card-leave-active { transition: all 0.3s ease; }
.card-enter-from, .card-leave-to { opacity: 0; transform: translateY(-8px); }
.card-leave-active { position: absolute; }
</style>
