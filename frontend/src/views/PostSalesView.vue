<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NIcon, NScrollbar, NSpin } from 'naive-ui'
import {
  AddCircleOutline,
  CalendarOutline,
  CardOutline,
  ChatbubbleEllipsesOutline,
  CheckmarkCircleOutline,
  CreateOutline,
  DocumentTextOutline,
  DownloadOutline,
  LaptopOutline,
  PaperPlaneOutline,
  PeopleOutline,
  RefreshOutline,
  ShieldCheckmarkOutline,
  TimeOutline,
  TrendingUpOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import { postSalesApi } from '@/api/postSales'
import { schoolConfigApi, type CommercialPdfKind } from '@/api/schoolConfig'
import type {
  PostSaleAction,
  PostSaleIntegrationLog,
  PostSaleLifecycleStatus,
  PostSaleOverview,
  PostSaleStudent,
  PostSaleTask,
} from '@/types'

type FilterKey = 'TODOS' | 'RISCO' | PostSaleLifecycleStatus
type PaymentAction = 'MARK_PAID' | 'FAIL' | 'REFUND' | 'PENDING'
type ContractAction = 'SEND' | 'VIEW' | 'SIGN' | 'EXPIRE'
type DocumentAction = 'RECEIVE' | 'APPROVE' | 'REJECT'
type FakeServiceActionItem =
  | { key: string; service: 'payment'; action: PaymentAction; label: string }
  | { key: string; service: 'contract'; action: ContractAction; label: string }
  | { key: string; service: 'document'; action: DocumentAction; label: string }

const router = useRouter()
const overview = ref<PostSaleOverview | null>(null)
const selectedId = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const activeFilter = ref<FilterKey>('TODOS')
const actionBusy = ref<string | null>(null)
const taskTitle = ref('')
const taskOwner = ref('Secretaria')
const taskPriority = ref('Normal')
const taskDueInDays = ref(1)
const messagePreview = ref<string | null>(null)
const pdfBusy = ref<CommercialPdfKind | null>(null)

const filterOptions: Array<{ key: FilterKey; label: string }> = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'DOCUMENTACAO_PENDENTE', label: 'Documentos' },
  { key: 'CONTRATO_PENDENTE', label: 'Contrato' },
  { key: 'PAGAMENTO_PENDENTE', label: 'Pagamento' },
  { key: 'RISCO', label: 'Risco' },
]

const actionOptions: Array<{ action: PostSaleAction; label: string }> = [
  { action: 'DOCUMENTS_RECEIVED', label: 'Documentos recebidos' },
  { action: 'CONTRACT_SENT', label: 'Contrato enviado' },
  { action: 'CONTRACT_SIGNED', label: 'Contrato assinado' },
  { action: 'PAYMENT_PAID', label: 'Pagamento pago' },
  { action: 'ACCESS_RELEASED', label: 'Acesso liberado' },
  { action: 'RISK_RESOLVED', label: 'Risco tratado' },
]

const fakeActionGroups: Array<{ title: string; helper: string; actions: FakeServiceActionItem[] }> =
  [
    {
      title: 'Pagamento fake',
      helper: 'Gateway local',
      actions: [
        { key: 'pay-paid', service: 'payment', action: 'MARK_PAID', label: 'Pago' },
        { key: 'pay-fail', service: 'payment', action: 'FAIL', label: 'Falhou' },
        { key: 'pay-refund', service: 'payment', action: 'REFUND', label: 'Estornado' },
      ],
    },
    {
      title: 'Contrato fake',
      helper: 'Assinatura local',
      actions: [
        { key: 'contract-send', service: 'contract', action: 'SEND', label: 'Enviar' },
        { key: 'contract-view', service: 'contract', action: 'VIEW', label: 'Visualizar' },
        { key: 'contract-sign', service: 'contract', action: 'SIGN', label: 'Assinar' },
      ],
    },
    {
      title: 'Documentos fake',
      helper: 'Checklist local',
      actions: [
        { key: 'doc-receive', service: 'document', action: 'RECEIVE', label: 'Receber' },
        { key: 'doc-approve', service: 'document', action: 'APPROVE', label: 'Aprovar' },
        { key: 'doc-reject', service: 'document', action: 'REJECT', label: 'Recusar' },
      ],
    },
  ]

const commercialMaterials: Array<{
  kind: CommercialPdfKind
  title: string
  helper: string
  filename: string
}> = [
  {
    kind: 'catalogo-cursos',
    title: 'Catálogo',
    helper: 'Cursos e valores',
    filename: 'catalogo-de-cursos.pdf',
  },
  {
    kind: 'tabela-descontos',
    title: 'Descontos',
    helper: 'Campanha à vista',
    filename: 'tabela-de-descontos.pdf',
  },
  {
    kind: 'fluxo-matricula',
    title: 'Matrícula',
    helper: 'Etapas e documentos',
    filename: 'fluxo-de-matricula.pdf',
  },
]

const summaryCards = computed(() => {
  const summary = overview.value?.summary
  return [
    {
      label: 'Alunos em jornada',
      value: summary?.totalStudents ?? 0,
      helper: `${summary?.averageProgress ?? 0}% de avanço médio`,
      icon: PeopleOutline,
      tone: 'brand',
    },
    {
      label: 'Documentos pendentes',
      value: summary?.documentsPending ?? 0,
      helper: 'Solicitação por WhatsApp',
      icon: DocumentTextOutline,
      tone: 'warning',
    },
    {
      label: 'Pagamentos pendentes',
      value: summary?.paymentsPending ?? 0,
      helper: 'Lembretes preventivos',
      icon: CardOutline,
      tone: 'info',
    },
    {
      label: 'Risco de evasão',
      value: summary?.highRisk ?? 0,
      helper: 'Intervenção automática',
      icon: WarningOutline,
      tone: 'danger',
    },
  ]
})

