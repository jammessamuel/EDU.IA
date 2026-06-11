<template>
  <div class="dashboard-page">
    <AppNav />

    <!-- Sub-header -->
    <div class="dash-subheader">
      <div>
        <h1 class="dash-subheader__title">Dashboard</h1>
        <p class="dash-subheader__subtitle">Visão comercial dos leads, conversão e volume diário.</p>
      </div>
      <span v-if="metrics" class="dash-subheader__badge">{{ metrics.total }} leads ativos</span>
    </div>

    <div v-if="loading" class="dash-loading">
      <NSpin size="large" />
    </div>

    <div v-else-if="metrics" class="dash-content">
      <!-- Metric cards -->
      <div class="dash-cards">
        <div class="dash-card dash-card--blue">
          <span class="dash-card__eyebrow">Base</span>
          <div class="dash-card__value">{{ metrics.total }}</div>
          <div class="dash-card__label">Leads Ativos</div>
        </div>
        <div class="dash-card dash-card--green">
          <span class="dash-card__eyebrow">Receita</span>
          <div class="dash-card__value">{{ metrics.byStatus.MATRICULADO }}</div>
          <div class="dash-card__label">Matriculados</div>
        </div>
        <div class="dash-card dash-card--purple">
          <span class="dash-card__eyebrow">Performance</span>
          <div class="dash-card__value">{{ metrics.conversionRate }}%</div>
          <div class="dash-card__label">Taxa de Conversão</div>
        </div>
        <div class="dash-card dash-card--red">
          <span class="dash-card__eyebrow">Atenção</span>
          <div class="dash-card__value">{{ metrics.byStatus.PERDIDO }}</div>
          <div class="dash-card__label">Leads Perdidos</div>
        </div>
      </div>

      <div class="dash-charts">
        <!-- Funil de conversão -->
        <div class="dash-chart-box">
          <div class="dash-chart-box__title">Funil de Conversão</div>
          <div class="funnel">
            <div v-for="col in funnelCols" :key="col.status" class="funnel__row">
              <div class="funnel__label">{{ col.label }}</div>
              <div class="funnel__bar-wrap">
                <div
                  class="funnel__bar"
                  :style="{ width: funnelWidth(col.status) + '%', background: col.color }"
                ></div>
              </div>
              <div class="funnel__count">{{ metrics.byStatus[col.status] }}</div>
            </div>
          </div>
        </div>

        <!-- Leads por curso -->
        <div class="dash-chart-box">
          <div class="dash-chart-box__title">Leads por Curso</div>
          <div class="bar-chart">
            <div v-for="(count, course) in courseMetrics" :key="course" class="bar-chart__row">
              <div class="bar-chart__label">{{ course }}</div>
              <div class="bar-chart__bar-wrap">
                <div
                  class="bar-chart__bar"
                  :style="{ width: courseWidth(count as number) + '%' }"
                ></div>
              </div>
              <div class="bar-chart__count">{{ count }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Leads por dia (últimos 14 dias) -->
      <div class="dash-chart-box dash-chart-box--wide">
        <div class="dash-chart-box__title">Novos Leads — últimos 14 dias</div>
        <div class="line-chart">
          <div
            v-for="day in metrics.byDay"
            :key="day.date"
            class="line-chart__col"
            :title="`${day.date}: ${day.count} leads`"
          >
            <div class="line-chart__bar-wrap">
              <div
                class="line-chart__bar"
                :style="{ height: dayHeight(day.count) + '%' }"
              ></div>
            </div>
            <div class="line-chart__label">{{ day.date.slice(8) }}/{{ day.date.slice(5, 7) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NSpin } from 'naive-ui'
import { simulatorApi } from '@/api/simulator'
import AppNav from '@/components/layout/AppNav.vue'
import type { Metrics } from '@/types'

const metrics = ref<Metrics | null>(null)
const loading = ref(true)

const funnelCols = [
  { status: 'NOVO',        label: 'Novo Lead',   color: '#2080f0' },
  { status: 'CONTATO',     label: 'Em Contato',  color: '#f0a020' },
  { status: 'INSCRITO',    label: 'Inscrito',    color: '#8a2be2' },
  { status: 'MATRICULADO', label: 'Matriculado', color: '#18a058' },
]

const funnelMax = computed(() =>
  metrics.value ? Math.max(1, ...funnelCols.map((c) => metrics.value!.byStatus[c.status] ?? 0)) : 1,
)
function funnelWidth(status: string) {
  if (!metrics.value) return 0
  return Math.round(((metrics.value.byStatus[status] ?? 0) / funnelMax.value) * 100)
}

const courseMetrics = computed<Record<string, number>>(() => metrics.value?.byField?.course ?? {})
const courseMax = computed(() =>
  Math.max(1, ...Object.values(courseMetrics.value)),
)
function courseWidth(count: number) {
  return Math.round((count / courseMax.value) * 100)
}

const dayMax = computed(() =>
  metrics.value ? Math.max(1, ...metrics.value.byDay.map((d) => d.count)) : 1,
)
function dayHeight(count: number) {
  return Math.max(4, Math.round((count / dayMax.value) * 100))
}

onMounted(async () => {
  try {
    metrics.value = await simulatorApi.getMetrics()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: var(--app-bg);
  display: flex;
  flex-direction: column;
}

.dash-subheader {
  background: var(--surface-raised);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}

.dash-subheader__title {
  font-size: 19px;
  font-weight: 900;
  color: var(--text);
  margin: 0;
}

.dash-subheader__subtitle {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.dash-subheader__badge {
  background: var(--brand);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  padding: 5px 11px;
  border-radius: 999px;
  white-space: nowrap;
}

.dash-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dash-content {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

/* Cards */
.dash-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.dash-card {
  position: relative;
  overflow: hidden;
  background: var(--surface-raised);
  border-radius: 8px;
  padding: 17px 18px;
  box-shadow: var(--shadow-xs);
  border: 1px solid var(--border);
  border-left: 4px solid #d0d0d0;
  text-align: left;
}

.dash-card--blue   { border-left-color: #2563eb; }
.dash-card--green  { border-left-color: var(--accent-strong); }
.dash-card--purple { border-left-color: #7c3aed; }
.dash-card--red    { border-left-color: var(--danger); }

.dash-card__eyebrow {
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.dash-card__value {
  margin-top: 12px;
  font-size: 34px;
  font-weight: 900;
  color: var(--text);
  line-height: 1;
}

.dash-card__label {
  font-size: 13px;
  color: var(--muted);
  margin-top: 6px;
  font-weight: 700;
}

/* Charts row */
.dash-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.dash-chart-box {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--shadow-xs);
}

.dash-chart-box--wide {
  grid-column: 1 / -1;
}

.dash-chart-box__title {
  font-size: 14px;
  font-weight: 900;
  color: var(--text);
  margin-bottom: 16px;
}

/* Funnel */
.funnel { display: flex; flex-direction: column; gap: 10px; }

.funnel__row {
  display: grid;
  grid-template-columns: 110px 1fr 36px;
  align-items: center;
  gap: 8px;
}

.funnel__label { font-size: 12px; color: var(--muted-strong); text-align: right; font-weight: 700; }

.funnel__bar-wrap {
  background: var(--surface-muted);
  border-radius: 999px;
  height: 22px;
  overflow: hidden;
}

.funnel__bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.funnel__count { font-size: 13px; font-weight: 800; color: var(--text); }

/* Bar chart */
.bar-chart { display: flex; flex-direction: column; gap: 10px; }

.bar-chart__row {
  display: grid;
  grid-template-columns: 110px 1fr 36px;
  align-items: center;
  gap: 8px;
}

.bar-chart__label { font-size: 12px; color: var(--muted-strong); text-align: right; font-weight: 700; }

.bar-chart__bar-wrap {
  background: var(--surface-muted);
  border-radius: 999px;
  height: 22px;
  overflow: hidden;
}

.bar-chart__bar {
  height: 100%;
  background: linear-gradient(90deg, var(--brand), var(--accent-strong));
  border-radius: 999px;
  transition: width 0.4s ease;
}

.bar-chart__count { font-size: 13px; font-weight: 800; color: var(--text); }

/* Line chart (colunas verticais) */
.line-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 120px;
}

.line-chart__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  gap: 4px;
}

.line-chart__bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
}

.line-chart__bar {
  width: 100%;
  background: linear-gradient(180deg, var(--accent), var(--brand));
  border-radius: 3px 3px 0 0;
  min-height: 4px;
  transition: height 0.4s ease;
}

.line-chart__label {
  font-size: 10px;
  color: var(--muted);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .dash-cards { grid-template-columns: repeat(2, 1fr); }
  .dash-charts { grid-template-columns: 1fr; }
}
</style>
