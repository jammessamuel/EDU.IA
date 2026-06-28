<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NIcon, NSpin } from 'naive-ui'
import {
  BarChartOutline,
  CalendarOutline,
  CardOutline,
  CheckmarkCircleOutline,
  DocumentTextOutline,
  GitNetworkOutline,
  LaptopOutline,
  PaperPlaneOutline,
  PeopleOutline,
  RefreshOutline,
  SchoolOutline,
  ShieldCheckmarkOutline,
  TimeOutline,
  TrendingUpOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import { enrollmentApi } from '@/api/enrollments'
import { postSalesApi } from '@/api/postSales'
import { schoolConfigApi } from '@/api/schoolConfig'
import { simulatorApi } from '@/api/simulator'
import type {
  CourseOfferConfig,
  Enrollment,
  Metrics,
  PostSaleIntegrationLog,
  PostSaleOverview,
  PostSaleStudent,
  PostSaleTask,
  SchoolConfigOverview,
} from '@/types'

type PeriodKey = '7' | '30' | '90' | 'all'
type RouteTarget = '/post-sales' | '/enrollments' | '/kanban' | '/settings' | '/'

interface ExecutiveCard {
  key: string
  label: string
  value: string
  helper: string
  icon: typeof BarChartOutline
  tone: string
  route: RouteTarget
}

interface CoursePerformanceRow {
  name: string
  leads: number
  students: number
  completed: number
  revenue: number
  conversion: number
}

interface QueueItem {
  id: string
  studentId: string | null
  leadId?: string | null
  title: string
  studentName: string
  meta: string
  priority: string
  dueAt: string
  source: 'task' | 'risk'
}

const router = useRouter()
const metrics = ref<Metrics | null>(null)
const postSale = ref<PostSaleOverview | null>(null)
const enrollments = ref<Enrollment[]>([])
const schoolConfig = ref<SchoolConfigOverview | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selectedPeriod = ref<PeriodKey>('30')

const periodOptions: Array<{ key: PeriodKey; label: string }> = [
  { key: '7', label: '7 dias' },
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
  { key: 'all', label: 'Tudo' },
]

const leadStageLabels: Record<string, string> = {
  NOVO: 'Novos leads',
  CONTATO: 'Em contato',
  INSCRITO: 'Inscritos',
  MATRICULADO: 'Matriculados',
  PERDIDO: 'Perdidos',
}

const leadStageColors: Record<string, string> = {
  NOVO: '#60a5fa',
  CONTATO: '#f59e0b',
  INSCRITO: '#a78bfa',
  MATRICULADO: '#22c55e',
  PERDIDO: '#94a3b8',
}

const students = computed(() => postSale.value?.students ?? [])
const tasks = computed(() => postSale.value?.tasks ?? [])
const logs = computed(() => postSale.value?.integrationLogs ?? [])
const automations = computed(() => postSale.value?.automations ?? [])
const activeCourses = computed(() =>
  (schoolConfig.value?.courses ?? []).filter((course) => course.active),
)

const periodDays = computed(() =>
  selectedPeriod.value === 'all' ? null : Number(selectedPeriod.value),
)
const periodLabel = computed(() => {
  if (selectedPeriod.value === 'all') return 'todo o histórico'
  return `últimos ${selectedPeriod.value} dias`
})

const periodStudents = computed(() =>
  students.value.filter((student) => inSelectedPeriod(student.startedAt)),
)
const periodEnrollments = computed(() =>
  enrollments.value.filter((enrollment) => inSelectedPeriod(enrollment.createdAt)),
)
const periodLogs = computed(() => logs.value.filter((log) => inSelectedPeriod(log.createdAt)))

const ongoingStudents = computed(() =>
  periodStudents.value.filter((student) => student.status !== 'ONBOARDING_CONCLUIDO'),
)

const completedStudents = computed(() =>
  periodStudents.value.filter((student) => student.status === 'ONBOARDING_CONCLUIDO'),
)

const riskStudents = computed(() =>
  periodStudents.value
    .filter((student) => ['ALTO', 'CRITICO'].includes(student.riskLevel))
    .sort((a, b) => b.riskScore - a.riskScore),
)

const criticalPendingCount = computed(
  () =>
    documentPendingCount.value +
    contractPendingCount.value +
    paymentPendingCount.value +
    accessPendingCount.value,
)

const documentPendingCount = computed(
  () => periodStudents.value.filter((student) => student.status === 'DOCUMENTACAO_PENDENTE').length,
)
const contractPendingCount = computed(
  () => periodStudents.value.filter((student) => student.status === 'CONTRATO_PENDENTE').length,
)
const paymentPendingCount = computed(
  () => periodStudents.value.filter((student) => student.status === 'PAGAMENTO_PENDENTE').length,
)
const accessPendingCount = computed(
  () => periodStudents.value.filter((student) => student.status === 'ACESSO_PENDENTE').length,
)

const expectedRevenue = computed(() =>
  periodStudents.value.reduce((sum, student) => sum + valueForStudent(student), 0),
)

const pendingRevenue = computed(() =>
  periodStudents.value
    .filter((student) => /pendente|falhou|pix/i.test(student.paymentStatus))
    .reduce((sum, student) => sum + valueForStudent(student), 0),
)

const paidRevenue = computed(() =>
  periodStudents.value
    .filter((student) => /pago|aprovado/i.test(student.paymentStatus))
    .reduce((sum, student) => sum + valueForStudent(student), 0),
)

const automationSentCount = computed(() => {
  const sentByRuler = automations.value.reduce((sum, item) => sum + item.sentCount, 0)
  const sentByLog = periodLogs.value.filter((log) => log.service === 'WHATSAPP').length
  return Math.max(sentByRuler, sentByLog)
})

const automationQueuedCount = computed(() =>
  automations.value.reduce((sum, item) => sum + item.pendingCount + item.scheduledCount, 0),
)

const conversionRate = computed(() => metrics.value?.conversionRate ?? 0)
const activeLeadCount = computed(() => metrics.value?.total ?? 0)
const riskRate = computed(() =>
  periodStudents.value.length
    ? Math.round((riskStudents.value.length / periodStudents.value.length) * 100)
    : 0,
)

const executiveCards = computed<ExecutiveCard[]>(() => [
  {
    key: 'revenue',
    label: 'Receita prevista',
    value: formatCurrency(expectedRevenue.value),
    helper: `${formatCurrency(pendingRevenue.value)} ainda em aberto`,
    icon: CardOutline,
    tone: 'revenue',
    route: '/post-sales',
  },
  {
    key: 'ongoing',
    label: 'Matrículas em andamento',
    value: String(ongoingStudents.value.length),
    helper: `${completedStudents.value.length} onboarding concluído`,
    icon: SchoolOutline,
    tone: 'brand',
    route: '/post-sales',
  },
  {
    key: 'pending',
    label: 'Pendências críticas',
    value: String(criticalPendingCount.value),
    helper: 'Documentos, contrato, pagamento e acesso',
    icon: WarningOutline,
    tone: 'warning',
    route: '/post-sales',
  },
  {
    key: 'risk',
    label: 'Alunos em risco',
    value: String(riskStudents.value.length),
    helper: `${riskRate.value}% da base no período`,
    icon: PeopleOutline,
    tone: 'danger',
    route: '/post-sales',
  },
  {
    key: 'automation',
    label: 'Automações disparadas',
    value: String(automationSentCount.value),
    helper: `${automationQueuedCount.value} na fila da régua`,
    icon: PaperPlaneOutline,
    tone: 'info',
    route: '/post-sales',
  },
  {
    key: 'conversion',
    label: 'Conversão comercial',
    value: `${conversionRate.value}%`,
    helper: `${activeLeadCount.value} leads ativos no pipeline`,
    icon: TrendingUpOutline,
    tone: 'success',
    route: '/kanban',
  },
])

const operationalFunnel = computed(() => {
  const status = metrics.value?.byStatus ?? {}
  return ['NOVO', 'CONTATO', 'INSCRITO', 'MATRICULADO', 'POS_VENDA', 'ONBOARDING_CONCLUIDO'].map(
    (key) => {
      if (key === 'POS_VENDA') {
        return {
          key,
          label: 'Pós-venda ativo',
          count: ongoingStudents.value.length,
          color: '#14b8a6',
          route: '/post-sales' as RouteTarget,
        }
      }
      if (key === 'ONBOARDING_CONCLUIDO') {
        return {
          key,
          label: 'Onboarding concluído',
          count: completedStudents.value.length,
          color: '#16a34a',
          route: '/post-sales' as RouteTarget,
        }
      }
      return {
        key,
        label: leadStageLabels[key] ?? key,
        count: status[key] ?? 0,
        color: leadStageColors[key] ?? '#64748b',
        route: key === 'MATRICULADO' ? ('/enrollments' as RouteTarget) : ('/kanban' as RouteTarget),
      }
    },
  )
})

const funnelMax = computed(() =>
  Math.max(1, ...operationalFunnel.value.map((stage) => stage.count)),
)

const bottlenecks = computed(() => [
  {
    label: 'Documentos',
    value: documentPendingCount.value,
    helper: 'bloqueando contrato',
    icon: DocumentTextOutline,
    tone: 'warning',
  },
  {
    label: 'Contrato',
    value: contractPendingCount.value,
    helper: 'assinatura pendente',
    icon: ShieldCheckmarkOutline,
    tone: 'purple',
  },
  {
    label: 'Pagamento',
    value: paymentPendingCount.value,
    helper: formatCurrency(pendingRevenue.value),
    icon: CardOutline,
    tone: 'info',
  },
  {
    label: 'Acesso',
    value: accessPendingCount.value,
    helper: 'AVA aguardando liberação',
    icon: LaptopOutline,
    tone: 'brand',
  },
])

const courseRows = computed<CoursePerformanceRow[]>(() => {
  const byCourse = metrics.value?.byField?.course ?? {}
  const names = new Set<string>([
    ...activeCourses.value.map((course) => course.name),
    ...Object.keys(byCourse),
    ...periodStudents.value.map((student) => student.course),
    ...periodEnrollments.value.map((enrollment) => enrollment.course ?? '').filter(Boolean),
  ])

  return Array.from(names)
    .map((name) => {
      const leads = byCourse[name] ?? 0
      const courseStudents = periodStudents.value.filter((student) => student.course === name)
      const completed = courseStudents.filter(
        (student) => student.status === 'ONBOARDING_CONCLUIDO',
      ).length
      const revenue = courseStudents.reduce((sum, student) => sum + valueForStudent(student), 0)
      const conversion =
        leads > 0
          ? Math.round((courseStudents.length / leads) * 100)
          : courseStudents.length
            ? 100
            : 0
      return {
        name,
        leads,
        students: courseStudents.length,
        completed,
        revenue,
        conversion,
      }
    })
    .sort((a, b) => b.revenue - a.revenue || b.students - a.students || b.leads - a.leads)
    .slice(0, 6)
})

const courseMax = computed(() =>
  Math.max(1, ...courseRows.value.flatMap((row) => [row.leads, row.students])),
)

const actionQueue = computed<QueueItem[]>(() => {
  const fromTasks = tasks.value.map((task) => ({
    id: task.id,
    studentId: task.studentId,
    leadId: task.leadId ?? null,
    title: task.title,
    studentName: task.studentName,
    meta: `${task.ownerTeam} · ${taskAutomationLabel(task)}`,
    priority: task.priority,
    dueAt: task.dueAt,
    source: 'task' as const,
  }))

  const existingTaskStudents = new Set(fromTasks.map((task) => task.studentId))
  const fromRisk = riskStudents.value
    .filter((student) => !existingTaskStudents.has(student.id))
    .map((student) => ({
      id: `risk-${student.id}`,
      studentId: student.id,
      title: student.nextAction,
      studentName: student.studentName,
      meta: `${student.course} · risco ${riskLabel(student)}`,
      priority: student.riskLevel === 'CRITICO' ? 'Urgente' : 'Alta',
      dueAt: student.upcomingDueAt,
      source: 'risk' as const,
    }))

  return [...fromTasks, ...fromRisk]
    .sort(
      (a, b) =>
        priorityWeight(a.priority) - priorityWeight(b.priority) ||
        new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    )
    .slice(0, 8)
})

const recentLogs = computed(() =>
  [...periodLogs.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6),
)

const automationRows = computed(() =>
  [...automations.value].sort((a, b) => a.day - b.day).slice(0, 6),
)

const dailyLeadRows = computed(() => {
  const days = metrics.value?.byDay ?? []
  if (selectedPeriod.value === '7') return days.slice(-7)
  return days
})

const dailyLeadMax = computed(() => Math.max(1, ...dailyLeadRows.value.map((day) => day.count)))

const managerInsights = computed(() => {
  const insights = []
  if (criticalPendingCount.value > 0) {
    insights.push({
      title: 'Remover bloqueios de matrícula',
      text: `${criticalPendingCount.value} pendência(s) travam contrato, pagamento ou acesso.`,
      route: '/post-sales' as RouteTarget,
    })
  }
  if (riskStudents.value.length > 0) {
    insights.push({
      title: 'Atacar risco de evasão primeiro',
      text: `${riskStudents.value.length} aluno(s) precisam de intervenção antes de esfriar.`,
      route: '/post-sales' as RouteTarget,
    })
  }
  if (conversionRate.value < 35 && activeLeadCount.value > 0) {
    insights.push({
      title: 'Revisar abordagem comercial',
      text: `Conversão em ${conversionRate.value}%; vale revisar mensagens, oferta e follow-up.`,
      route: '/kanban' as RouteTarget,
    })
  }
  if (automationQueuedCount.value > 0) {
    insights.push({
      title: 'Disparar régua pendente',
      text: `${automationQueuedCount.value} mensagem(ns) podem ser simuladas agora no pós-venda.`,
      route: '/post-sales' as RouteTarget,
    })
  }
  if (!insights.length) {
    insights.push({
      title: 'Operação saudável',
      text: 'Sem gargalos críticos no período selecionado.',
      route: '/post-sales' as RouteTarget,
    })
  }
  return insights.slice(0, 4)
})

const generatedAtLabel = computed(() => {
  const generatedAt = postSale.value?.generatedAt
  if (!generatedAt) return 'dados em tempo real'
  return `atualizado ${formatDate(generatedAt)}`
})

onMounted(loadDashboard)

async function loadDashboard() {
  loading.value = true
  error.value = null
  try {
    const [leadMetrics, postSaleOverview, enrollmentList, configOverview] = await Promise.all([
      simulatorApi.getMetrics(),
      postSalesApi.overview(),
      enrollmentApi.list(),
      schoolConfigApi.overview(),
    ])
    metrics.value = leadMetrics
    postSale.value = postSaleOverview
    enrollments.value = enrollmentList
    schoolConfig.value = configOverview
  } catch {
    error.value = 'Não foi possível carregar o painel executivo agora.'
  } finally {
    loading.value = false
  }
}

function inSelectedPeriod(dateValue?: string | null) {
  if (!dateValue || periodDays.value === null) return true
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return true
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - periodDays.value)
  return date >= cutoff
}