const filteredStudents = computed(() => {
  const students = overview.value?.students ?? []
  if (activeFilter.value === 'TODOS') return students
  if (activeFilter.value === 'RISCO') {
    return students.filter((student) => ['ALTO', 'CRITICO'].includes(student.riskLevel))
  }
  return students.filter((student) => student.status === activeFilter.value)
})

const selectedStudent = computed(() => {
  const students = filteredStudents.value
  return students.find((student) => student.id === selectedId.value) ?? students[0] ?? null
})

const funnelMax = computed(() => {
  const counts = overview.value?.funnel.map((stage) => stage.count) ?? []
  return Math.max(1, ...counts)
})

onMounted(loadOverview)

async function loadOverview() {
  loading.value = true
  error.value = null
  try {
    overview.value = await postSalesApi.overview()
    selectedId.value = overview.value.students[0]?.id ?? null
  } catch {
    error.value = 'Não foi possível carregar o pós-venda agora.'
  } finally {
    loading.value = false
  }
}

function applyOverview(next: PostSaleOverview) {
  overview.value = next
  if (!selectedId.value || !next.students.some((student) => student.id === selectedId.value)) {
    selectedId.value = next.students[0]?.id ?? null
  }
}

function selectStudent(student: PostSaleStudent) {
  selectedId.value = student.id
  messagePreview.value = null
}

async function runAction(action: PostSaleAction) {
  if (!selectedStudent.value || actionBusy.value) return
  actionBusy.value = action
  error.value = null
  messagePreview.value = null
  try {
    applyOverview(await postSalesApi.updateStatus(selectedStudent.value.id, action))
  } catch {
    error.value = 'Não foi possível atualizar o status do aluno.'
  } finally {
    actionBusy.value = null
  }
}

async function createTask() {
  if (!selectedStudent.value || !taskTitle.value.trim() || actionBusy.value) return
  actionBusy.value = 'CREATE_TASK'
  error.value = null
  try {
    applyOverview(
      await postSalesApi.createTask(selectedStudent.value.id, {
        title: taskTitle.value.trim(),
        ownerTeam: taskOwner.value,
        priority: taskPriority.value,
        dueInDays: taskDueInDays.value,
      }),
    )
    taskTitle.value = ''
  } catch {
    error.value = 'Não foi possível criar a tarefa interna.'
  } finally {
    actionBusy.value = null
  }
}

async function generateMessagePreview() {
  if (!selectedStudent.value || actionBusy.value) return
  actionBusy.value = 'SIMULATE_MESSAGE'
  error.value = null
  try {
    const res = await postSalesApi.simulateMessage(selectedStudent.value.id)
    messagePreview.value = res.message
    applyOverview(res.overview)
  } catch {
    error.value = 'Não foi possível gerar a prévia da mensagem agora.'
  } finally {
    actionBusy.value = null
  }
}

function fakeActionKey(item: FakeServiceActionItem) {
  return `FAKE_${item.service}_${item.action}`
}

function rulerActionKey(dayOffset?: number | null) {
  return `RULER_${dayOffset ?? 'NEXT'}`
}

async function runFakeService(item: FakeServiceActionItem) {
  if (!selectedStudent.value || actionBusy.value) return
  actionBusy.value = fakeActionKey(item)
  error.value = null
  messagePreview.value = null
  try {
    const studentId = selectedStudent.value.id
    const response =
      item.service === 'payment'
        ? await postSalesApi.simulatePayment(studentId, item.action)
        : item.service === 'contract'
          ? await postSalesApi.simulateContract(studentId, item.action)
          : await postSalesApi.simulateDocument(studentId, item.action)

    const log = response.result.log as { visibleMessage?: string } | undefined
    messagePreview.value =
      log?.visibleMessage ?? 'Simulação registrada no histórico de integrações.'
    applyOverview(response.overview)
  } catch {
    error.value = 'Não foi possível executar a simulação agora.'
  } finally {
    actionBusy.value = null
  }
}

async function simulateRuler(dayOffset?: number | null) {
  if (!selectedStudent.value || actionBusy.value) return
  actionBusy.value = rulerActionKey(dayOffset)
  error.value = null
  messagePreview.value = null
  try {
    const response = await postSalesApi.simulateRuler(selectedStudent.value.id, dayOffset)
    messagePreview.value = response.result.message
    applyOverview(response.overview)
  } catch {
    error.value = 'Não foi possível simular a régua para este aluno.'
  } finally {
    actionBusy.value = null
  }
}

async function downloadCommercialPdf(material: (typeof commercialMaterials)[number]) {
  if (pdfBusy.value) return
  pdfBusy.value = material.kind
  error.value = null
  try {
    await schoolConfigApi.downloadCommercialPdf(material.kind, material.filename)
  } catch {
    error.value = 'Não foi possível gerar o PDF comercial agora.'
  } finally {
    pdfBusy.value = null
  }
}

