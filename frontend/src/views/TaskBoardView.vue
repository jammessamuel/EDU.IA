<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NSpin } from 'naive-ui'
import {
  AddCircleOutline,
  AlertCircleOutline,
  AlarmOutline,
  ArrowForwardOutline,
  CalendarOutline,
  CardOutline,
  CheckmarkDoneOutline,
  CloseOutline,
  DocumentTextOutline,
  FlashOutline,
  FunnelOutline,
  MegaphoneOutline,
  NotificationsOutline,
  OpenOutline,
  PersonCircleOutline,
  RadioOutline,
  SearchOutline,
  SendOutline,
  TimeOutline,
  VolumeHighOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import { postSalesApi } from '@/api/postSales'
import type {
  PostSaleAlert,
  PostSaleIntegrationLog,
  PostSaleOverview,
  PostSaleStudent,
  PostSaleTask,
} from '@/types'

type BoardColumn =
  | 'a_fazer'
  | 'em_andamento'
  | 'aguardando_aluno'
  | 'aguardando_financeiro'
  | 'concluido'

interface BoardColumnMeta {
  key: BoardColumn
  title: string
  helper: string
}

const router = useRouter()
const overview = ref<PostSaleOverview | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selectedTaskId = ref<string | null>(null)
const draggedTaskId = ref<string | null>(null)
const updatingTaskId = ref<string | null>(null)
const createTaskOpen = ref(false)
const creatingTask = ref(false)
const createTaskError = ref<string | null>(null)
const alertsPanelOpen = ref(false)
const dispatchingAlertId = ref<string | null>(null)
const alertFeedback = ref<string | null>(null)
const soundEnabled = ref(localStorage.getItem('eduia_alert_sound') === 'on')
const notificationEnabled = ref(
  typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted',
)
const silencedAlertIds = ref<Set<string>>(new Set())
const seenAlertIds = ref<Set<string>>(new Set())
const search = ref('')
const roleFilter = ref('todos')
const priorityFilter = ref('todas')
const originFilter = ref('todas')
const courseFilter = ref('todos')

interface CreateTaskForm {
  title: string
  description: string
  studentKey: string
  assignee: string
  role: string
  priority: string
  dueAt: string
  reminderDaysBefore: '' | '1' | '2'
}

const roleChoices = [
  { value: 'comercial', label: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'sucesso_do_aluno', label: 'Sucesso do aluno' },
  { value: 'gestor', label: 'Gestor' },
]

const priorityChoices = ['Urgente', 'Alta', 'Média', 'Normal']
const employeeSuggestions = [
  'Amanda - Comercial',
  'Bruno - Financeiro',
  'Camila - Secretaria',
  'Diego - Sucesso do aluno',
  'Gestor responsável',
]

const createForm = ref<CreateTaskForm>(defaultCreateTaskForm())
let alertAudioContext: AudioContext | null = null
let alertFeedbackTimer: number | null = null

const columns: BoardColumnMeta[] = [
  { key: 'a_fazer', title: 'A fazer', helper: 'Entrada da automação e triagem da equipe.' },
  { key: 'em_andamento', title: 'Em andamento', helper: 'Alguém já assumiu e está resolvendo.' },
  {
    key: 'aguardando_aluno',
    title: 'Aguardando aluno',
    helper: 'Precisa de documento, resposta ou confirmação.',
  },
  {
    key: 'aguardando_financeiro',
    title: 'Aguardando financeiro',
    helper: 'Pagamento, estorno ou baixa manual.',
  },
  { key: 'concluido', title: 'Concluído', helper: 'Tarefas resolvidas e auditáveis.' },
]

const tasks = computed(() => overview.value?.tasks ?? [])
const students = computed(() => overview.value?.students ?? [])
const alerts = computed(() => overview.value?.alerts ?? [])
const activeAlerts = computed(() =>
  alerts.value.filter((alert) => !silencedAlertIds.value.has(alert.id)),
)
const alertDispatches = computed(() =>
  (overview.value?.alertDispatches?.length
    ? overview.value.alertDispatches
    : (overview.value?.integrationLogs ?? []).filter((log) => log.service === 'ALERTAS')
  ).slice(0, 8),
)
const studentById = computed(() => new Map(students.value.map((student) => [student.id, student])))

const selectedTask = computed(
  () => tasks.value.find((task) => task.id === selectedTaskId.value) ?? null,
)
const selectedStudent = computed(() => {
  const task = selectedTask.value
  return task?.studentId ? (studentById.value.get(task.studentId) ?? null) : null
})

const roleOptions = computed(() =>
  optionList(
    tasks.value.map((task) => task.role || task.ownerTeam),
    'todos',
  ),
)
const priorityOptions = computed(() =>
  optionList(
    tasks.value.map((task) => task.priority),
    'todas',
  ),
)
const originOptions = computed(() =>
  optionList(
    tasks.value.map((task) => task.origin || 'manual'),
    'todas',
  ),
)
const courseOptions = computed(() =>
  optionList(
    students.value.map((student) => student.course),
    'todos',
  ),
)

const filteredTasks = computed(() => {
  const query = normalize(search.value)
  return tasks.value.filter((task) => {
    const student = task.studentId ? studentById.value.get(task.studentId) : null
    const haystack = normalize(
      [
        task.title,
        task.studentName,
        task.ownerTeam,
        task.assignee,
        task.priority,
        task.origin,
        student?.course,
      ].join(' '),
    )
    if (query && !haystack.includes(query)) return false
    if (
      roleFilter.value !== 'todos' &&
      normalize(task.role || task.ownerTeam) !== normalize(roleFilter.value)
    )
      return false
    if (
      priorityFilter.value !== 'todas' &&
      normalize(task.priority) !== normalize(priorityFilter.value)
    )
      return false
    if (
      originFilter.value !== 'todas' &&
      normalize(task.origin || 'manual') !== normalize(originFilter.value)
    )
      return false
    if (
      courseFilter.value !== 'todos' &&
      normalize(student?.course ?? '') !== normalize(courseFilter.value)
    )
      return false
    return true
  })
})

const boardTasks = computed(() => {
  const grouped = new Map<BoardColumn, PostSaleTask[]>()
  for (const column of columns) grouped.set(column.key, [])

  for (const task of filteredTasks.value) {
    const key = toColumn(task.column)
    grouped.get(key)?.push(task)
  }

  for (const [key, items] of grouped.entries()) {
    grouped.set(
      key,
      [...items].sort(
        (a, b) =>
          priorityWeight(a.priority) - priorityWeight(b.priority) || dueTime(a) - dueTime(b),
      ),
    )
  }

  return grouped
})

const boardStats = computed(() => {
  const open = tasks.value.filter((task) => task.status !== 'CONCLUIDA')
  const overdue = open.filter((task) => dueTime(task) < Date.now()).length
  const alarm24 = open.filter((task) => alarmState(task) === '24h').length
  const alarm48 = open.filter((task) => alarmState(task) === '48h').length
  return {
    total: tasks.value.length,
    open: open.length,
    overdue,
    alerts: activeAlerts.value.length,
    alarm24,
    alarm48,
    high: open.filter((task) => priorityWeight(task.priority) <= 2).length,
    auto: open.filter((task) => task.createdBy === 'automacao' || task.source === 'automatic')
      .length,
  }
})

const alertStats = computed(() => ({
  total: activeAlerts.value.length,
  late: activeAlerts.value.filter((alert) => alert.level === 'VENCIDA').length,
  critical: activeAlerts.value.filter((alert) => alert.level === 'CRITICO').length,
  next24: activeAlerts.value.filter((alert) => alert.level === '24H').length,
  next48: activeAlerts.value.filter((alert) => alert.level === '48H').length,
}))

const topAlert = computed(
  () =>
    [...activeAlerts.value].sort(
      (a, b) =>
        alertWeight(a.level) - alertWeight(b.level) ||
        new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    )[0] ?? null,
)

const activeFilterCount = computed(
  () =>
    Number(Boolean(search.value.trim())) +
    Number(roleFilter.value !== 'todos') +
    Number(priorityFilter.value !== 'todas') +
    Number(originFilter.value !== 'todas') +
    Number(courseFilter.value !== 'todos'),
)

async function loadBoard() {
  loading.value = true
  error.value = null
  try {
    overview.value = await postSalesApi.overview()
  } catch {
    error.value = 'Não foi possível carregar o quadro operacional agora.'
  } finally {
    loading.value = false
  }
}

function openAlertCenter() {
  selectedTaskId.value = null
  alertsPanelOpen.value = true
}

function closeAlertCenter() {
  alertsPanelOpen.value = false
}

function setAlertFeedback(message: string) {
  alertFeedback.value = message
  if (alertFeedbackTimer) window.clearTimeout(alertFeedbackTimer)
  alertFeedbackTimer = window.setTimeout(() => {
    alertFeedback.value = null
  }, 4200)
}

async function enableAlertSound() {
  soundEnabled.value = true
  localStorage.setItem('eduia_alert_sound', 'on')
  await playAlertSound('CRITICO')
  setAlertFeedback('Som de alerta ativado neste navegador.')
}

function disableAlertSound() {
  soundEnabled.value = false
  localStorage.setItem('eduia_alert_sound', 'off')
  setAlertFeedback('Som de alerta desativado.')
}

async function enableBrowserNotifications() {
  if (!('Notification' in window)) {
    setAlertFeedback('Este navegador não suporta notificação local.')
    return
  }

  const permission = await Notification.requestPermission()
  notificationEnabled.value = permission === 'granted'
  setAlertFeedback(
    permission === 'granted'
      ? 'Notificação do navegador ativada.'
      : 'Notificação não foi liberada no navegador.',
  )
}

async function testAlertSignal() {
  await playAlertSound('CRITICO')
  if (
    notificationEnabled.value &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    new Notification('EDU.IA - alerta de teste', {
      body: 'Som e notificação estão prontos para os prazos críticos.',
      tag: 'eduia-alert-test',
    })
  }
  setAlertFeedback('Teste de alerta executado.')
}

async function dispatchAlert(alert: PostSaleAlert) {
  if (dispatchingAlertId.value) return
  dispatchingAlertId.value = alert.id
  try {
    const response = await postSalesApi.dispatchAlert(alert.taskId)
    overview.value = response.overview
    if (soundEnabled.value) void playAlertSound(alert.level)
    setAlertFeedback('Disparo fake registrado na central e no histórico.')
  } catch {
    error.value = 'Não foi possível disparar o alerta fake.'
  } finally {
    dispatchingAlertId.value = null
  }
}

function openAlertTask(alert: PostSaleAlert) {
  const task = tasks.value.find((item) => item.id === alert.taskId)
  if (task) {
    selectedTaskId.value = task.id
    alertsPanelOpen.value = false
  }
}

function silenceAlert(alert: PostSaleAlert) {
  const next = new Set(silencedAlertIds.value)
  next.add(alert.id)
  silencedAlertIds.value = next
  setAlertFeedback('Alerta silenciado nesta sessão.')
}

async function playAlertSound(level: PostSaleAlert['level']) {
  if (typeof window === 'undefined') return
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  alertAudioContext ??= new AudioContextClass()
  if (alertAudioContext.state === 'suspended') await alertAudioContext.resume()

  const frequencies = level === 'VENCIDA' || level === 'CRITICO' ? [880, 660, 880] : [620, 520]
  const now = alertAudioContext.currentTime
  frequencies.forEach((frequency, index) => {
    const oscillator = alertAudioContext?.createOscillator()
    const gain = alertAudioContext?.createGain()
    if (!oscillator || !gain || !alertAudioContext) return
    oscillator.type = level === 'VENCIDA' ? 'square' : 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, now + index * 0.16)
    gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.16 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.16 + 0.13)
    oscillator.connect(gain)
    gain.connect(alertAudioContext.destination)
    oscillator.start(now + index * 0.16)
    oscillator.stop(now + index * 0.16 + 0.14)
  })
}

