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
        ↓ Exportar CSV
      </button>
    </div>

    <!-- Banner de follow-up -->
    <div v-if="staleCount > 0" class="kanban-alert">
      ⚠ {{ staleCount }} lead{{ staleCount > 1 ? 's' : '' }} em "Novo Lead" sem contato há mais de 24h —
      avance-{{ staleCount > 1 ? 'os' : 'o' }} para <strong>Em Contato</strong>.
    </div>

    <!-- Modal de detalhe -->
    <LeadDetailModal :lead="detailLead" @close="detailLead = null" />

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
import { NScrollbar, NEmpty } from 'naive-ui'
import KanbanCard from '../components/kanban/KanbanCard.vue'
import LeadDetailModal from '../components/leads/LeadDetailModal.vue'
import AppNav from '../components/layout/AppNav.vue'
import { useSimulatorStore } from '../stores/simulator'
import { useWorkspaceStore } from '../stores/workspace'
import type { Lead } from '../types'

const store      = useSimulatorStore()
const ws         = useWorkspaceStore()
const detailLead = ref<Lead | null>(null)

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

onMounted(() => store.fetchLeads())
</script>

<style scoped>
.kanban-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
  overflow: hidden;
}

/* Sub-header */
.kanban-subheader {
  background: #fff;
  border-bottom: 1px solid #e9edef;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.kanban-subheader__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kanban-subheader__title {
  font-size: 17px;
  font-weight: 700;
  color: #111b21;
  margin: 0;
}

.kanban-subheader__badge {
  background: #075e54;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 20px;
}

.btn-csv {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #075e54;
  background: #e8f5e9;
  border: 1px solid #b2dfdb;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-csv:hover {
  background: #c8e6c9;
}

/* Alert banner */
.kanban-alert {
  background: #fffbeb;
  color: #92400e;
  border-left: 4px solid #f59e0b;
  padding: 10px 24px;
  font-size: 13px;
  flex-shrink: 0;
}

/* Board */
.kanban-board {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 16px;
  overflow-x: auto;
  overflow-y: hidden;
}

.kanban-column {
  flex: 1;
  min-width: 210px;
  max-width: 270px;
  background: #e8eaed;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.kanban-column__header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
  border-radius: 12px 12px 0 0;
}

.kanban-column__count {
  background: rgba(255,255,255,0.3);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 700;
}

.kanban-column__body { flex: 1; }

.kanban-column__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
