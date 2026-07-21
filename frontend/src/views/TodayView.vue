<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon, NSpin } from 'naive-ui'
import {
  CalendarOutline,
  CheckmarkDoneOutline,
  CloseOutline,
  RefreshOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import ContactForm from '@/components/follow-up/ContactForm.vue'
import { enrollmentApi } from '@/api/enrollments'
import { postSalesApi } from '@/api/postSales'
import { simulatorApi } from '@/api/simulator'
import { usersApi } from '@/api/users'
import type { ContactInput, PostSaleTask, PostSaleToday, SchoolUser } from '@/types'

type ContactTarget = {
  origem: 'lead' | 'aluno'
  id: string
  nome: string
}

const today = ref<PostSaleToday | null>(null)
const router = useRouter()
const users = ref<SchoolUser[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const onlyMine = ref(true)
const busyId = ref<string | null>(null)
const contactTarget = ref<ContactTarget | null>(null)
const contactBusy = ref(false)
const contactError = ref<string | null>(null)
const contactFormKey = ref(0)

const countCards = computed(() => {
  const counts = today.value?.counts
  return [
    {
      label: 'Aguardando conferência',
      value: counts?.aguardandoConferencia ?? 0,
      target: 'matriculas-hoje',
      tone: 'warning',
    },
    {
      label: 'Ações de acompanhamento',
      value: counts?.acoesDeCaso ?? 0,
      target: 'casos-hoje',
      tone: 'brand',
    },
    {
      label: 'Sem responsável',
      value: counts?.casosSemResponsavel ?? 0,
      target: 'sem-responsavel-hoje',
      tone: 'danger',
    },
    {
      label: 'Contatos atrasados',
      value: counts?.contatosAtrasados ?? 0,
      target: 'contatos-hoje',
      tone: 'danger',
    },
    {
      label: 'Contatos hoje',
      value: counts?.contatosHoje ?? 0,
      target: 'contatos-hoje',
      tone: 'info',
    },
    {
      label: 'Tarefas atrasadas',
      value: counts?.tarefasAtrasadas ?? 0,
      target: 'tarefas-hoje',
      tone: 'danger',
    },
    {
      label: 'Tarefas hoje',
      value: counts?.tarefasHoje ?? 0,
      target: 'tarefas-hoje',
      tone: 'brand',
    },
    {
      label: 'Leads sem contato há 24h',
      value: counts?.leadsSemContatoHa24h ?? 0,
      target: 'leads-hoje',
      tone: 'warning',
    },
  ]
})

onMounted(async () => {
  await Promise.all([loadToday(), usersApi.list().then((list) => (users.value = list))])
})

async function loadToday() {
  loading.value = true
  error.value = null
  try {
    today.value = await postSalesApi.today(onlyMine.value)
  } catch {
    error.value = 'Não foi possível carregar a fila de hoje.'
  } finally {
    loading.value = false
  }
}

async function setScope(value: boolean) {
  if (onlyMine.value === value) return
  onlyMine.value = value
  await loadToday()
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function confirmEnrollment(id: string) {
  if (busyId.value) return
  busyId.value = `enrollment:${id}`
  error.value = null
  try {
    await enrollmentApi.confirm(id)
    await loadToday()
  } catch {
    error.value = 'Não foi possível confirmar a matrícula.'
  } finally {
    busyId.value = null
  }
}

async function updateTask(task: PostSaleTask, column: string) {
  if (busyId.value) return
  busyId.value = `task:${task.id}`
  error.value = null
  try {
    await postSalesApi.updateTask(task.id, {
      column,
      status: column === 'concluido' ? 'CONCLUIDA' : 'ABERTA',
    })
    await loadToday()
  } catch {
    error.value = 'Não foi possível atualizar a tarefa.'
  } finally {
    busyId.value = null
  }
}

function changeTaskColumn(task: PostSaleTask, event: Event) {
  return updateTask(task, (event.target as HTMLSelectElement).value)
}

function openContact(target: ContactTarget) {
  contactTarget.value = target
  contactError.value = null
  contactFormKey.value += 1
}

function closeContact() {
  if (contactBusy.value) return
  contactTarget.value = null
  contactError.value = null
}

async function registerContact(input: ContactInput) {
  if (!contactTarget.value || contactBusy.value) return
  contactBusy.value = true
  contactError.value = null
  try {
    if (contactTarget.value.origem === 'aluno') {
      await postSalesApi.registerContact(contactTarget.value.id, input)
    } else {
      await simulatorApi.registerLeadContact(contactTarget.value.id, input)
    }
    contactTarget.value = null
    await loadToday()
  } catch {
    contactError.value = 'Não foi possível registrar o contato.'
  } finally {
    contactBusy.value = false
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function taskAssignee(task: PostSaleTask) {
  return task.assignedUser?.name || task.assignee || task.ownerTeam
}

async function assignCase(studentId: string, event: Event) {
  const assigneeId = (event.target as HTMLSelectElement).value
  if (!assigneeId || busyId.value) return
  busyId.value = `case:${studentId}`
  try {
    await postSalesApi.assignStudent(studentId, assigneeId)
    await loadToday()
  } catch {
    error.value = 'Não foi possível atribuir o aluno.'
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="today-page">
    <AppNav />

    <main class="today-shell">
      <header class="today-header">
        <div>
          <span class="eyebrow">Fila operacional</span>
          <h1>Hoje</h1>
          <p>O que precisa de atenção humana agora, em ordem de urgência.</p>
        </div>
        <div class="header-actions">
          <div class="scope-toggle" aria-label="Escopo da fila">
            <button :class="{ active: onlyMine }" type="button" @click="setScope(true)">
              Minhas
            </button>
            <button :class="{ active: !onlyMine }" type="button" @click="setScope(false)">
              Todas
            </button>
          </div>
          <button type="button" class="refresh-action" :disabled="loading" @click="loadToday">
            <NIcon :component="RefreshOutline" size="16" />
            Atualizar
          </button>
        </div>
      </header>

      <p v-if="error" class="error-banner">{{ error }}</p>

      <div v-if="loading" class="loading-state">
        <NSpin size="large" />
      </div>

      <template v-else-if="today">
        <section class="count-grid" aria-label="Resumo da fila de hoje">
          <button
            v-for="card in countCards"
            :key="card.label"
            type="button"
            class="count-card"
            :class="`count-card--${card.tone}`"
            @click="scrollToSection(card.target)"
          >
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
          </button>
        </section>

        <section id="matriculas-hoje" class="work-section">
          <header>
            <div>
              <NIcon :component="CheckmarkDoneOutline" size="19" />
              <h2>Matrículas aguardando conferência</h2>
            </div>
            <span>{{ today.aguardandoConferencia.length }}</span>
          </header>
          <div v-if="today.aguardandoConferencia.length" class="work-list">
            <article v-for="enrollment in today.aguardandoConferencia" :key="enrollment.id">
              <div>
                <small>{{ enrollment.number }} · {{ formatDate(enrollment.createdAt) }}</small>
                <strong>{{ enrollment.studentName }}</strong>
                <p>{{ enrollment.course || 'Curso não informado' }} · {{ enrollment.paymentStatus }}</p>
              </div>
              <button
                type="button"
                :disabled="busyId === `enrollment:${enrollment.id}`"
                @click="confirmEnrollment(enrollment.id)"
              >
                {{ busyId === `enrollment:${enrollment.id}` ? 'Confirmando...' : 'Confirmar' }}
              </button>
            </article>
          </div>
          <p v-else class="empty-state">Nenhuma matrícula aguardando conferência.</p>
        </section>

        <section id="contatos-hoje" class="work-section">
          <header>
            <div>
              <NIcon :component="CalendarOutline" size="19" />
              <h2>Contatos pendentes</h2>
            </div>
            <span>{{ today.pendenciasDeContato.length }}</span>
          </header>
          <div v-if="today.pendenciasDeContato.length" class="work-list">
            <article
              v-for="contact in today.pendenciasDeContato"
              :key="`${contact.origem}:${contact.id}`"
              :class="{ overdue: contact.atrasado }"
            >
              <div>
                <small>
                  {{ contact.origem === 'lead' ? 'Lead' : 'Aluno' }} ·
                  {{ contact.atrasado ? 'Atrasado' : 'Hoje' }}
                </small>
                <strong>{{ contact.nome }}</strong>
                <p>
                  Próximo contato: {{ formatDate(contact.nextContactAt) }}
                  <template v-if="contact.ultimoContato">
                    · último {{ contact.ultimoContato.channel }} / {{ contact.ultimoContato.outcome }}
                  </template>
                </p>
              </div>
              <button
                type="button"
                @click="openContact({ origem: contact.origem, id: contact.id, nome: contact.nome })"
              >
                Registrar contato
              </button>
            </article>
          </div>
          <p v-else class="empty-state">Nenhum contato pendente até o fim do dia.</p>
        </section>

        <section id="casos-hoje" class="work-section">
          <header>
            <div>
              <NIcon :component="CalendarOutline" size="19" />
              <h2>Próximas ações dos alunos</h2>
            </div>
            <span>{{ today.acoesDeCaso.length }}</span>
          </header>
          <div v-if="today.acoesDeCaso.length" class="work-list">
            <article v-for="item in today.acoesDeCaso" :key="item.id" :class="{ overdue: item.atrasado }">
              <div>
                <small>{{ item.atrasado ? 'Atrasada' : 'Hoje' }} · {{ formatDate(item.nextActionAt) }}</small>
                <strong>{{ item.nome }}</strong>
                <p>{{ item.nextAction }} · {{ item.assignee?.name || 'Sem responsável' }}</p>
              </div>
              <button type="button" @click="router.push(`/post-sales/students/${item.id}`)">Abrir ficha</button>
            </article>
          </div>
          <p v-else class="empty-state">Nenhuma próxima ação vencendo hoje.</p>
        </section>

        <section v-if="!onlyMine" id="sem-responsavel-hoje" class="work-section">
          <header>
            <div>
              <NIcon :component="CheckmarkDoneOutline" size="19" />
              <h2>Alunos sem responsável</h2>
            </div>
            <span>{{ today.casosSemResponsavel.length }}</span>
          </header>
          <div v-if="today.casosSemResponsavel.length" class="work-list">
            <article v-for="item in today.casosSemResponsavel" :key="item.id" class="overdue">
              <div>
                <small>Fila compartilhada</small>
                <strong>{{ item.nome }}</strong>
                <p>{{ item.nextAction || 'Definir próxima ação' }}</p>
              </div>
              <select :disabled="busyId === `case:${item.id}`" @change="assignCase(item.id, $event)">
                <option value="">Atribuir responsável</option>
                <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
              </select>
            </article>
          </div>
          <p v-else class="empty-state">Todos os alunos ativos têm responsável.</p>
        </section>

        <section id="tarefas-hoje" class="work-section">
          <header>
            <div>
              <NIcon :component="TimeOutline" size="19" />
              <h2>Tarefas</h2>
            </div>
            <span>{{ today.tarefas.length }}</span>
          </header>
          <div v-if="today.tarefas.length" class="work-list">
            <article v-for="task in today.tarefas" :key="task.id">
              <div>
                <small>{{ formatDate(task.dueAt) }} · {{ task.priority }}</small>
                <strong>{{ task.title }}</strong>
                <p>{{ task.studentName }} · {{ taskAssignee(task) }}</p>
              </div>
              <div class="task-actions">
                <select
                  :value="task.column || 'a_fazer'"
                  :disabled="busyId === `task:${task.id}`"
                  @change="changeTaskColumn(task, $event)"
                >
                  <option value="a_fazer">A fazer</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="aguardando_aluno">Aguardando aluno</option>
                  <option value="aguardando_financeiro">Aguardando financeiro</option>
                </select>
                <button
                  type="button"
                  :disabled="busyId === `task:${task.id}`"
                  @click="updateTask(task, 'concluido')"
                >
                  Concluir
                </button>
              </div>
            </article>
          </div>
          <p v-else class="empty-state">Nenhuma tarefa com prazo até hoje.</p>
        </section>

        <section id="leads-hoje" class="work-section">
          <header>
            <div>
              <NIcon :component="CalendarOutline" size="19" />
              <h2>Leads novos sem contato</h2>
            </div>
            <span>{{ today.leadsSemContatoHa24h.length }}</span>
          </header>
          <div v-if="today.leadsSemContatoHa24h.length" class="work-list">
            <article v-for="lead in today.leadsSemContatoHa24h" :key="lead.id" class="overdue">
              <div>
                <small>Novo há mais de 24h · atualizado {{ formatDate(lead.updatedAt) }}</small>
                <strong>{{ lead.name }}</strong>
                <p>Primeiro contato humano ainda não registrado.</p>
              </div>
              <button
                type="button"
                @click="openContact({ origem: 'lead', id: lead.id, nome: lead.name })"
              >
                Registrar contato
              </button>
            </article>
          </div>
          <p v-else class="empty-state">Nenhum lead novo está sem contato há mais de 24h.</p>
        </section>
      </template>
    </main>

    <div v-if="contactTarget" class="modal-backdrop" @click.self="closeContact">
      <section class="contact-modal" aria-label="Registrar contato">
        <header>
          <div>
            <span>{{ contactTarget.origem === 'lead' ? 'Lead' : 'Aluno' }}</span>
            <h2>Registrar contato</h2>
            <p>{{ contactTarget.nome }}</p>
          </div>
          <button type="button" aria-label="Fechar" @click="closeContact">
            <NIcon :component="CloseOutline" size="18" />
          </button>
        </header>
        <p v-if="contactError" class="error-banner">{{ contactError }}</p>
        <ContactForm
          :key="contactFormKey"
          :busy="contactBusy"
          @submit="registerContact"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.today-page {
  min-height: 100vh;
  background: var(--app-bg);
}

.today-shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 56px;
}

.today-header,
.today-header > div,
.header-actions,
.scope-toggle,
.work-section > header,
.work-section > header > div,
.work-list article,
.task-actions,
.contact-modal > header {
  display: flex;
  align-items: center;
}

.today-header {
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

.today-header > div:first-child {
  display: block;
}

.eyebrow {
  color: var(--brand);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.today-header h1 {
  margin: 3px 0;
  color: var(--text);
  font-size: 32px;
}

.today-header p {
  margin: 0;
  color: var(--muted);
}

.header-actions {
  gap: 10px;
}

.scope-toggle {
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-muted);
}

.scope-toggle button,
.refresh-action,
.work-list button,
.contact-modal > header button {
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  font-weight: 800;
}

.scope-toggle button {
  background: transparent;
  color: var(--muted-strong);
  padding: 8px 12px;
}

.scope-toggle button.active {
  background: var(--surface-raised);
  color: var(--brand);
  box-shadow: var(--shadow-xs);
}

.refresh-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--brand);
  color: #fff;
  padding: 10px 13px;
}

.count-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 22px;
}

.count-card {
  min-height: 104px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-raised);
  color: var(--text);
  cursor: pointer;
  padding: 14px;
  text-align: left;
  box-shadow: var(--shadow-xs);
}

.count-card span,
.count-card strong {
  display: block;
}

.count-card span {
  min-height: 32px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
}

.count-card strong {
  margin-top: 7px;
  font-size: 28px;
}

.count-card--danger {
  border-top: 3px solid var(--danger);
}

.count-card--warning {
  border-top: 3px solid var(--warning);
}

.count-card--brand,
.count-card--info {
  border-top: 3px solid var(--brand);
}

.work-section {
  scroll-margin-top: 18px;
  margin-bottom: 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}

.work-section > header {
  justify-content: space-between;
  padding: 15px 18px;
  border-bottom: 1px solid var(--border);
}

.work-section > header > div {
  gap: 8px;
  color: var(--brand);
}

.work-section h2 {
  margin: 0;
  color: var(--text);
  font-size: 16px;
}

.work-section > header > span {
  min-width: 28px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 12px;
  font-weight: 900;
  padding: 4px 9px;
  text-align: center;
}

.work-list article {
  justify-content: space-between;
  gap: 18px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.work-list article:last-child {
  border-bottom: 0;
}

.work-list article.overdue {
  box-shadow: inset 4px 0 0 var(--danger);
}

.work-list article > div:first-child {
  min-width: 0;
}

.work-list small,
.work-list strong,
.work-list p {
  display: block;
}

.work-list small {
  color: var(--muted);
  font-size: 11px;
}

.work-list strong {
  margin: 3px 0;
  color: var(--text);
  font-size: 14px;
}

.work-list p {
  margin: 0;
  color: var(--muted-strong);
  font-size: 12px;
}

.work-list button {
  flex-shrink: 0;
  background: var(--brand);
  color: #fff;
  padding: 9px 12px;
}

.task-actions {
  gap: 8px;
}

.task-actions select {
  min-height: 36px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--input-bg);
  color: var(--text);
  padding: 0 8px;
}

.work-list > article > select {
  min-width: 190px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  padding: 9px;
}

.empty-state {
  margin: 0;
  padding: 22px 18px;
  color: var(--muted);
  font-size: 13px;
}

.error-banner {
  margin: 0 0 14px;
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger);
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
}

.loading-state {
  display: grid;
  min-height: 320px;
  place-items: center;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(5px);
}

.contact-modal {
  width: min(620px, 100%);
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-raised);
  padding: 18px;
  box-shadow: var(--shadow-md);
}

.contact-modal > header {
  justify-content: space-between;
  margin-bottom: 16px;
}

.contact-modal > header > div {
  display: block;
}

.contact-modal > header span {
  color: var(--brand);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.contact-modal h2,
.contact-modal p {
  margin: 2px 0;
}

.contact-modal h2 {
  color: var(--text);
  font-size: 19px;
}

.contact-modal p {
  color: var(--muted);
  font-size: 13px;
}

.contact-modal > header button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  background: var(--surface-muted);
  color: var(--text);
}

@media (max-width: 960px) {
  .count-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .today-header,
  .work-list article {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 600px) {
  .today-shell {
    width: min(100% - 20px, 1180px);
    padding-top: 18px;
  }

  .header-actions,
  .task-actions {
    width: 100%;
    align-items: stretch;
    flex-direction: column;
  }

  .count-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
