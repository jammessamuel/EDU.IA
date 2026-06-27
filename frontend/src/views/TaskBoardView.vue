<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NSpin } from 'naive-ui'
import {
  AlertCircleOutline,
  ArrowForwardOutline,
  CalendarOutline,
  CardOutline,
  CheckmarkDoneOutline,
  CloseOutline,
  DocumentTextOutline,
  FlashOutline,
  FunnelOutline,
  OpenOutline,
  PersonCircleOutline,
  SearchOutline,
  SendOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import { postSalesApi } from '@/api/postSales'
import type { PostSaleOverview, PostSaleStudent, PostSaleTask } from '@/types'

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
const search = ref('')
const roleFilter = ref('todos')
const priorityFilter = ref('todas')
const originFilter = ref('todas')
const courseFilter = ref('todos')

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
  return {
    total: tasks.value.length,
    open: open.length,
    overdue,
    high: open.filter((task) => priorityWeight(task.priority) <= 2).length,
    auto: open.filter((task) => task.createdBy === 'automacao' || task.source === 'automatic')
      .length,
  }
})

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

onMounted(loadBoard)
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
        <div>
          <span>Automações</span>
          <strong>{{ boardStats.auto }}</strong>
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
        </div>
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.ops-strip div {
  min-height: 76px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.ops-strip span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.ops-strip strong {
  color: var(--text);
  font-size: 25px;
  line-height: 1;
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

  .kanban-board {
    flex: 0 0 560px;
    grid-template-columns: repeat(5, minmax(270px, 82vw));
    min-height: 560px;
    overflow-y: hidden;
  }

  .task-drawer {
    width: 100vw;
  }
}
</style>