function funnelWidth(count: number) {
  return Math.max(4, Math.round((count / funnelMax.value) * 100))
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

function riskLabel(student: PostSaleStudent) {
  if (student.riskLevel === 'CRITICO') return 'Crítico'
  if (student.riskLevel === 'ALTO') return 'Alto'
  if (student.riskLevel === 'MEDIO') return 'Médio'
  return 'Baixo'
}

function rulerStatusLabel(status: PostSaleStudent['ruler']['status']) {
  if (status === 'PENDENTE') return 'Pendente agora'
  if (status === 'CONCLUIDA') return 'Concluída'
  return 'Agendada'
}

function timelineIcon(type: string) {
  if (type.includes('WHATSAPP') || type.includes('REGUA')) return PaperPlaneOutline
  if (type.includes('TASK')) return AddCircleOutline
  if (type.includes('STATUS')) return CreateOutline
  if (type.includes('CONTRATO')) return ShieldCheckmarkOutline
  if (type.includes('FINANCEIRO')) return CardOutline
  if (type.includes('DOCUMENT')) return DocumentTextOutline
  return CalendarOutline
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
    DISPATCH_ALERT: 'Alerta disparado',
    VIEW: 'Contrato visualizado',
    SIGN: 'Contrato assinado',
    EXPIRE: 'Contrato expirado',
    RECEIVE: 'Documento recebido',
    APPROVE: 'Documento aprovado',
    REJECT: 'Documento recusado',
  }
  return labels[action] ?? action
}
</script>

