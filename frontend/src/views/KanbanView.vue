<template>
  <div class="kanban-page">
    <!-- Header -->
    <div class="kanban-header">
      <div class="kanban-header__left">
        <span class="kanban-header__title">Pipeline de Matrículas</span>
        <NTag type="success" size="small" round>{{ totalLeads }} leads</NTag>
      </div>
      <NButton
        size="small"
        ghost
        style="color: #fff; border-color: rgba(255,255,255,0.5); margin-right: 8px"
        @click="router.push('/')"
      >
        ← Simulador
      </NButton>

      <NButton
        size="small"
        ghost
        style="color: #fff; border-color: rgba(255,255,255,0.5)"
        @click="handleLogout"
      >
        Sair
      </NButton>
    </div>

    <!-- Board -->
    <div class="kanban-board">
      <div
        v-for="col in columns"
        :key="col.status"
        class="kanban-column"
      >
        <!-- Column header -->
        <div class="kanban-column__header" :style="{ background: col.color }">
          <span class="kanban-column__title">{{ col.label }}</span>
          <span class="kanban-column__count">{{ leadsForStatus(col.status).length }}</span>
        </div>

        <!-- Cards -->
        <NScrollbar class="kanban-column__body">
          <div class="kanban-column__cards">
            <TransitionGroup name="card">
              <KanbanCard
                v-for="lead in leadsForStatus(col.status)"
                :key="lead.id"
                :lead="lead"
              />
            </TransitionGroup>
            <div v-if="leadsForStatus(col.status).length === 0" class="kanban-column__empty">
              <NEmpty description="Nenhum lead aqui" size="small" />
            </div>
          </div>
        </NScrollbar>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NTag, NButton, NScrollbar, NEmpty } from 'naive-ui'
import KanbanCard from '../components/kanban/KanbanCard.vue'
import { useSimulatorStore } from '../stores/simulator'
import { useAuthStore } from '../stores/auth'

const store = useSimulatorStore()
const authStore = useAuthStore()
const router = useRouter()

const columns = [
  { status: 'NOVO',        label: 'Novo Lead',    color: '#2080f0' },
  { status: 'CONTATO',     label: 'Em Contato',   color: '#f0a020' },
  { status: 'INSCRITO',    label: 'Inscrito',     color: '#8a2be2' },
  { status: 'MATRICULADO', label: 'Matriculado',  color: '#18a058' },
  { status: 'PERDIDO',     label: 'Perdido',      color: '#999'    },
]

const totalLeads = computed(() =>
  store.leads.filter((l) => l.status !== 'PERDIDO').length,
)

function leadsForStatus(status: string) {
  return store.leads.filter((l) => l.status === status)
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
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

.kanban-header {
  background: #075e54;
  color: #fff;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.kanban-header__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kanban-header__title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

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
  min-width: 220px;
  max-width: 280px;
  background: #e4e6ea;
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
}

.kanban-column__count {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 700;
}

.kanban-column__body {
  flex: 1;
}

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
  padding: 20px 0;
  opacity: 0.6;
}

/* Animação de movimentação de cards */
.card-move,
.card-enter-active,
.card-leave-active {
  transition: all 0.3s ease;
}
.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.card-leave-active {
  position: absolute;
}
</style>