function goTo(route: RouteTarget) {
  router.push(route)
}

function goToQueueItem(item: QueueItem) {
  if (item.studentId) {
    router.push(`/post-sales/students/${item.studentId}`)
    return
  }
  router.push('/pipeline')
}

function goToStudent(studentId: string) {
  router.push(`/post-sales/students/${studentId}`)
}

function statusCount(status: string) {
  return metrics.value?.byStatus?.[status] ?? 0
}

function funnelWidth(count: number) {
  return Math.max(5, Math.round((count / funnelMax.value) * 100))
}

function courseBarWidth(value: number) {
  return Math.max(value > 0 ? 5 : 0, Math.round((value / courseMax.value) * 100))
}

function dailyHeight(count: number) {
  return Math.max(count > 0 ? 12 : 4, Math.round((count / dailyLeadMax.value) * 100))
}

function courseForName(name: string): CourseOfferConfig | null {
  return activeCourses.value.find((course) => course.name === name) ?? null
}

function valueForStudent(student: PostSaleStudent) {
  const enrollment = student.enrollmentId
    ? enrollments.value.find((item) => item.id === student.enrollmentId)
    : null
  const course = courseForName(student.course)
  const enrollmentAmount = Number(enrollment?.paymentAmount ?? 0)
  if (enrollmentAmount > 0) return enrollmentAmount
  return Number(course?.enrollmentFee ?? course?.monthlyFee ?? 0)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}`
}

function riskLabel(student: PostSaleStudent) {
  if (student.riskLevel === 'CRITICO') return 'crítico'
  if (student.riskLevel === 'ALTO') return 'alto'
  if (student.riskLevel === 'MEDIO') return 'médio'
  return 'baixo'
}

function priorityWeight(priority: string) {
  const normalized = priority.toLowerCase()
  if (normalized.includes('urgente') || normalized.includes('crítico')) return 0
  if (normalized.includes('alta')) return 1
  if (normalized.includes('normal')) return 2
  return 3
}

function taskAutomationLabel(task: PostSaleTask) {
  return task.automation.replace(/Tarefa manual/gi, 'Criada pela equipe')
}

function serviceLabel(log: PostSaleIntegrationLog) {
  const labels: Record<PostSaleIntegrationLog['service'], string> = {
    WHATSAPP: 'WhatsApp fake',
    PAGAMENTO: 'Pagamento fake',
    CONTRATO: 'Contrato fake',
    DOCUMENTOS: 'Documentos fake',
    ALERTAS: 'Alertas fake',
  }
  return labels[log.service]
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    SEND_MESSAGE: 'Mensagem enviada',
    MARK_PAID: 'Pagamento pago',
    FAIL: 'Pagamento falhou',
    REFUND: 'Pagamento estornado',
    PENDING: 'Pagamento pendente',
    SEND: 'Contrato enviado',
    VIEW: 'Contrato visualizado',
    SIGN: 'Contrato assinado',
    DISPATCH_ALERT: 'Alerta disparado',
    EXPIRE: 'Contrato expirado',
    RECEIVE: 'Documento recebido',
    APPROVE: 'Documento aprovado',
    REJECT: 'Documento recusado',
  }
  return labels[action] ?? action
}
</script>

<template>
  <div class="executive-page">
    <AppNav />

    <main class="executive-shell">
      <header class="executive-header">
        <div class="executive-header__copy">
          <span class="eyebrow">Painel do gestor</span>
          <h1>Visão executiva da operação</h1>
          <p>
            Receita, matrículas, gargalos, risco de evasão, automações e conversão em uma tela
            acionável.
          </p>
        </div>

        <div class="executive-header__actions">
          <div class="period-switcher" role="tablist" aria-label="Período do painel">
            <button
              v-for="option in periodOptions"
              :key="option.key"
              type="button"
              :class="{ active: selectedPeriod === option.key }"
              role="tab"
              :aria-selected="selectedPeriod === option.key"
              @click="selectedPeriod = option.key"
            >
              {{ option.label }}
            </button>
          </div>
          <button type="button" class="refresh-button" :disabled="loading" @click="loadDashboard">
            <NIcon :component="RefreshOutline" size="16" />
            Atualizar
          </button>
        </div>
      </header>

      <div v-if="loading" class="loading-state">
        <NSpin size="large" />
      </div>

      <template v-else>
        <NAlert v-if="error" type="error" closable class="dashboard-alert" @close="error = null">
          {{ error }}
        </NAlert>

        <section class="command-strip" aria-label="Resumo do período">
          <div>
            <span>{{ generatedAtLabel }}</span>
            <strong>{{ periodLabel }}</strong>
          </div>
          <button type="button" @click="goTo('/post-sales')">Ver operação</button>
          <button type="button" @click="goTo('/kanban')">Ver pipeline</button>
          <button type="button" @click="goTo('/settings')">Ajustar escola</button>
        </section>

        <section class="kpi-grid" aria-label="Indicadores executivos">
          <button
            v-for="card in executiveCards"
            :key="card.key"
            type="button"
            class="kpi-card"
            :class="`kpi-card--${card.tone}`"
            @click="goTo(card.route)"
          >
            <span class="kpi-card__icon">
              <NIcon :component="card.icon" size="19" />
            </span>
            <span class="kpi-card__label">{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <small>{{ card.helper }}</small>
          </button>
        </section>

        <section class="executive-grid">
          <article class="panel panel--wide">
            <div class="panel-head">
              <div>
                <h2>Funil completo</h2>
                <p>Do primeiro contato até onboarding concluído.</p>
              </div>
              <span>{{ statusCount('PERDIDO') }} perdidos</span>
            </div>

            <div class="funnel-board">
              <button
                v-for="stage in operationalFunnel"
                :key="stage.key"
                type="button"
                class="funnel-stage"
                @click="goTo(stage.route)"
              >
                <span class="funnel-stage__top">
                  <small>{{ stage.label }}</small>
                  <strong>{{ stage.count }}</strong>
                </span>
                <span class="funnel-stage__track">
                  <i
                    :style="{ width: `${funnelWidth(stage.count)}%`, background: stage.color }"
                  ></i>
                </span>
              </button>
            </div>
          </article>

          <article class="panel panel--finance">
            <div class="panel-head">
              <div>
                <h2>Receita de matrícula</h2>
                <p>Valores calculados por curso e matrícula.</p>
              </div>
              <NIcon :component="CardOutline" size="21" />
            </div>

            <div class="finance-meter">
              <strong>{{ formatCurrency(expectedRevenue) }}</strong>
              <span>Previsto no período</span>
              <div class="finance-meter__track">
                <i
                  :style="{
                    width: expectedRevenue
                      ? `${Math.round((paidRevenue / expectedRevenue) * 100)}%`
                      : '0%',
                  }"
                ></i>
              </div>
              <small
                >{{ formatCurrency(paidRevenue) }} pago ·
                {{ formatCurrency(pendingRevenue) }} pendente</small
              >
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <h2>Gargalos</h2>
                <p>Onde a matrícula trava hoje.</p>
              </div>
              <NIcon :component="WarningOutline" size="21" />
            </div>

            <div class="bottleneck-grid">
              <button
                v-for="item in bottlenecks"
                :key="item.label"
                type="button"
                class="bottleneck-item"
                :class="`bottleneck-item--${item.tone}`"
                @click="goTo('/post-sales')"
              >
                <NIcon :component="item.icon" size="18" />
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <small>{{ item.helper }}</small>
              </button>
            </div>
          </article>

          <article class="panel panel--wide">
            <div class="panel-head">
              <div>
                <h2>Conversão por curso</h2>
                <p>Leads, matrículas em jornada e receita prevista por oferta.</p>
              </div>
              <button type="button" class="panel-link" @click="goTo('/settings')">
                Editar cursos
              </button>
            </div>

            <div class="course-table">
              <button
                v-for="course in courseRows"
                :key="course.name"
                type="button"
                class="course-row"
                @click="goTo('/kanban')"
              >
                <span class="course-row__name">
                  <strong>{{ course.name }}</strong>
                  <small
                    >{{ course.conversion }}% conversão ·
                    {{ formatCurrency(course.revenue) }}</small
                  >
                </span>
                <span class="course-row__bars">
                  <i
                    class="course-row__lead"
                    :style="{ width: `${courseBarWidth(course.leads)}%` }"
                  ></i>
                  <i
                    class="course-row__student"
                    :style="{ width: `${courseBarWidth(course.students)}%` }"
                  ></i>
                </span>
                <span class="course-row__numbers">
                  <strong>{{ course.students }}</strong>
                  <small>{{ course.leads }} leads</small>
                </span>
              </button>
              <p v-if="!courseRows.length" class="empty-note">
                Cadastre cursos ativos para visualizar performance por oferta.
              </p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <h2>Ações de hoje</h2>
                <p>Fila priorizada por risco e vencimento.</p>
              </div>
              <NIcon :component="TimeOutline" size="21" />
            </div>

            <div class="queue-list">
              <button
                v-for="item in actionQueue"
                :key="item.id"
                type="button"
                class="queue-item"
                @click="goToQueueItem(item)"
              >
                <span
                  class="queue-item__priority"
                  :class="`priority-${priorityWeight(item.priority)}`"
                >
                  {{ item.priority }}
                </span>
                <strong>{{ item.title }}</strong>
                <small>{{ item.studentName }} · {{ item.meta }}</small>
                <em>vence {{ formatDate(item.dueAt) }}</em>
              </button>
              <p v-if="!actionQueue.length" class="empty-note">Nenhuma ação crítica no período.</p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <h2>Alunos em risco</h2>
                <p>Antievasão baseado em pendência e inatividade.</p>
              </div>
              <NIcon :component="PeopleOutline" size="21" />
            </div>

            <div class="risk-list">
              <button
                v-for="student in riskStudents.slice(0, 6)"
                :key="student.id"
                type="button"
                class="risk-row"
                @click="goToStudent(student.id)"
              >
                <span>{{ student.studentName.charAt(0).toUpperCase() }}</span>
                <strong>{{ student.studentName }}</strong>
                <small>{{ student.course }} · {{ student.nextAction }}</small>
                <em>{{ student.riskScore }}</em>
              </button>
              <p v-if="!riskStudents.length" class="empty-note">
                Nenhum aluno em risco alto ou crítico.
              </p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <h2>Automações</h2>
                <p>Régua dia 0, 1, 3, 7, 15 e 30.</p>
              </div>
              <NIcon :component="PaperPlaneOutline" size="21" />
            </div>

            <div class="automation-list">
              <div
                v-for="automation in automationRows"
                :key="automation.day"
                class="automation-row"
              >
                <span>Dia {{ automation.day }}</span>
                <strong>{{ automation.title }}</strong>
                <small
                  >{{ automation.sentCount }} enviados · {{ automation.pendingCount }} pendentes ·
                  {{ automation.scheduledCount }} agendados</small
                >
              </div>
              <p v-if="!automationRows.length" class="empty-note">
                Nenhuma régua ativa encontrada.
              </p>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <h2>Atividade fake</h2>
                <p>Logs visíveis para demonstração.</p>
              </div>
              <NIcon :component="CalendarOutline" size="21" />
            </div>

            <div class="log-list">
              <button
                v-for="log in recentLogs"
                :key="log.id"
                type="button"
                class="log-row"
                @click="log.studentKey ? goToStudent(log.studentKey) : goTo('/post-sales')"
              >
                <span>{{ serviceLabel(log) }}</span>
                <strong>{{ actionLabel(log.action) }}</strong>
                <small
                  >{{ log.studentName ?? 'Operação da escola' }} ·
                  {{ formatDate(log.createdAt) }}</small
                >
              </button>
              <p v-if="!recentLogs.length" class="empty-note">
                Execute simulações para popular o histórico.
              </p>
            </div>
          </article>

          <article class="panel panel--wide">
            <div class="panel-head">
              <div>
                <h2>Novos leads</h2>
                <p>Volume diário recebido pelo simulador nos últimos registros.</p>
              </div>
              <button type="button" class="panel-link" @click="goTo('/kanban')">
                Abrir pipeline
              </button>
            </div>

            <div class="daily-bars">
              <div
                v-for="day in dailyLeadRows"
                :key="day.date"
                class="daily-bar"
                :title="`${formatShortDate(day.date)}: ${day.count} lead(s)`"
              >
                <span>
                  <i :style="{ height: `${dailyHeight(day.count)}%` }"></i>
                </span>
                <small>{{ formatShortDate(day.date) }}</small>
              </div>
            </div>
          </article>

          <article class="panel">
            <div class="panel-head">
              <div>
                <h2>Recomendações</h2>
                <p>O que o gestor deveria fazer agora.</p>
              </div>
              <NIcon :component="CheckmarkCircleOutline" size="21" />
            </div>

            <div class="insight-list">
              <button
                v-for="insight in managerInsights"
                :key="insight.title"
                type="button"
                class="insight-row"
                @click="goTo(insight.route)"
              >
                <strong>{{ insight.title }}</strong>
                <small>{{ insight.text }}</small>
              </button>
            </div>
          </article>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.executive-page {
  height: 100vh;
  height: 100dvh;
  background: var(--app-bg);
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.executive-shell {
  width: min(100%, 1480px);
  margin: 0 auto;
  padding: 22px;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
}

.executive-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.executive-header__copy {
  min-width: 0;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--brand) 24%, transparent);
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.executive-header h1 {
  margin: 10px 0 5px;
  color: var(--text);
  font-size: 27px;
  line-height: 1.08;
  font-weight: 950;
}

.executive-header p {
  max-width: 720px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.45;
}

.executive-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.period-switcher {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
}

.period-switcher button,
.refresh-button,
.command-strip button,
.panel-link {
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  font-weight: 850;
  transition:
    transform 0.16s ease,
    background 0.16s ease,
    color 0.16s ease,
    border-color 0.16s ease;
}

.period-switcher button {
  min-height: 32px;
  padding: 0 11px;
  background: transparent;
  color: var(--muted-strong);
  font-size: 12px;
}

.period-switcher button.active {
  background: var(--brand);
  color: #fff;
}

.refresh-button {
  min-height: 42px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
}

.refresh-button:hover,
.command-strip button:hover,
.panel-link:hover {
  transform: translateY(-1px);
}

.loading-state {
  min-height: 420px;
  display: grid;
  place-items: center;
}

.dashboard-alert {
  border-radius: 8px;
}

.command-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
}

.command-strip div {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.command-strip span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.command-strip strong {
  color: var(--text);
  font-size: 15px;
  font-weight: 900;
}

.command-strip button,
.panel-link {
  min-height: 36px;
  padding: 0 13px;
  background: var(--surface-muted);
  color: var(--text);
  border: 1px solid var(--border);
  font-size: 12px;
  white-space: nowrap;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.kpi-card {
  position: relative;
  min-height: 160px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--kpi-color) 10%, transparent), transparent 58%),
    var(--surface-raised);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.kpi-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--kpi-color);
}

.kpi-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--kpi-color) 46%, var(--border));
  box-shadow: var(--shadow-sm);
}

.kpi-card--revenue {
  --kpi-color: #22c55e;
}
.kpi-card--brand {
  --kpi-color: var(--brand);
}
.kpi-card--warning {
  --kpi-color: var(--warning);
}
.kpi-card--danger {
  --kpi-color: var(--danger);
}
.kpi-card--info {
  --kpi-color: var(--info);
}
.kpi-card--success {
  --kpi-color: var(--accent-strong);
}

.kpi-card__icon {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--kpi-color) 14%, transparent);
  color: var(--kpi-color);
}

.kpi-card__label {
  display: block;
  margin-top: 12px;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 850;
}

.kpi-card strong {
  display: block;
  margin-top: 8px;
  color: var(--text);
  font-size: 26px;
  line-height: 1;
  font-weight: 950;
  word-break: break-word;
}

.kpi-card small {
  display: block;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
  font-weight: 700;
}

.executive-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(330px, 0.85fr);
  gap: 14px;
  align-items: start;
}

.panel {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
}

.panel--wide {
  grid-column: 1 / 2;
}

.panel--finance {
  min-height: 238px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-head h2 {
  color: var(--text);
  font-size: 16px;
  font-weight: 950;
  line-height: 1.2;
}

.panel-head p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.panel-head > span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.panel-head .n-icon {
  color: var(--brand);
  flex-shrink: 0;
}

.funnel-board {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 9px;
}

.funnel-stage {
  min-width: 0;
  min-height: 104px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  cursor: pointer;
  text-align: left;
}

.funnel-stage__top {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
}

.funnel-stage small,
.course-row small,
.queue-item small,
.risk-row small,
.automation-row small,
.log-row small,
.insight-row small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
  font-weight: 700;
}

.funnel-stage strong {
  color: var(--text);
  font-size: 25px;
  line-height: 1;
  font-weight: 950;
}

.funnel-stage__track {
  display: block;
  height: 8px;
  margin-top: 18px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
}

.funnel-stage__track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
}

.finance-meter {
  display: flex;
  min-height: 160px;
  flex-direction: column;
  justify-content: center;
}

.finance-meter strong {
  color: var(--text);
  font-size: 31px;
  line-height: 1;
  font-weight: 950;
}

.finance-meter > span {
  margin-top: 8px;
  color: var(--muted-strong);
  font-size: 13px;
  font-weight: 850;
}

.finance-meter__track {
  height: 11px;
  margin-top: 22px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
}

.finance-meter__track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--brand), var(--accent-strong));
}

.finance-meter small {
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
}

.bottleneck-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.bottleneck-item {
  min-height: 116px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  cursor: pointer;
  text-align: left;
}

.bottleneck-item .n-icon {
  color: var(--bottleneck-color);
}

.bottleneck-item--warning {
  --bottleneck-color: var(--warning);
}
.bottleneck-item--purple {
  --bottleneck-color: #a78bfa;
}
.bottleneck-item--info {
  --bottleneck-color: var(--info);
}
.bottleneck-item--brand {
  --bottleneck-color: var(--brand);
}

.bottleneck-item span {
  display: block;
  margin-top: 8px;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 850;
}

.bottleneck-item strong {
  display: block;
  margin-top: 7px;
  color: var(--text);
  font-size: 25px;
  line-height: 1;
  font-weight: 950;
}

.bottleneck-item small {
  display: block;
  margin-top: 7px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
  font-weight: 700;
}

.course-table,
.queue-list,
.risk-list,
.automation-list,
.log-list,
.insight-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.course-row {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(170px, 1fr) 92px;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  cursor: pointer;
  text-align: left;
}

.course-row__name {
  min-width: 0;
}

.course-row strong,
.queue-item strong,
.risk-row strong,
.automation-row strong,
.log-row strong,
.insight-row strong {
  display: block;
  color: var(--text);
  font-size: 13px;
  line-height: 1.3;
  font-weight: 900;
}

.course-row__bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.course-row__bars i {
  display: block;
  height: 9px;
  border-radius: 999px;
}

.course-row__lead {
  background: color-mix(in srgb, var(--info) 60%, transparent);
}

.course-row__student {
  background: linear-gradient(90deg, var(--brand), var(--accent-strong));
}

.course-row__numbers {
  text-align: right;
}

.course-row__numbers strong {
  font-size: 20px;
}

.queue-item,
.log-row,
.insight-row {
  width: 100%;
  min-height: 72px;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  cursor: pointer;
  text-align: left;
}

.queue-item__priority {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  color: var(--priority-color);
  background: color-mix(in srgb, var(--priority-color) 14%, transparent);
  font-size: 11px;
  font-weight: 900;
}

.priority-0 {
  --priority-color: var(--danger);
}
.priority-1 {
  --priority-color: var(--warning);
}
.priority-2 {
  --priority-color: var(--brand);
}
.priority-3 {
  --priority-color: var(--muted);
}

.queue-item strong {
  margin-top: 7px;
}

.queue-item em {
  display: block;
  margin-top: 6px;
  color: var(--muted-strong);
  font-size: 11px;
  font-style: normal;
  font-weight: 850;
}

.risk-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 42px;
  grid-template-areas:
    'avatar name score'
    'avatar meta score';
  align-items: center;
  gap: 2px 10px;
  width: 100%;
  min-height: 62px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  cursor: pointer;
  text-align: left;
}

.risk-row span {
  grid-area: avatar;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 13px;
  font-weight: 950;
}

.risk-row strong {
  grid-area: name;
}

.risk-row small {
  grid-area: meta;
}

.risk-row em {
  grid-area: score;
  justify-self: end;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
  font-size: 13px;
  font-style: normal;
  font-weight: 950;
}

.automation-row {
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.automation-row span,
.log-row span {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 11px;
  font-weight: 900;
}

.automation-row strong,
.log-row strong {
  margin-top: 7px;
}

.daily-bars {
  height: 188px;
  display: flex;
  align-items: stretch;
  gap: 7px;
  padding-top: 8px;
}

.daily-bar {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.daily-bar span {
  width: 100%;
  flex: 1;
  display: flex;
  align-items: flex-end;
  border-radius: 8px;
  background: var(--surface-muted);
  overflow: hidden;
}

.daily-bar i {
  width: 100%;
  display: block;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, var(--accent), var(--brand));
}

.daily-bar small {
  color: var(--muted);
  font-size: 10px;
  font-weight: 750;
  white-space: nowrap;
}

.insight-row {
  min-height: 78px;
}

.empty-note {
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
  text-align: center;
}

@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .executive-grid {
    grid-template-columns: 1fr;
  }

  .panel--wide {
    grid-column: auto;
  }

  .funnel-board {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .executive-shell {
    padding: 14px;
  }

  .executive-header,
  .command-strip {
    flex-direction: column;
    align-items: stretch;
  }

  .executive-header__actions {
    justify-content: flex-start;
  }

  .period-switcher {
    overflow-x: auto;
  }

  .kpi-grid,
  .funnel-board,
  .bottleneck-grid {
    grid-template-columns: 1fr;
  }

  .course-row {
    grid-template-columns: 1fr;
  }

  .course-row__numbers {
    text-align: left;
  }

  .daily-bars {
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .daily-bar {
    min-width: 42px;
  }
}
</style>