<template>
  <div class="post-page">
    <AppNav />

    <main class="post-shell">
      <header class="post-header">
        <div>
          <h1>Pós-venda do aluno</h1>
          <p>
            Matrícula, documentação, contrato, pagamento, primeiro acesso e permanência em uma
            jornada única.
          </p>
        </div>
        <div class="post-actions">
          <button type="button" class="secondary-action" @click="router.push('/enrollments')">
            <NIcon :component="ShieldCheckmarkOutline" size="16" />
            Matrículas
          </button>
          <button type="button" class="primary-action" :disabled="loading" @click="loadOverview">
            <NIcon :component="RefreshOutline" size="16" />
            Atualizar
          </button>
        </div>
      </header>

      <div v-if="loading" class="loading-state">
        <NSpin size="large" />
      </div>

      <template v-else-if="overview">
        <NAlert v-if="overview.hasDemoData" type="info" class="demo-alert">
          Há alunos de exemplo para mostrar a jornada completa enquanto a base real ganha volume.
        </NAlert>

        <NAlert v-if="error" type="error" closable class="demo-alert" @close="error = null">
          {{ error }}
        </NAlert>

        <section class="commercial-materials" aria-label="Materiais comerciais em PDF">
          <div>
            <span>Materiais comerciais</span>
            <strong>PDFs prontos para enviar ao aluno</strong>
          </div>
          <div class="commercial-materials__actions">
            <button
              v-for="material in commercialMaterials"
              :key="material.kind"
              type="button"
              :disabled="!!pdfBusy"
              @click="downloadCommercialPdf(material)"
            >
              <NIcon :component="DownloadOutline" size="15" />
              <span>
                {{ pdfBusy === material.kind ? 'Gerando...' : material.title }}
                <small>{{ material.helper }}</small>
              </span>
            </button>
          </div>
        </section>

        <section class="summary-grid" aria-label="Resumo do pós-venda">
          <article
            v-for="card in summaryCards"
            :key="card.label"
            class="summary-card"
            :class="`summary-card--${card.tone}`"
          >
            <div class="summary-card__icon">
              <NIcon :component="card.icon" size="20" />
            </div>
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
            <small>{{ card.helper }}</small>
          </article>
        </section>

        <section class="post-layout">
          <div class="main-column">
            <section class="journey-panel">
              <div class="panel-head">
                <div>
                  <h2>Jornada inteligente</h2>
                  <p>Inspirada no fluxo HEDUTEC: dia 0 ao dia 45 com alertas automáticos.</p>
                </div>
                <span>{{ overview.summary.automationsQueued }} mensagens na fila</span>
              </div>

              <div class="funnel-list">
                <div v-for="stage in overview.funnel" :key="stage.key" class="funnel-row">
                  <span class="funnel-row__label">{{ stage.label }}</span>
                  <div class="funnel-row__track">
                    <span
                      :style="{ width: `${funnelWidth(stage.count)}%`, background: stage.color }"
                    ></span>
                  </div>
                  <strong>{{ stage.count }}</strong>
                </div>
              </div>
            </section>

            <section class="students-panel">
              <div class="panel-head panel-head--compact">
                <div>
                  <h2>Alunos em acompanhamento</h2>
                  <p>{{ filteredStudents.length }} registros no filtro atual</p>
                </div>
                <div class="filters" role="tablist" aria-label="Filtrar pós-venda">
                  <button
                    v-for="option in filterOptions"
                    :key="option.key"
                    type="button"
                    :class="{ active: activeFilter === option.key }"
                    role="tab"
                    :aria-selected="activeFilter === option.key"
                    @click="activeFilter = option.key"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <NScrollbar class="students-scroll">
                <div class="student-list">
                  <button
                    v-for="student in filteredStudents"
                    :key="student.id"
                    type="button"
                    class="student-row"
                    :class="{ 'student-row--active': selectedStudent?.id === student.id }"
                    @click="selectStudent(student)"
                  >
                    <span class="student-row__avatar">{{
                      student.studentName.charAt(0).toUpperCase()
                    }}</span>
                    <span class="student-row__main">
                      <strong>
                        {{ student.studentName }}
                        <em v-if="student.isDemo">Exemplo</em>
                      </strong>
                      <small
                        >{{ student.course }} · {{ student.daysSinceEnrollment }} dias de
                        jornada</small
                      >
                    </span>
                    <span class="student-row__progress" aria-label="Progresso do aluno">
                      <i :style="{ width: `${student.progress}%` }"></i>
                    </span>
                    <span
                      class="student-row__status"
                      :class="`status-${student.status.toLowerCase()}`"
                    >
                      {{ student.statusLabel }}
                    </span>
                  </button>

                  <p v-if="!filteredStudents.length" class="empty-note">
                    Nenhum aluno encontrado neste filtro.
                  </p>
                </div>
              </NScrollbar>
            </section>
          </div>

          <aside class="side-column">
            <section
              v-if="selectedStudent"
              class="student-detail"
              aria-label="Detalhe do aluno selecionado"
            >
              <div class="student-detail__head">
                <span>{{ selectedStudent.statusLabel }}</span>
                <h2>{{ selectedStudent.studentName }}</h2>
                <p>{{ selectedStudent.course }}</p>
                <button
                  type="button"
                  class="profile-link"
                  @click="router.push(`/post-sales/students/${selectedStudent.id}`)"
                >
                  Abrir ficha completa
                </button>
              </div>

              <div class="risk-box" :class="`risk-box--${selectedStudent.riskLevel.toLowerCase()}`">
                <div>
                  <span>Score antievasão</span>
                  <strong>{{ selectedStudent.riskScore }}</strong>
                </div>
                <small>{{ riskLabel(selectedStudent) }}</small>
              </div>

              <div class="status-grid">
                <div>
                  <DocumentTextOutline />
                  <span>Documentos</span>
                  <strong>{{ selectedStudent.documentStatus }}</strong>
                </div>
                <div>
                  <ShieldCheckmarkOutline />
                  <span>Contrato</span>
                  <strong>{{ selectedStudent.contractStatus }}</strong>
                </div>
                <div>
                  <CardOutline />
                  <span>Pagamento</span>
                  <strong>{{ selectedStudent.paymentStatus }}</strong>
                </div>
                <div>
                  <LaptopOutline />
                  <span>AVA</span>
                  <strong>{{ selectedStudent.accessStatus }}</strong>
                </div>
              </div>

              <div class="next-action">
                <NIcon :component="TimeOutline" size="18" />
                <div>
                  <span>Próxima ação</span>
                  <strong>{{ selectedStudent.nextAction }}</strong>
                  <small
                    >{{ selectedStudent.ownerTeam }} · vence
                    {{ formatDate(selectedStudent.upcomingDueAt) }}</small
                  >
                </div>
              </div>

              <div
                class="ruler-box"
                :class="`ruler-box--${selectedStudent.ruler.status.toLowerCase()}`"
              >
                <div class="ruler-box__head">
                  <div>
                    <span>Régua automática</span>
                    <strong>{{ rulerStatusLabel(selectedStudent.ruler.status) }}</strong>
                  </div>
                  <small>{{ selectedStudent.ruler.sentCount }} enviados</small>
                </div>
                <div class="ruler-box__next">
                  <span>Próximo marco</span>
                  <strong v-if="selectedStudent.ruler.nextTitle">
                    Dia {{ selectedStudent.ruler.nextDay }} · {{ selectedStudent.ruler.nextTitle }}
                  </strong>
                  <strong v-else>Todos os marcos foram concluídos</strong>
                  <small v-if="selectedStudent.ruler.lastSentAt">
                    Último envio {{ formatDate(selectedStudent.ruler.lastSentAt) }}
                  </small>
                </div>
                <p v-if="selectedStudent.ruler.nextMessage">
                  {{ selectedStudent.ruler.nextMessage }}
                </p>
                <div class="ruler-days" aria-label="Marcos já disparados">
                  <span v-if="!selectedStudent.ruler.sentDays.length"
                    >Nenhum dia disparado ainda</span
                  >
                  <span v-for="day in selectedStudent.ruler.sentDays" :key="day"
                    >Dia {{ day }}</span
                  >
                </div>
                <button
                  type="button"
                  class="ruler-send"
                  :disabled="!!actionBusy || selectedStudent.ruler.status === 'CONCLUIDA'"
                  @click="simulateRuler()"
                >
                  <NIcon :component="PaperPlaneOutline" size="16" />
                  {{
                    actionBusy === rulerActionKey()
                      ? 'Disparando...'
                      : 'Disparar próximo marco fake'
                  }}
                </button>
              </div>

              <div class="ops-block">
                <h3>Ações rápidas</h3>
                <div class="quick-actions">
                  <button
                    v-for="option in actionOptions"
                    :key="option.action"
                    type="button"
                    :disabled="!!actionBusy"
                    @click="runAction(option.action)"
                  >
                    {{ actionBusy === option.action ? 'Salvando...' : option.label }}
                  </button>
                </div>
                <button
                  type="button"
                  class="whatsapp-sim"
                  :disabled="!!actionBusy"
                  @click="generateMessagePreview"
                >
                  <NIcon :component="PaperPlaneOutline" size="16" />
                  {{
                    actionBusy === 'SIMULATE_MESSAGE' ? 'Gerando...' : 'Gerar prévia de WhatsApp'
                  }}
                </button>
                <div class="fake-service-actions">
                  <div
                    v-for="group in fakeActionGroups"
                    :key="group.title"
                    class="fake-service-group"
                  >
                    <div>
                      <strong>{{ group.title }}</strong>
                      <small>{{ group.helper }}</small>
                    </div>
                    <div>
                      <button
                        v-for="item in group.actions"
                        :key="item.key"
                        type="button"
                        :disabled="!!actionBusy"
                        @click="runFakeService(item)"
                      >
                        {{ actionBusy === fakeActionKey(item) ? '...' : item.label }}
                      </button>
                    </div>
                  </div>
                </div>
                <NAlert v-if="messagePreview" type="success" class="message-preview">
                  {{ messagePreview }}
                </NAlert>
              </div>

              <div class="checklist">
                <h3>Checklist de onboarding</h3>
                <div
                  v-for="step in selectedStudent.checklist"
                  :key="step.key"
                  class="check-row"
                  :class="`check-row--${step.status}`"
                >
                  <span>
                    <NIcon
                      :component="step.status === 'done' ? CheckmarkCircleOutline : CalendarOutline"
                      size="16"
                    />
                  </span>
                  <div>
                    <strong>{{ step.label }}</strong>
                    <small>{{ step.helper }}</small>
                  </div>
                </div>
              </div>

              <div class="timeline">
                <h3>Timeline do aluno</h3>
                <div v-for="event in selectedStudent.timeline" :key="event.id" class="timeline-row">
                  <span class="timeline-row__icon">
                    <NIcon :component="timelineIcon(event.type)" size="15" />
                  </span>
                  <div>
                    <strong>{{ event.title }}</strong>
                    <small
                      >{{ formatDate(event.createdAt) }} ·
                      {{ event.source === 'manual' ? 'equipe' : 'sistema' }}</small
                    >
                    <p>{{ event.description }}</p>
                  </div>
                </div>
              </div>
            </section>

            <section v-else class="student-detail student-detail--empty">
              <div class="empty-detail-icon">
                <NIcon :component="TrendingUpOutline" size="24" />
              </div>
              <h2>Nenhum aluno neste filtro</h2>
              <p>
                Quando houver pendência ou risco nesta etapa, a IA mostrará o próximo contato aqui.
              </p>
            </section>

            <section class="tasks-panel">
              <div class="panel-head panel-head--compact">
                <div>
                  <h2>Pendências automáticas</h2>
                  <p>Casos que a IA pode resolver antes de chegar no humano.</p>
                </div>
              </div>

              <div v-if="selectedStudent" class="task-form">
                <label>
                  <span>Nova tarefa interna</span>
                  <input
                    v-model="taskTitle"
                    type="text"
                    placeholder="Ex.: ligar para confirmar documentos"
                  />
                </label>
                <div class="task-form__row">
                  <label>
                    <span>Equipe</span>
                    <select v-model="taskOwner">
                      <option>Secretaria</option>
                      <option>Financeiro</option>
                      <option>Suporte AVA</option>
                      <option>Retenção</option>
                      <option>Sucesso do Aluno</option>
                    </select>
                  </label>
                  <label>
                    <span>Prioridade</span>
                    <select v-model="taskPriority">
                      <option>Normal</option>
                      <option>Alta</option>
                      <option>Urgente</option>
                    </select>
                  </label>
                  <label>
                    <span>Prazo</span>
                    <select v-model.number="taskDueInDays">
                      <option :value="0">Hoje</option>
                      <option :value="1">1 dia</option>
                      <option :value="3">3 dias</option>
                      <option :value="5">5 dias</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  :disabled="!taskTitle.trim() || !!actionBusy"
                  @click="createTask"
                >
                  <NIcon :component="AddCircleOutline" size="15" />
                  {{ actionBusy === 'CREATE_TASK' ? 'Criando...' : 'Criar tarefa' }}
                </button>
              </div>

              <div class="task-list">
                <div v-for="task in overview.tasks" :key="task.id" class="task-row">
                  <span :class="{ urgent: task.priority !== 'Normal' }">{{ task.priority }}</span>
                  <strong>{{ task.title }}</strong>
                  <small
                    >{{ task.studentName }} · {{ task.ownerTeam }} ·
                    {{ taskAutomationLabel(task) }}</small
                  >
                </div>
              </div>
            </section>
          </aside>
        </section>

        <section class="automation-section">
          <div class="panel-head">
            <div>
              <h2>Automações preparadas</h2>
              <p>
                Fluxos prontos para WhatsApp, contrato digital, financeiro e AVA conforme as
                integrações forem conectadas.
              </p>
            </div>
          </div>

          <div class="automation-grid">
            <article
              v-for="automation in overview.automations"
              :key="automation.title"
              class="automation-card"
            >
              <div class="automation-card__top">
                <span>Dia {{ automation.day }}</span>
                <strong>{{ automation.status }}</strong>
              </div>
              <h3>{{ automation.title }}</h3>
              <p>{{ automation.message }}</p>
              <div class="automation-card__metrics">
                <span>{{ automation.pendingCount }} pendentes</span>
                <span>{{ automation.scheduledCount }} agendados</span>
                <span>{{ automation.sentCount }} enviados</span>
              </div>
              <div class="automation-card__footer">
                <small>{{ automation.channel }} · {{ automation.trigger }}</small>
                <button
                  type="button"
                  :disabled="!selectedStudent || !!actionBusy"
                  @click="simulateRuler(automation.day)"
                >
                  {{ actionBusy === rulerActionKey(automation.day) ? '...' : 'Simular no aluno' }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="logs-section">
          <div class="panel-head">
            <div>
              <h2>Logs dos serviços fake</h2>
              <p>
                Histórico local de WhatsApp, pagamento, contrato e documentos para demonstrar
                integrações sem API real.
              </p>
            </div>
            <span>{{ overview.integrationLogs.length }} eventos</span>
          </div>

          <div v-if="overview.integrationLogs.length" class="log-list">
            <article v-for="log in overview.integrationLogs" :key="log.id" class="log-row">
              <div class="log-row__top">
                <span>{{ serviceLabel(log) }}</span>
                <strong>{{ log.status }}</strong>
              </div>
              <h3>{{ actionLabel(log.action) }}</h3>
              <p>{{ log.visibleMessage }}</p>
              <small>{{ log.studentName || 'Aluno' }} · {{ formatDate(log.createdAt) }}</small>
            </article>
          </div>

          <div v-else class="logs-empty">
            <NIcon :component="PaperPlaneOutline" size="22" />
            <strong>Nenhum serviço fake acionado ainda</strong>
            <p>Use os botões no detalhe do aluno para registrar eventos de demonstração.</p>
          </div>
        </section>

        <section class="templates-section">
          <div class="panel-head">
            <div>
              <h2>Mensagens humanizadas</h2>
              <p>Modelos para a IA adaptar ao tom do aluno, sem parecer robô.</p>
            </div>
          </div>

          <div class="template-list">
            <article
              v-for="template in overview.messageTemplates"
              :key="template.title"
              class="template-row"
            >
              <NIcon :component="ChatbubbleEllipsesOutline" size="18" />
              <div>
                <strong>{{ template.title }}</strong>
                <p>{{ template.text }}</p>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.post-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--app-bg);
}