function notifyAlert(alert: PostSaleAlert) {
  if (!notificationEnabled.value || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  new Notification(`EDU.IA - ${alertLevelLabel(alert.level)}`, {
    body: alert.message,
    tag: alert.id,
  })
}

async function moveTask(task: PostSaleTask, column: BoardColumn) {
  if (updatingTaskId.value) return
  updatingTaskId.value = task.id
  try {
    overview.value = await postSalesApi.updateTask(task.id, {
      column,
      status: column === 'concluido' ? 'CONCLUIDA' : 'ABERTA',
    })
    if (
      selectedTaskId.value === task.id &&
      !overview.value.tasks.some((item) => item.id === task.id)
    ) {
      selectedTaskId.value = null
    }
  } catch {
    error.value = 'Não foi possível mover a tarefa.'
  } finally {
    updatingTaskId.value = null
  }
}

function openCreateTask() {
  createForm.value = defaultCreateTaskForm()
  createTaskError.value = null
  createTaskOpen.value = true
}

function closeCreateTask() {
  if (creatingTask.value) return
  createTaskOpen.value = false
  createTaskError.value = null
}

async function submitCreateTask() {
  if (creatingTask.value) return
  createTaskError.value = null

  const title = createForm.value.title.trim()
  const assignee = createForm.value.assignee.trim()
  if (!title) {
    createTaskError.value = 'Informe o título da tarefa.'
    return
  }
  if (!assignee) {
    createTaskError.value = 'Informe o funcionário responsável.'
    return
  }
  if (!createForm.value.dueAt) {
    createTaskError.value = 'Informe o prazo com data, hora e minutos.'
    return
  }

  const dueAt = new Date(createForm.value.dueAt)
  if (Number.isNaN(dueAt.getTime())) {
    createTaskError.value = 'Informe uma data e hora de prazo válidas.'
    return
  }

  creatingTask.value = true
  try {
    overview.value = await postSalesApi.createManualTask({
      title,
      description: createForm.value.description.trim() || undefined,
      studentKey: createForm.value.studentKey || null,
      assignee,
      role: createForm.value.role,
      priority: createForm.value.priority,
      ownerTeam: roleLabel(createForm.value.role),
      dueAt: dueAt.toISOString(),
      column: 'a_fazer',
      origin: 'manual',
      reminderDaysBefore: createForm.value.reminderDaysBefore
        ? Number(createForm.value.reminderDaysBefore)
        : null,
    })
    createTaskOpen.value = false
    createForm.value = defaultCreateTaskForm()
  } catch {
    createTaskError.value = 'Não foi possível criar a tarefa agora.'
  } finally {
    creatingTask.value = false
  }
}

function startDrag(event: DragEvent, task: PostSaleTask) {
  draggedTaskId.value = task.id
  event.dataTransfer?.setData('text/plain', task.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function endDrag() {
  draggedTaskId.value = null
}

async function dropTask(event: DragEvent, column: BoardColumn) {
  const taskId = event.dataTransfer?.getData('text/plain') || draggedTaskId.value
  const task = tasks.value.find((item) => item.id === taskId)
  if (!task) return
  await moveTask(task, column)
  draggedTaskId.value = null
}

function selectTask(task: PostSaleTask) {
  selectedTaskId.value = task.id
}

function closeDrawer() {
  selectedTaskId.value = null
}

function clearFilters() {
  search.value = ''
  roleFilter.value = 'todos'
  priorityFilter.value = 'todas'
  originFilter.value = 'todas'
  courseFilter.value = 'todos'
}

function openStudent(task: PostSaleTask | null) {
  if (!task) return
  if (task.studentId) {
    router.push(`/post-sales/students/${task.studentId}`)
    return
  }
  router.push('/kanban')
}

async function quickAction(action: 'message' | 'payment' | 'contract' | 'document') {
  const task = selectedTask.value
  if (!task?.studentId || updatingTaskId.value) return
  updatingTaskId.value = task.id
  try {
    if (action === 'message') {
      const response = await postSalesApi.simulateMessage(task.studentId)
      overview.value = response.overview
    }
    if (action === 'payment') {
      const response = await postSalesApi.simulatePayment(task.studentId, 'MARK_PAID')
      overview.value = response.overview
    }
    if (action === 'contract') {
      const response = await postSalesApi.simulateContract(task.studentId, 'SIGN')
      overview.value = response.overview
    }
    if (action === 'document') {
      const response = await postSalesApi.simulateDocument(task.studentId, 'APPROVE', {
        documentType: 'Pacote de matrícula',
      })
      overview.value = response.overview
    }
  } catch {
    error.value = 'Não foi possível executar a ação rápida.'
  } finally {
    updatingTaskId.value = null
  }
}

function taskChecklist(task: PostSaleTask, student: PostSaleStudent | null) {
  if (student?.checklist?.length) {
    return {
      done: student.checklist.filter((step) => step.status === 'done').length,
      total: student.checklist.length,
    }
  }

  return {
    done: task.status === 'CONCLUIDA' ? 1 : task.column === 'em_andamento' ? 1 : 0,
    total: task.leadId ? 2 : 3,
  }
}

function taskStudent(task: PostSaleTask) {
  return task.studentId ? (studentById.value.get(task.studentId) ?? null) : null
}

function toColumn(value?: string): BoardColumn {
  return columns.some((column) => column.key === value) ? (value as BoardColumn) : 'a_fazer'
}

function nextColumn(column?: string): BoardColumn {
  const current = toColumn(column)
  const index = columns.findIndex((item) => item.key === current)
  return columns[Math.min(columns.length - 1, index + 1)]?.key ?? 'a_fazer'
}

function previousColumn(column?: string): BoardColumn {
  const current = toColumn(column)
  const index = columns.findIndex((item) => item.key === current)
  return columns[Math.max(0, index - 1)]?.key ?? 'a_fazer'
}

function columnLabel(column?: string) {
  return columns.find((item) => item.key === toColumn(column))?.title ?? 'A fazer'
}

function roleLabel(role?: string | null) {
  return roleChoices.find((item) => item.value === role)?.label ?? labelFor(role || 'secretaria')
}

function optionList(values: Array<string | null | undefined>, emptyValue: string) {
  const unique = [...new Set(values.filter(Boolean).map((value) => String(value)))]
  return [
    { value: emptyValue, label: emptyValue === 'todos' ? 'Todos' : 'Todas' },
    ...unique.map((value) => ({ value, label: labelFor(value) })),
  ]
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function labelFor(value?: string | null) {
  const labels: Record<string, string> = {
    a_fazer: 'A fazer',
    em_andamento: 'Em andamento',
    aguardando_aluno: 'Aguardando aluno',
    aguardando_financeiro: 'Aguardando financeiro',
    concluido: 'Concluído',
    comercial: 'Comercial',
    financeiro: 'Financeiro',
    secretaria: 'Secretaria',
    sucesso_do_aluno: 'Sucesso do aluno',
    ia: 'IA',
    matricula: 'Matrícula',
    documento: 'Documento',
    pagamento: 'Pagamento',
    contrato: 'Contrato',
    risco_evasao: 'Risco de evasão',
    lead: 'Lead',
    manual: 'Manual',
  }
  return labels[String(value)] ?? String(value ?? 'Não informado')
}

function priorityWeight(priority?: string) {
  const value = normalize(priority ?? '')
  if (value.includes('urgente') || value.includes('critico')) return 1
  if (value.includes('alta')) return 2
  if (value.includes('media')) return 3
  if (value.includes('média')) return 3
  return 4
}

function priorityTone(priority?: string) {
  const weight = priorityWeight(priority)
  if (weight === 1) return 'critical'
  if (weight === 2) return 'high'
  if (weight === 3) return 'medium'
  return 'normal'
}

function dueTime(task: PostSaleTask) {
  const time = new Date(task.dueAt).getTime()
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
}

function alarmState(task: PostSaleTask) {
  if (task.status === 'CONCLUIDA') return 'none'
  const timeLeft = dueTime(task) - Date.now()
  if (!Number.isFinite(timeLeft) || timeLeft === Number.MAX_SAFE_INTEGER) return 'none'
  if (timeLeft < 0) return 'late'

  const reminderPreference = taskReminderPreference(task)
  if (reminderPreference === 0) return 'none'
  if (reminderPreference === 1) return timeLeft <= 86_400_000 ? '24h' : 'none'
  if (reminderPreference === 2) return timeLeft <= 172_800_000 ? '48h' : 'none'

  if (timeLeft <= 86_400_000) return '24h'
  if (timeLeft <= 172_800_000) return '48h'
  return 'none'
}

function taskReminderPreference(task: PostSaleTask) {
  if (typeof task.reminderDaysBefore === 'number') return task.reminderDaysBefore
  const relatedEntity =
    task.relatedEntity && typeof task.relatedEntity === 'object' ? task.relatedEntity : null
  if (relatedEntity?.rule === 'manual' && relatedEntity.reminderDaysBefore == null) return 0
  return null
}

function alarmLabel(task: PostSaleTask) {
  const state = alarmState(task)
  if (state === 'late') return 'Vencida'
  if (state === '24h') return 'Alarme 24h'
  if (state === '48h') return 'Alarme 48h'
  if (task.reminderAt) return `Lembrete ${formatDate(task.reminderAt)}`
  return 'Sem alarme'
}

function alertLevelLabel(level: PostSaleAlert['level']) {
  const labels: Record<PostSaleAlert['level'], string> = {
    VENCIDA: 'Vencida',
    CRITICO: 'Crítica',
    '24H': 'Alarme 24h',
    '48H': 'Alarme 48h',
  }
  return labels[level]
}

function alertWeight(level: PostSaleAlert['level']) {
  const weights: Record<PostSaleAlert['level'], number> = {
    VENCIDA: 0,
    CRITICO: 1,
    '24H': 2,
    '48H': 3,
  }
  return weights[level]
}

function alertTone(level: PostSaleAlert['level']) {
  if (level === 'VENCIDA') return 'late'
  if (level === 'CRITICO') return 'critical'
  if (level === '24H') return 'today'
  return 'soon'
}

function alertTimeLabel(alert: PostSaleAlert) {
  if (alert.minutesUntilDue < 0)
    return `Venceu há ${humanizeMinutes(Math.abs(alert.minutesUntilDue))}`
  return `Vence em ${humanizeMinutes(alert.minutesUntilDue)}`
}

function humanizeMinutes(minutes: number) {
  if (minutes < 60) return `${Math.max(1, minutes)} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days} dia${days === 1 ? '' : 's'}`
}

function dispatchMessage(log: PostSaleIntegrationLog) {
  const message = log.requestPayload?.message
  return typeof message === 'string' && message.trim() ? message : log.visibleMessage
}

function isOverdue(task: PostSaleTask) {
  return task.status !== 'CONCLUIDA' && dueTime(task) < Date.now()
}

function formatDate(value?: string | null) {
  if (!value) return 'sem prazo'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'sem prazo'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatLongDate(value?: string | null) {
  if (!value) return 'Não informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function defaultCreateTaskForm(): CreateTaskForm {
  const due = new Date()
  due.setDate(due.getDate() + 1)
  due.setHours(17, 30, 0, 0)
  return {
    title: '',
    description: '',
    studentKey: '',
    assignee: '',
    role: 'secretaria',
    priority: 'Média',
    dueAt: toDatetimeLocalValue(due),
    reminderDaysBefore: '1',
  }
}

function toDatetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

watch(
  activeAlerts,
  (nextAlerts) => {
    const urgent = nextAlerts.find((alert) => ['VENCIDA', 'CRITICO', '24H'].includes(alert.level))
    if (!urgent || seenAlertIds.value.has(urgent.id)) return

    const nextSeen = new Set(seenAlertIds.value)
    nextSeen.add(urgent.id)
    seenAlertIds.value = nextSeen

    if (soundEnabled.value) void playAlertSound(urgent.level)
    notifyAlert(urgent)
  },
  { flush: 'post' },
)

onMounted(loadBoard)

onBeforeUnmount(() => {
  if (alertFeedbackTimer) window.clearTimeout(alertFeedbackTimer)
  if (alertAudioContext) void alertAudioContext.close()
})
</script>

<template>
  <div class="task-board-page">
    <AppNav />

    <main class="task-board-shell">
      <header class="task-board-header">
        <div>
          <h1>Quadro operacional</h1>
          <p>
            Central estilo Trello para acompanhar tarefas, automações e responsáveis da matrícula.
          </p>
        </div>

        <div class="board-actions">
          <button type="button" class="ghost-action alert-center-action" @click="openAlertCenter">
            <NIcon :component="NotificationsOutline" size="16" />
            Central de alertas
            <span v-if="activeAlerts.length" class="action-badge">{{ activeAlerts.length }}</span>
          </button>
          <button type="button" class="primary-action" @click="openCreateTask">
            <NIcon :component="AddCircleOutline" size="16" />
            Nova tarefa
          </button>
          <button type="button" class="ghost-action" @click="router.push('/dashboard')">
            Painel gestor
          </button>
          <button type="button" class="primary-action" :disabled="loading" @click="loadBoard">
            <NIcon :component="FlashOutline" size="16" />
            Atualizar
          </button>
        </div>
      </header>

      <section class="ops-strip" aria-label="Resumo do quadro">
        <div>
          <span>Total</span>
          <strong>{{ boardStats.total }}</strong>
        </div>
        <div>
          <span>Abertas</span>
          <strong>{{ boardStats.open }}</strong>
        </div>
        <div>
          <span>Prioridade alta</span>
          <strong>{{ boardStats.high }}</strong>
        </div>
        <div>
          <span>Vencidas</span>
          <strong>{{ boardStats.overdue }}</strong>
        </div>
        <button type="button" class="ops-alert-tile" @click="openAlertCenter">
          <span>Alertas ativos</span>
          <strong>{{ boardStats.alerts }}</strong>
        </button>
        <div>
          <span>Alarme 24h</span>
          <strong>{{ boardStats.alarm24 }}</strong>
        </div>
        <div>
          <span>Alarme 48h</span>
          <strong>{{ boardStats.alarm48 }}</strong>
        </div>
        <div>
          <span>Automações</span>
          <strong>{{ boardStats.auto }}</strong>
        </div>
      </section>

      <section
        v-if="topAlert"
        class="alert-command-center"
        :class="`alert-command-center--${alertTone(topAlert.level)}`"
        aria-live="polite"
      >
        <div class="alert-command-center__main">
          <span class="alert-siren">
            <NIcon :component="RadioOutline" size="20" />
          </span>
          <div>
            <span class="alert-eyebrow">{{ alertLevelLabel(topAlert.level) }}</span>
            <h2>{{ topAlert.title }}</h2>
            <p>{{ topAlert.message }}</p>
          </div>
        </div>
        <div class="alert-command-center__actions">
          <span>{{ alertTimeLabel(topAlert) }}</span>
          <button type="button" class="ghost-action" @click="openAlertCenter">Abrir central</button>
          <button
            type="button"
            class="primary-action"
            :disabled="dispatchingAlertId === topAlert.id"
            @click="dispatchAlert(topAlert)"
          >
            <NIcon :component="MegaphoneOutline" size="16" />
            {{ dispatchingAlertId === topAlert.id ? 'Disparando...' : 'Disparar agora' }}
          </button>
        </div>
      </section>

      <section class="filters-bar" aria-label="Filtros de tarefas">
        <label class="search-field">
          <NIcon :component="SearchOutline" size="16" />
          <input
            v-model="search"
            type="search"
            placeholder="Buscar aluno, tarefa, curso ou responsável"
          />
        </label>

        <label>
          <span>Responsável</span>
          <select v-model="roleFilter">
            <option v-for="option in roleOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          <span>Prioridade</span>
          <select v-model="priorityFilter">
            <option v-for="option in priorityOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          <span>Origem</span>
          <select v-model="originFilter">
            <option v-for="option in originOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          <span>Curso</span>
          <select v-model="courseFilter">
            <option v-for="option in courseOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="clear-filters"
          :disabled="activeFilterCount === 0"
          @click="clearFilters"
        >
          <NIcon :component="FunnelOutline" size="15" />
          Limpar
        </button>
      </section>

      <p v-if="error" class="error-banner">{{ error }}</p>

      <div v-if="loading" class="loading-state">
        <NSpin size="large" />
      </div>

      <section v-else class="kanban-board" aria-label="Quadro de tarefas operacionais">
        <article
          v-for="column in columns"
          :key="column.key"
          class="board-column"
          :class="`board-column--${column.key}`"
          @dragover.prevent
          @drop="dropTask($event, column.key)"
        >
          <header class="column-head">
            <div>
              <h2>{{ column.title }}</h2>
              <p>{{ column.helper }}</p>
            </div>
            <strong>{{ boardTasks.get(column.key)?.length ?? 0 }}</strong>
          </header>

          <div class="task-stack">
            <button
              v-for="task in boardTasks.get(column.key)"
              :key="task.id"
              type="button"
              class="task-card"
              :class="{
                'task-card--dragging': draggedTaskId === task.id,
                'task-card--selected': selectedTaskId === task.id,
              }"
              draggable="true"
              @click="selectTask(task)"
              @dragstart="startDrag($event, task)"
              @dragend="endDrag"
            >
              <span class="task-card__topline">
                <span class="origin-pill">{{ labelFor(task.origin) }}</span>
                <span
                  class="priority-pill"
                  :class="`priority-pill--${priorityTone(task.priority)}`"
                  >{{ task.priority }}</span
                >
              </span>

              <strong>{{ task.title }}</strong>
              <span class="student-name">{{ task.studentName }}</span>

              <span class="task-meta">
                <span>{{ taskStudent(task)?.course ?? 'Lead sem matrícula' }}</span>
                <span>·</span>
                <span>{{ labelFor(task.role || task.ownerTeam) }}</span>
              </span>

              <span class="task-card__footer">
                <span class="due-chip" :class="{ 'due-chip--late': isOverdue(task) }">
                  <NIcon :component="TimeOutline" size="13" />
                  {{ formatDate(task.dueAt) }}
                </span>
                <span
                  v-if="alarmState(task) !== 'none'"
                  class="alarm-chip"
                  :class="`alarm-chip--${alarmState(task)}`"
                >
                  <NIcon :component="AlarmOutline" size="13" />
                  {{ alarmLabel(task) }}
                </span>
                <span class="check-progress">
                  {{ taskChecklist(task, taskStudent(task)).done }}/{{
                    taskChecklist(task, taskStudent(task)).total
                  }}
                </span>
              </span>
            </button>

            <p v-if="!boardTasks.get(column.key)?.length" class="empty-column">
              Nenhuma tarefa nesta etapa.
            </p>
          </div>
        </article>
      </section>
    </main>

    <div v-if="alertsPanelOpen" class="drawer-backdrop" @click="closeAlertCenter"></div>
    <aside v-if="alertsPanelOpen" class="alerts-drawer" aria-label="Central de alertas">
      <header class="drawer-head">
        <div>
          <span class="drawer-label">Monitoramento</span>
          <h2>Central de alertas</h2>
          <p>Som, notificação local e disparos fake das tarefas críticas.</p>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="Fechar alertas"
          @click="closeAlertCenter"
        >
          <NIcon :component="CloseOutline" size="18" />
        </button>
      </header>

      <section class="drawer-section">
        <div class="alert-summary-grid">
          <span>
            <small>Total</small>
            <strong>{{ alertStats.total }}</strong>
          </span>
          <span>
            <small>Vencidas</small>
            <strong>{{ alertStats.late }}</strong>
          </span>
          <span>
            <small>Críticas</small>
            <strong>{{ alertStats.critical }}</strong>
          </span>
          <span>
            <small>24h / 48h</small>
            <strong>{{ alertStats.next24 }} / {{ alertStats.next48 }}</strong>
          </span>
        </div>
      </section>

      <section class="drawer-section">
        <h3>Som e notificação</h3>
        <div class="alert-settings">
          <button
            v-if="!soundEnabled"
            type="button"
            class="primary-action"
            @click="enableAlertSound"
          >
            <NIcon :component="VolumeHighOutline" size="16" />
            Ativar som
          </button>
          <button v-else type="button" class="ghost-action" @click="disableAlertSound">
            Som ativado
          </button>
          <button type="button" class="ghost-action" @click="enableBrowserNotifications">
            <NIcon :component="NotificationsOutline" size="16" />
            {{ notificationEnabled ? 'Notificação ativa' : 'Ativar notificação' }}
          </button>
          <button type="button" class="ghost-action" @click="testAlertSignal">Testar alarme</button>
        </div>
        <p v-if="alertFeedback" class="alert-feedback">{{ alertFeedback }}</p>
      </section>

      <section class="drawer-section">
        <h3>Alertas ativos</h3>
        <div v-if="activeAlerts.length" class="alert-list">
          <article
            v-for="alert in activeAlerts"
            :key="alert.id"
            class="alert-card"
            :class="`alert-card--${alertTone(alert.level)}`"
          >
            <header>
              <span>{{ alertLevelLabel(alert.level) }}</span>
              <strong>{{ alertTimeLabel(alert) }}</strong>
            </header>
            <h4>{{ alert.title }}</h4>
            <p>{{ alert.message }}</p>
            <dl>
              <div>
                <dt>Responsável</dt>
                <dd>{{ alert.assignee }}</dd>
              </div>
              <div>
                <dt>Prazo</dt>
                <dd>{{ formatLongDate(alert.dueAt) }}</dd>
              </div>
              <div>
                <dt>Canal</dt>
                <dd>{{ alert.channel }}</dd>
              </div>
            </dl>
            <footer>
              <button type="button" class="ghost-action" @click="openAlertTask(alert)">
                Abrir card
              </button>
              <button
                type="button"
                class="primary-action"
                :disabled="dispatchingAlertId === alert.id"
                @click="dispatchAlert(alert)"
              >
                {{ dispatchingAlertId === alert.id ? 'Disparando...' : 'Disparar fake' }}
              </button>
              <button type="button" class="clear-filters" @click="silenceAlert(alert)">
                Silenciar
              </button>
            </footer>
          </article>
        </div>
        <p v-else class="empty-column">Nenhum alerta ativo no momento.</p>
      </section>

      <section class="drawer-section">
        <h3>Últimos disparos</h3>
        <div v-if="alertDispatches.length" class="dispatch-log-list">
          <article v-for="log in alertDispatches" :key="log.id">
            <span>{{ formatLongDate(log.createdAt) }}</span>
            <strong>{{ log.studentName || 'Tarefa interna' }}</strong>
            <p>{{ dispatchMessage(log) }}</p>
          </article>
        </div>
        <p v-else class="empty-column">Nenhum disparo fake registrado ainda.</p>
      </section>
    </aside>

    <div v-if="selectedTask" class="drawer-backdrop" @click="closeDrawer"></div>
    <aside v-if="selectedTask" class="task-drawer" aria-label="Detalhe da tarefa">
      <header class="drawer-head">
        <div>
          <span class="drawer-label">{{ labelFor(selectedTask.origin) }}</span>
          <h2>{{ selectedTask.title }}</h2>
          <p>{{ selectedTask.studentName }}</p>
        </div>
        <button type="button" class="icon-button" aria-label="Fechar detalhe" @click="closeDrawer">
          <NIcon :component="CloseOutline" size="18" />
        </button>
      </header>

      <section class="drawer-section">
        <div class="detail-grid">
          <span>
            <small>Coluna</small>
            <strong>{{ columnLabel(selectedTask.column) }}</strong>
          </span>
          <span>
            <small>Responsável</small>
            <strong>{{ selectedTask.assignee || selectedTask.ownerTeam }}</strong>
          </span>
          <span>
            <small>Prioridade</small>
            <strong>{{ selectedTask.priority }}</strong>
          </span>
          <span>
            <small>Prazo</small>
            <strong>{{ formatLongDate(selectedTask.dueAt) }}</strong>
          </span>
          <span>
            <small>Alarme</small>
            <strong>{{ alarmLabel(selectedTask) }}</strong>
          </span>
          <span>
            <small>Lembrete programado</small>
            <strong>{{ formatLongDate(selectedTask.reminderAt) }}</strong>
          </span>
        </div>
      </section>

      <section v-if="selectedTask.description" class="drawer-section">
        <h3>Descrição</h3>
        <p class="automation-note">{{ selectedTask.description }}</p>
      </section>

      <section class="drawer-section">
        <h3>Checklist operacional</h3>
        <div class="mini-checklist">
          <span
            v-for="step in selectedStudent?.checklist ?? []"
            :key="step.key"
            :class="`mini-checklist__item mini-checklist__item--${step.status}`"
          >
            <NIcon
              :component="step.status === 'done' ? CheckmarkDoneOutline : AlertCircleOutline"
              size="15"
            />
            {{ step.label }}
          </span>
          <span v-if="!selectedStudent" class="mini-checklist__item mini-checklist__item--pending">
            <NIcon :component="PersonCircleOutline" size="15" />
            Converter lead para matrícula
          </span>
        </div>
      </section>

      <section class="drawer-section">
        <h3>Ações rápidas</h3>
        <div class="quick-actions">
          <button
            type="button"
            :disabled="!selectedTask.studentId || updatingTaskId === selectedTask.id"
            @click="quickAction('message')"
          >
            <NIcon :component="SendOutline" size="16" />
            Enviar lembrete
          </button>
          <button
            type="button"
            :disabled="!selectedTask.studentId || updatingTaskId === selectedTask.id"
            @click="quickAction('document')"
          >
            <NIcon :component="DocumentTextOutline" size="16" />
            Aprovar documento
          </button>
          <button
            type="button"
            :disabled="!selectedTask.studentId || updatingTaskId === selectedTask.id"
            @click="quickAction('payment')"
          >
            <NIcon :component="CardOutline" size="16" />
            Marcar pago
          </button>
          <button
            type="button"
            :disabled="!selectedTask.studentId || updatingTaskId === selectedTask.id"
            @click="quickAction('contract')"
          >
            <NIcon :component="CalendarOutline" size="16" />
            Assinar contrato
          </button>
        </div>
      </section>

      <section class="drawer-section">
        <h3>Mover card</h3>
        <div class="move-actions">
          <button
            type="button"
            :disabled="
              updatingTaskId === selectedTask.id || toColumn(selectedTask.column) === 'a_fazer'
            "
            @click="moveTask(selectedTask, previousColumn(selectedTask.column))"
          >
            Voltar etapa
          </button>
          <button
            type="button"
            :disabled="
              updatingTaskId === selectedTask.id || toColumn(selectedTask.column) === 'concluido'
            "
            @click="moveTask(selectedTask, nextColumn(selectedTask.column))"
          >
            Avançar <NIcon :component="ArrowForwardOutline" size="14" />
          </button>
          <button
            type="button"
            class="done-action"
            :disabled="updatingTaskId === selectedTask.id"
            @click="moveTask(selectedTask, 'concluido')"
          >
            Concluir
          </button>
        </div>
      </section>

      <section class="drawer-section">
        <h3>Histórico e origem</h3>
        <p class="automation-note">{{ selectedTask.automation }}</p>
        <dl class="audit-list">
          <div>
            <dt>Criada por</dt>
            <dd>{{ labelFor(selectedTask.createdBy) }}</dd>
          </div>
          <div>
            <dt>Entrada</dt>
            <dd>{{ formatLongDate(selectedTask.createdAt) }}</dd>
          </div>
          <div>
            <dt>Primeiro movimento</dt>
            <dd>{{ formatLongDate(selectedTask.firstMovedAt) }}</dd>
          </div>
        </dl>
      </section>

      <footer class="drawer-footer">
        <button type="button" class="ghost-action" @click="openStudent(selectedTask)">
          <NIcon :component="OpenOutline" size="15" />
          {{ selectedTask.studentId ? 'Abrir ficha do aluno' : 'Abrir pipeline' }}
        </button>
      </footer>
    </aside>

    <div v-if="createTaskOpen" class="modal-backdrop" @click="closeCreateTask"></div>
    <section v-if="createTaskOpen" class="task-modal" aria-label="Criar nova tarefa">
      <header class="modal-head">
        <div>
          <span>Operação manual</span>
          <h2>Nova tarefa</h2>
          <p>Crie uma atividade para um funcionário com prazo, hora, minuto e alarme.</p>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="Fechar modal"
          @click="closeCreateTask"
        >
          <NIcon :component="CloseOutline" size="18" />
        </button>
      </header>

      <form class="task-form" @submit.prevent="submitCreateTask">
        <label class="field field--full">
          <span>Título da tarefa</span>
          <input
            v-model="createForm.title"
            type="text"
            maxlength="90"
            placeholder="Ex.: Ligar para aluno e confirmar pagamento"
            required
          />
        </label>

        <label class="field field--full">
          <span>Descrição / instruções</span>
          <textarea
            v-model="createForm.description"
            rows="3"
            maxlength="320"
            placeholder="Explique o que o funcionário precisa fazer e qual resultado esperado."
          ></textarea>
        </label>

        <label class="field">
          <span>Aluno vinculado</span>
          <select v-model="createForm.studentKey">
            <option value="">Tarefa interna / sem aluno</option>
            <option v-for="student in students" :key="student.id" :value="student.id">
              {{ student.studentName }} · {{ student.course }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Funcionário responsável</span>
          <input
            v-model="createForm.assignee"
            type="text"
            list="task-assignees"
            placeholder="Nome do funcionário"
            required
          />
          <datalist id="task-assignees">
            <option v-for="employee in employeeSuggestions" :key="employee" :value="employee" />
          </datalist>
        </label>

        <label class="field">
          <span>Equipe</span>
          <select v-model="createForm.role">
            <option v-for="role in roleChoices" :key="role.value" :value="role.value">
              {{ role.label }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Prioridade</span>
          <select v-model="createForm.priority">
            <option v-for="priority in priorityChoices" :key="priority" :value="priority">
              {{ priority }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Prazo, hora e minutos</span>
          <input v-model="createForm.dueAt" type="datetime-local" required />
        </label>

        <label class="field">
          <span>Alarme</span>
          <select v-model="createForm.reminderDaysBefore">
            <option value="1">Avisar 1 dia antes</option>
            <option value="2">Avisar 2 dias antes</option>
            <option value="">Sem alarme</option>
          </select>
        </label>

        <p v-if="createTaskError" class="form-error">{{ createTaskError }}</p>

        <footer class="modal-actions">
          <button
            type="button"
            class="ghost-action"
            :disabled="creatingTask"
            @click="closeCreateTask"
          >
            Cancelar
          </button>
          <button type="submit" class="primary-action" :disabled="creatingTask">
            <NIcon :component="AlarmOutline" size="16" />
            {{ creatingTask ? 'Criando...' : 'Criar tarefa com alarme' }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.task-board-page {
  height: 100vh;
  height: 100dvh;
  background: var(--app-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-board-shell {
  flex: 1;
  min-height: 0;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.task-board-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
}

.task-board-header h1 {
  margin: 0 0 5px;
  color: var(--text);
  font-size: 28px;
  line-height: 1.05;
  font-weight: 950;
}

.task-board-header p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.45;
}

.board-actions,
.move-actions,
.quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.primary-action,
.ghost-action,
.clear-filters,
.ops-alert-tile,
.move-actions button,
.quick-actions button {
  min-height: 38px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 13px;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease;
}

.alert-center-action {
  position: relative;
}

.action-badge {
  min-width: 21px;
  min-height: 21px;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  display: inline-grid;
  place-items: center;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 950;
}

.primary-action,
.done-action {
  border-color: transparent;
  background: linear-gradient(135deg, var(--brand), var(--accent-strong));
  color: #fff;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.ops-strip {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 10px;
}

.ops-strip div,
.ops-alert-tile {
  min-height: 76px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.ops-alert-tile {
  align-items: flex-start;
  text-align: left;
}

.ops-alert-tile:hover {
  border-color: color-mix(in srgb, var(--danger) 42%, var(--border));
  background: var(--danger-soft);
}

.ops-strip span,
.ops-alert-tile span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.ops-strip strong,
.ops-alert-tile strong {
  color: var(--text);
  font-size: 25px;
  line-height: 1;
}

.alert-command-center {
  border: 1px solid var(--border);
  border-left: 5px solid var(--warning);
  border-radius: 10px;
  background: var(--surface);
  padding: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  box-shadow: var(--shadow-xs);
}

.alert-command-center--late,
.alert-command-center--critical {
  border-left-color: var(--danger);
  background: color-mix(in srgb, var(--danger-soft) 44%, var(--surface));
}

.alert-command-center--today {
  border-left-color: var(--danger);
}

.alert-command-center__main {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.alert-siren {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--danger-soft);
  color: var(--danger);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.alert-eyebrow {
  color: var(--danger);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.alert-command-center h2 {
  margin: 2px 0 4px;
  color: var(--text);
  font-size: 17px;
  line-height: 1.2;
}

.alert-command-center p {
  margin: 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.45;
}

.alert-command-center__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.alert-command-center__actions > span {
  color: var(--danger);
  font-size: 12px;
  font-weight: 950;
}

.filters-bar {
  display: grid;
  grid-template-columns: minmax(260px, 1.6fr) repeat(4, minmax(130px, 1fr)) auto;
  gap: 9px;
  align-items: end;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
}

.filters-bar label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filters-bar label span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 850;
}

.filters-bar input,
.filters-bar select {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
  padding: 0 11px;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
}

.search-field {
  position: relative;
}

.search-field :deep(.n-icon) {
  position: absolute;
  left: 11px;
  bottom: 11px;
  color: var(--muted);
}

.search-field input {
  padding-left: 34px;
}

.error-banner {
  margin: 0;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 800;
}

.loading-state {
  flex: 1;
  min-height: 260px;
  display: grid;
  place-items: center;
}

.kanban-board {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(260px, 1fr));
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
  overscroll-behavior-x: contain;
}

.board-column {
  min-width: 260px;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 80%, var(--app-bg));
  display: flex;
  flex-direction: column;
}

.column-head {
  padding: 13px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.column-head h2 {
  margin: 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 950;
}

.column-head p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
}

.column-head strong {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--brand-soft);
  color: var(--brand);
  display: grid;
  place-items: center;
  font-size: 13px;
}

.task-stack {
  min-height: 0;
  padding: 10px;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 9px;
  overflow-y: auto;
}

.task-card {
  width: 100%;
  min-height: 148px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--brand);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  padding: 11px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  cursor: grab;
  box-shadow: var(--shadow-xs);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.task-card:hover,
.task-card--selected {
  border-color: color-mix(in srgb, var(--brand) 46%, var(--border));
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.task-card--dragging {
  opacity: 0.58;
}

.task-card__topline,
.task-card__footer,
.task-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.origin-pill,
.priority-pill,
.due-chip,
.alarm-chip,
.check-progress {
  min-height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 900;
}

.origin-pill {
  background: var(--brand-soft);
  color: var(--brand);
}

.priority-pill {
  background: var(--surface-muted);
  color: var(--muted-strong);
}

.priority-pill--critical,
.priority-pill--high {
  background: var(--danger-soft);
  color: var(--danger);
}

.priority-pill--medium {
  background: var(--warning-soft);
  color: var(--warning);
}

.task-card strong {
  color: var(--text);
  font-size: 14px;
  line-height: 1.25;
}

.student-name {
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 850;
}

.task-meta {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.task-card__footer {
  margin-top: auto;
  justify-content: space-between;
}

.due-chip {
  background: var(--surface-muted);
  color: var(--muted-strong);
}

.due-chip--late {
  background: var(--danger-soft);
  color: var(--danger);
}

.alarm-chip {
  background: var(--surface-muted);
  color: var(--muted-strong);
}

.alarm-chip--24h,
.alarm-chip--late {
  background: var(--danger-soft);
  color: var(--danger);
}

.alarm-chip--48h {
  background: var(--warning-soft);
  color: var(--warning);
}

.check-progress {
  background: var(--surface-soft);
  color: var(--muted-strong);
}

.empty-column {
  margin: 0;
  padding: 22px 10px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 750;
  text-align: center;
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(0, 0, 0, 0.22);
}

.task-drawer {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 21;
  width: min(430px, 100vw);
  height: 100vh;
  height: 100dvh;
  background: var(--surface);
  color: var(--text);
  border-left: 1px solid var(--border);
  box-shadow: -24px 0 70px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.alerts-drawer {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 22;
  width: min(520px, 100vw);
  height: 100vh;
  height: 100dvh;
  background: var(--surface);
  color: var(--text);
  border-left: 1px solid var(--border);
  box-shadow: -24px 0 70px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.drawer-head {
  padding: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.drawer-label {
  color: var(--brand);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.drawer-head h2 {
  margin: 5px 0;
  color: var(--text);
  font-size: 21px;
  line-height: 1.12;
}

.drawer-head p {
  margin: 0;
  color: var(--muted);
  font-weight: 800;
}

.icon-button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  color: var(--text);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.drawer-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.drawer-section h3 {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 14px;
  font-weight: 950;
}

.alert-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.alert-summary-grid span {
  min-height: 64px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.alert-summary-grid small {
  color: var(--muted);
  font-size: 11px;
  font-weight: 850;
}

.alert-summary-grid strong {
  color: var(--text);
  font-size: 21px;
  line-height: 1;
}

.alert-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.alert-feedback {
  margin: 10px 0 0;
  padding: 9px 10px;
  border-radius: 8px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 12px;
  font-weight: 850;
}

.alert-list {
  display: grid;
  gap: 10px;
}

.alert-card {
  border: 1px solid var(--border);
  border-left: 4px solid var(--warning);
  border-radius: 10px;
  background: var(--surface-soft);
  padding: 12px;
  display: grid;
  gap: 9px;
}

.alert-card--late,
.alert-card--critical {
  border-left-color: var(--danger);
  background: color-mix(in srgb, var(--danger-soft) 36%, var(--surface));
}

.alert-card--today {
  border-left-color: var(--danger);
}

.alert-card header,
.alert-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.alert-card header span {
  min-height: 24px;
  border-radius: 999px;
  background: var(--danger-soft);
  color: var(--danger);
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 950;
}

.alert-card header strong {
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 950;
}

.alert-card h4 {
  margin: 0;
  color: var(--text);
  font-size: 15px;
  line-height: 1.2;
}

.alert-card p {
  margin: 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.45;
}

.alert-card dl {
  margin: 0;
  display: grid;
  gap: 7px;
}

.alert-card dl div,
.dispatch-log-list article {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 9px;
}

.alert-card dt,
.dispatch-log-list span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 850;
}

.alert-card dd {
  margin: 2px 0 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 850;
}

.dispatch-log-list {
  display: grid;
  gap: 8px;
}

.dispatch-log-list strong {
  display: block;
  margin-top: 3px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.dispatch-log-list p {
  margin: 4px 0 0;
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.4;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid span {
  min-height: 68px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  background: var(--surface-soft);
}

.detail-grid small,
.audit-list dt {
  display: block;
  color: var(--muted);
  font-size: 11px;
  font-weight: 850;
}

.detail-grid strong,
.audit-list dd {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.mini-checklist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mini-checklist__item {
  min-height: 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted-strong);
  font-size: 13px;
  font-weight: 800;
}

.mini-checklist__item--done {
  color: var(--brand);
  background: var(--brand-soft);
}

.automation-note {
  margin: 0 0 12px;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.5;
}

.audit-list {
  margin: 0;
  display: grid;
  gap: 8px;
}

.audit-list div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.audit-list dd {
  margin: 0;
  text-align: right;
}

.drawer-footer {
  padding: 16px 20px 20px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.38);
}

.task-modal {
  position: fixed;
  z-index: 31;
  top: 50%;
  left: 50%;
  width: min(760px, calc(100vw - 28px));
  max-height: min(86vh, 760px);
  transform: translate(-50%, -50%);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
}

.modal-head {
  padding: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.modal-head span {
  color: var(--brand);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.modal-head h2 {
  margin: 4px 0;
  color: var(--text);
  font-size: 22px;
  font-weight: 950;
}

.modal-head p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

.task-form {
  padding: 18px 20px 20px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px;
}

.field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field--full {
  grid-column: 1 / -1;
}

.field span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
  padding: 0 11px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
}

.field textarea {
  min-height: 92px;
  padding: 11px;
  resize: vertical;
  line-height: 1.45;
}

.form-error {
  grid-column: 1 / -1;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 13px;
  font-weight: 850;
}

.modal-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding-top: 6px;
}

@media (max-width: 1100px) {
  .ops-strip,
  .filters-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-field {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .task-board-page {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .task-board-shell {
    padding: 14px;
    min-height: max-content;
  }

  .task-board-header,
  .board-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .ops-strip,
  .filters-bar {
    grid-template-columns: 1fr;
  }

  .alert-command-center,
  .alert-command-center__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .alert-command-center__actions .primary-action,
  .alert-command-center__actions .ghost-action {
    width: 100%;
  }

  .kanban-board {
    flex: 0 0 560px;
    grid-template-columns: repeat(5, minmax(270px, 82vw));
    min-height: 560px;
    overflow-y: hidden;
  }

  .task-drawer {
    width: 100vw;
  }

  .alerts-drawer {
    width: 100vw;
  }

  .alert-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .task-form {
    grid-template-columns: 1fr;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }
}
</style>