.post-shell {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px 28px;
}

.post-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.post-header h1 {
  margin: 0;
  color: var(--text);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 0;
}

.post-header p {
  max-width: 760px;
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

.post-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-action,
.secondary-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  border: 1px solid var(--border);
}

.primary-action {
  color: #fff;
  background: var(--brand);
  border-color: var(--brand);
}

.primary-action:disabled {
  opacity: 0.55;
  cursor: wait;
}

.secondary-action {
  color: var(--text-soft);
  background: var(--surface-raised);
}

.loading-state {
  min-height: 360px;
  display: grid;
  place-items: center;
}

.demo-alert {
  margin-bottom: 14px;
}

.commercial-materials {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
}

.commercial-materials > div:first-child span,
.commercial-materials__actions small {
  display: block;
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.commercial-materials > div:first-child strong {
  display: block;
  margin-top: 4px;
  color: var(--text);
  font-size: 15px;
  font-weight: 900;
}

.commercial-materials__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.commercial-materials__actions button {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--text-soft);
  background: var(--surface);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.commercial-materials__actions button:hover {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 34%, var(--border));
  background: var(--brand-soft);
}

.commercial-materials__actions button:disabled {
  opacity: 0.58;
  cursor: wait;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  position: relative;
  min-height: 142px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}

.summary-card::after {
  content: '';
  position: absolute;
  inset: auto 12px 0 12px;
  height: 3px;
  border-radius: 999px 999px 0 0;
  background: var(--brand);
}

.summary-card--warning::after {
  background: var(--warning);
}
.summary-card--info::after {
  background: var(--info);
}
.summary-card--danger::after {
  background: var(--danger);
}

.summary-card__icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--brand);
  background: var(--brand-soft);
}

.summary-card--warning .summary-card__icon {
  color: var(--warning);
  background: var(--warning-soft);
}

.summary-card--info .summary-card__icon {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 12%, transparent);
}

.summary-card--danger .summary-card__icon {
  color: var(--danger);
  background: var(--danger-soft);
}

.summary-card span,
.summary-card small {
  display: block;
}

.summary-card span {
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.summary-card strong {
  display: block;
  margin-top: 5px;
  color: var(--text);
  font-size: 34px;
  font-weight: 900;
  line-height: 1;
}

.summary-card small {
  margin-top: 7px;
  color: var(--muted);
  font-size: 12px;
}

.post-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(360px, 0.85fr);
  gap: 16px;
  align-items: start;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.journey-panel,
.students-panel,
.student-detail,
.tasks-panel,
.automation-section,
.templates-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
}

.journey-panel,
.students-panel,
.tasks-panel,
.automation-section,
.templates-section {
  padding: 18px;
}

.student-detail {
  padding: 18px;
}

.student-detail--empty {
  min-height: 260px;
  display: grid;
  place-items: center;
  align-content: center;
  text-align: center;
}

.student-detail--empty h2 {
  margin: 12px 0 5px;
  color: var(--text);
  font-size: 18px;
  font-weight: 900;
}

.student-detail--empty p {
  max-width: 280px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

.empty-detail-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--brand);
  background: var(--brand-soft);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.panel-head--compact {
  margin-bottom: 12px;
}

.panel-head h2 {
  margin: 0;
  color: var(--text);
  font-size: 16px;
  font-weight: 900;
}

.panel-head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.panel-head > span {
  padding: 6px 10px;
  border-radius: 999px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.funnel-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.funnel-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 10px;
}

.funnel-row__label {
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 800;
  text-align: right;
}

.funnel-row__track {
  height: 22px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
}

.funnel-row__track span {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.funnel-row strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.filters button {
  min-height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 9px;
  color: var(--muted-strong);
  background: var(--surface);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.filters button.active {
  color: var(--brand);
  background: var(--brand-soft);
  border-color: color-mix(in srgb, var(--brand) 32%, var(--border));
}

.students-scroll {
  max-height: 430px;
}

.student-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.student-row {
  width: 100%;
  display: grid;
  grid-template-columns: 38px minmax(160px, 1fr) minmax(110px, 160px) minmax(150px, max-content);
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  color: var(--text);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    transform 0.15s ease;
}

.student-row:hover,
.student-row--active {
  border-color: color-mix(in srgb, var(--brand) 45%, var(--border));
  background: var(--brand-soft);
}

.student-row:hover {
  transform: translateY(-1px);
}

.student-row__avatar {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #fff;
  background: var(--brand);
  font-size: 12px;
  font-weight: 900;
}

.student-row__main {
  min-width: 0;
}

.student-row__main strong,
.student-row__main small {
  display: block;
}

.student-row__main strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.student-row__main em {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 5px;
  border-radius: 999px;
  color: var(--info);
  background: color-mix(in srgb, var(--info) 12%, transparent);
  font-size: 9px;
  font-style: normal;
  font-weight: 900;
  vertical-align: middle;
}

.student-row__main small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}

.student-row__progress {
  height: 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
}

.student-row__progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--brand), var(--accent-strong));
}

.student-row__status {
  justify-self: end;
  border-radius: 999px;
  padding: 5px 8px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.status-documentacao_pendente,
.status-contrato_pendente {
  color: var(--warning);
  background: var(--warning-soft);
}

.status-pagamento_pendente,
.status-risco_evasao {
  color: var(--danger);
  background: var(--danger-soft);
}

.empty-note {
  padding: 16px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.student-detail__head {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
}

.student-detail__head span {
  color: var(--brand);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.student-detail__head h2 {
  margin: 5px 0 4px;
  color: var(--text);
  font-size: 22px;
  font-weight: 900;
}

.student-detail__head p {
  color: var(--muted);
  font-size: 13px;
}

.profile-link {
  min-height: 34px;
  margin-top: 10px;
  border: 1px solid var(--brand);
  border-radius: 8px;
  padding: 7px 10px;
  color: #fff;
  background: var(--brand);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.profile-link:hover {
  background: var(--brand-strong);
}

.risk-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 0;
  padding: 13px;
  border-radius: 8px;
  background: var(--brand-soft);
  border: 1px solid color-mix(in srgb, var(--brand) 22%, var(--border));
}

.risk-box--medio {
  color: var(--warning);
  background: var(--warning-soft);
  border-color: color-mix(in srgb, var(--warning) 30%, var(--border));
}

.risk-box--alto,
.risk-box--critico {
  color: var(--danger);
  background: var(--danger-soft);
  border-color: color-mix(in srgb, var(--danger) 28%, var(--border));
}

.risk-box span,
.risk-box small {
  display: block;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.risk-box strong {
  display: block;
  color: var(--text);
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
  margin-top: 3px;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.status-grid div {
  min-height: 92px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  background: var(--surface);
}

.status-grid svg {
  width: 17px;
  height: 17px;
  color: var(--brand);
}

.status-grid span,
.status-grid strong {
  display: block;
}

.status-grid span {
  margin-top: 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.status-grid strong {
  margin-top: 3px;
  color: var(--text);
  font-size: 12px;
  line-height: 1.35;
}

.next-action {
  display: flex;
  gap: 11px;
  margin: 14px 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.next-action > .n-icon {
  flex-shrink: 0;
  color: var(--brand);
  margin-top: 2px;
}

.next-action span,
.next-action small,
.next-action strong {
  display: block;
}

.next-action span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.next-action strong {
  margin-top: 3px;
  color: var(--text);
  font-size: 13px;
}

.next-action small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}

.ops-block {
  margin: 14px 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.ops-block h3,
.timeline h3 {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.quick-actions button,
.whatsapp-sim,
.fake-service-group button,
.task-form button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 9px;
  color: var(--text-soft);
  background: var(--surface-soft);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.quick-actions button:hover,
.whatsapp-sim:hover,
.fake-service-group button:hover,
.task-form button:hover {
  border-color: color-mix(in srgb, var(--brand) 38%, var(--border));
  background: var(--brand-soft);
  color: var(--brand);
}

.quick-actions button:disabled,
.whatsapp-sim:disabled,
.fake-service-group button:disabled,
.task-form button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.whatsapp-sim {
  width: 100%;
  margin-top: 8px;
  color: #fff;
  background: var(--brand);
  border-color: var(--brand);
}

.whatsapp-sim:hover {
  color: #fff;
  background: var(--brand-strong);
}

.message-preview {
  margin-top: 10px;
}

.ruler-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--brand) 28%, var(--border));
  border-radius: 8px;
  background: linear-gradient(135deg, var(--surface), var(--brand-soft));
}

.ruler-box--pendente {
  border-color: color-mix(in srgb, var(--warning) 36%, var(--border));
  background: linear-gradient(135deg, var(--surface), var(--warning-soft));
}

.ruler-box--concluida {
  border-color: color-mix(in srgb, var(--accent-strong) 32%, var(--border));
  background: linear-gradient(
    135deg,
    var(--surface),
    color-mix(in srgb, var(--accent-strong) 10%, transparent)
  );
}

.ruler-box__head,
.ruler-box__next {
  min-width: 0;
}

.ruler-box__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.ruler-box__head span,
.ruler-box__next span {
  display: block;
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.ruler-box__head strong,
.ruler-box__next strong {
  display: block;
  margin-top: 3px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.35;
}

.ruler-box__head small {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--brand);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 10px;
  font-weight: 900;
}

.ruler-box__next small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}

.ruler-box p {
  margin: 0;
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.45;
}

.ruler-days {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ruler-days span {
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--muted-strong);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 10px;
  font-weight: 900;
}

.ruler-send {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--brand);
  border-radius: 8px;
  padding: 8px 10px;
  color: #fff;
  background: var(--brand);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.ruler-send:hover {
  background: var(--brand-strong);
}

.ruler-send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.fake-service-actions {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.fake-service-group {
  display: grid;
  grid-template-columns: minmax(96px, 0.7fr) minmax(0, 1.3fr);
  gap: 8px;
  align-items: center;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.fake-service-group strong,
.fake-service-group small {
  display: block;
}

.fake-service-group strong {
  color: var(--text);
  font-size: 11px;
  font-weight: 900;
}

.fake-service-group small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.fake-service-group > div:last-child {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.fake-service-group button {
  min-height: 30px;
  padding: 6px;
  font-size: 10px;
}

.checklist h3 {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
}

.check-row {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.check-row > span {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 999px;
  color: var(--muted);
  background: var(--surface-muted);
}

.check-row--done > span {
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent-strong) 12%, transparent);
}

.check-row--attention > span {
  color: var(--danger);
  background: var(--danger-soft);
}

.check-row strong,
.check-row small {
  display: block;
}

.check-row strong {
  color: var(--text);
  font-size: 12px;
}

.check-row small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
}

.timeline {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.timeline-row {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--border);
}

.timeline-row__icon {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 999px;
  color: var(--brand);
  background: var(--brand-soft);
}

.timeline-row strong,
.timeline-row small,
.timeline-row p {
  display: block;
}

.timeline-row strong {
  color: var(--text);
  font-size: 12px;
}

.timeline-row small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}

.timeline-row p {
  margin: 4px 0 0;
  color: var(--muted-strong);
  font-size: 11px;
  line-height: 1.4;
}

.task-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 11px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.task-form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.task-form span {
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 900;
}

.task-form input,
.task-form select {
  width: 100%;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 9px;
  color: var(--text);
  background: var(--input-bg);
  font-size: 12px;
}

.task-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr 86px;
  gap: 7px;
}

.task-form button {
  color: #fff;
  background: var(--brand);
  border-color: var(--brand);
}

.task-form button:disabled {
  cursor: not-allowed;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-row {
  padding: 11px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.task-row span {
  display: inline-block;
  margin-bottom: 7px;
  padding: 3px 7px;
  border-radius: 999px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 10px;
  font-weight: 900;
}

.task-row span.urgent {
  color: var(--danger);
  background: var(--danger-soft);
}

.task-row strong,
.task-row small {
  display: block;
}

.task-row strong {
  color: var(--text);
  font-size: 13px;
}

.task-row small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.4;
}

.automation-section,
.logs-section,
.templates-section {
  margin-top: 16px;
}

.automation-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.automation-card {
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.automation-card__top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.automation-card__top span,
.automation-card__top strong {
  color: var(--brand);
  font-size: 11px;
  font-weight: 900;
}

.automation-card h3 {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
}

.automation-card p {
  margin: 7px 0;
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.45;
}

.automation-card small {
  color: var(--muted);
  font-size: 11px;
}

.automation-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 10px 0;
}

.automation-card__metrics span {
  min-height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted-strong);
  background: var(--surface-soft);
  font-size: 10px;
  font-weight: 900;
  text-align: center;
}

.automation-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.automation-card__footer button {
  min-height: 32px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 9px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
}

.automation-card__footer button:hover {
  border-color: color-mix(in srgb, var(--brand) 36%, var(--border));
  background: color-mix(in srgb, var(--brand) 14%, transparent);
}

.automation-card__footer button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.log-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.log-row {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.log-row__top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.log-row__top span,
.log-row__top strong {
  min-width: 0;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.log-row__top span {
  color: var(--brand);
  background: var(--brand-soft);
}

.log-row__top strong {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 12%, transparent);
}

.log-row h3 {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.log-row p {
  margin: 6px 0;
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.4;
}

.log-row small {
  color: var(--muted);
  font-size: 11px;
}

.logs-empty {
  min-height: 150px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--muted);
  background: var(--surface);
  text-align: center;
}

.logs-empty > .n-icon {
  color: var(--brand);
}

.logs-empty strong {
  color: var(--text);
  font-size: 14px;
}

.logs-empty p {
  margin: 0;
  max-width: 360px;
  font-size: 12px;
  line-height: 1.4;
}

.template-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.template-row {
  display: flex;
  gap: 11px;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.template-row > .n-icon {
  flex-shrink: 0;
  color: var(--brand);
  margin-top: 2px;
}

.template-row strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.template-row p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 1180px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .post-layout,
  .automation-grid,
  .log-list,
  .template-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .post-shell {
    padding: 14px;
  }

  .post-header,
  .panel-head,
  .commercial-materials {
    flex-direction: column;
    align-items: stretch;
  }

  .post-actions,
  .filters,
  .commercial-materials__actions {
    width: 100%;
    justify-content: flex-start;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .student-row {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .student-row__progress,
  .student-row__status {
    grid-column: 2;
    justify-self: stretch;
  }

  .quick-actions,
  .fake-service-group,
  .fake-service-group > div:last-child,
  .automation-card__metrics,
  .task-form__row {
    grid-template-columns: 1fr;
  }

  .funnel-row {
    grid-template-columns: 92px minmax(0, 1fr) 28px;
  }
}
</style>
