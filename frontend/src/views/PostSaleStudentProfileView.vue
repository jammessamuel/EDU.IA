<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NIcon, NSpin } from 'naive-ui'
import {
  CalendarOutline,
  CardOutline,
  ChatbubbleEllipsesOutline,
  CheckmarkCircleOutline,
  CreateOutline,
  DocumentTextOutline,
  LaptopOutline,
  PaperPlaneOutline,
  RefreshOutline,
  ShieldCheckmarkOutline,
  TimeOutline,
  TrendingUpOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import { postSalesApi } from '@/api/postSales'
import type {
  PostSaleIntegrationLog,
  PostSaleProfileDocumentRequirement,
  PostSaleStudentProfile,
  PostSaleTask,
  PostSaleTimelineEvent,
} from '@/types'

const route = useRoute()
const router = useRouter()
const profile = ref<PostSaleStudentProfile | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const actionBusy = ref<string | null>(null)
const feedback = ref<string | null>(null)

const studentId = computed(() => String(route.params.studentId ?? ''))
const student = computed(() => profile.value?.student ?? null)

const dataSections = computed(() => {
  const groups = new Map<string, Array<{ label: string; value: string }>>()
  for (const row of profile.value?.personalData ?? []) {
    const current = groups.get(row.section) ?? []
    current.push({ label: row.label, value: row.value })
    groups.set(row.section, current)
  }
  return Array.from(groups.entries()).map(([title, rows]) => ({ title, rows }))
})

const statusCards = computed(() => {
  if (!profile.value) return []
  const current = profile.value
  return [
    {
      label: 'Documentos',
      value: current.student.documentStatus,
      helper: `${current.documents.requirements.filter((item) => item.status === 'PENDENTE').length} pendentes`,
      icon: DocumentTextOutline,
      tone: current.student.status === 'DOCUMENTACAO_PENDENTE' ? 'warning' : 'brand',
      target: '#documentos',
    },
    {
      label: 'Pagamento',
      value: current.payment.status,
      helper: current.payment.amount !== null ? formatCurrency(current.payment.amount) : 'Sem valor definido',
      icon: CardOutline,
      tone: current.student.status === 'PAGAMENTO_PENDENTE' ? 'danger' : 'info',
      target: '#pagamento',
    },
    {
      label: 'Contrato',
      value: current.contract.status,
      helper: current.contract.lastLog ? formatDate(current.contract.lastLog.createdAt) : 'Sem simulação recente',
      icon: ShieldCheckmarkOutline,
      tone: current.student.status === 'CONTRATO_PENDENTE' ? 'warning' : 'brand',
      target: '#contrato',
    },
    {
      label: 'Régua',
      value: rulerStatusLabel(current.ruler.status),
      helper: current.ruler.nextDay === null ? 'Todos os marcos' : `Próximo dia ${current.ruler.nextDay}`,
      icon: PaperPlaneOutline,
      tone: current.ruler.status === 'PENDENTE' ? 'warning' : 'brand',
      target: '#mensagens',
    },
    {
      label: 'Risco',
      value: riskLabel(current.risk.level),
      helper: `${current.risk.score}/100`,
      icon: WarningOutline,
      tone: ['ALTO', 'CRITICO'].includes(current.risk.level) ? 'danger' : 'brand',
      target: '#risco',
    },
    {
      label: 'AVA',
      value: current.student.accessStatus,
      helper: current.student.ownerTeam,
      icon: LaptopOutline,
      tone: current.student.status === 'ACESSO_PENDENTE' ? 'warning' : 'brand',
      target: '#acoes',
    },
  ]
})

onMounted(() => loadProfile())

async function loadProfile(showLoading = true) {
  if (!studentId.value) return
  if (showLoading) loading.value = true
  error.value = null
  try {
    profile.value = await postSalesApi.studentProfile(studentId.value)
  } catch {
    error.value = 'Não foi possível carregar a ficha do aluno.'
  } finally {
    loading.value = false
  }
}

async function withAction(key: string, action: () => Promise<string | null | undefined>) {
  if (!profile.value || actionBusy.value) return
  actionBusy.value = key
  error.value = null
  feedback.value = null
  try {
    feedback.value = (await action()) || 'Ação registrada na ficha do aluno.'
    await loadProfile(false)
  } catch {
    error.value = 'Não foi possível executar a ação agora.'
  } finally {
    actionBusy.value = null
  }
}

function sendWhatsApp() {
  return withAction('whatsapp', async () => {
    const res = await postSalesApi.simulateMessage(studentId.value)
    return res.message
  })
}

function sendRuler() {
  return withAction('ruler', async () => {
    const res = await postSalesApi.simulateRuler(studentId.value)
    return res.result.message
  })
}

function simulatePayment(action: 'MARK_PAID' | 'FAIL' | 'REFUND' | 'PENDING') {
  return withAction(`payment-${action}`, async () => {
    const res = await postSalesApi.simulatePayment(studentId.value, action)
    const log = res.result.log as { visibleMessage?: string } | undefined
    return log?.visibleMessage
  })
}

function simulateContract(action: 'SEND' | 'VIEW' | 'SIGN' | 'EXPIRE') {
  return withAction(`contract-${action}`, async () => {
    const res = await postSalesApi.simulateContract(studentId.value, action)
    const log = res.result.log as { visibleMessage?: string } | undefined
    return log?.visibleMessage
  })
}

function simulateDocument(action: 'RECEIVE' | 'APPROVE' | 'REJECT') {
  return withAction(`document-${action}`, async () => {
    const res = await postSalesApi.simulateDocument(studentId.value, action)
    const log = res.result.log as { visibleMessage?: string } | undefined
    return log?.visibleMessage
  })
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function riskLabel(level?: string) {
  if (level === 'CRITICO') return 'Crítico'
  if (level === 'ALTO') return 'Alto'
  if (level === 'MEDIO') return 'Médio'
  return 'Baixo'
}

function rulerStatusLabel(status?: string) {
  if (status === 'PENDENTE') return 'Pendente'
  if (status === 'CONCLUIDA') return 'Concluída'
  return 'Agendada'
}

function audienceLabel(value: string) {
  const labels: Record<string, string> = {
    brasileiro: 'Brasileiro',
    estrangeiro: 'Estrangeiro',
    menor_idade: 'Menor de idade',
  }
  return labels[value] ?? value
}

function documentStatusClass(item: PostSaleProfileDocumentRequirement) {
  if (item.status === 'RECEBIDO') return 'doc-ok'
  if (item.status === 'PENDENTE') return 'doc-pending'
  return 'doc-optional'
}

function timelineIcon(event: PostSaleTimelineEvent) {
  if (event.type.includes('WHATSAPP') || event.type.includes('REGUA')) return PaperPlaneOutline
  if (event.type.includes('TASK')) return CreateOutline
  if (event.type.includes('CONTRATO')) return ShieldCheckmarkOutline
  if (event.type.includes('PAGAMENTO') || event.type.includes('FINANCEIRO')) return CardOutline
  if (event.type.includes('DOCUMENT')) return DocumentTextOutline
  return CalendarOutline
}

function serviceLabel(log: PostSaleIntegrationLog) {
  const labels: Record<PostSaleIntegrationLog['service'], string> = {
    WHATSAPP: 'WhatsApp fake',
    PAGAMENTO: 'Pagamento fake',
    CONTRATO: 'Contrato fake',
    DOCUMENTOS: 'Documentos fake',
  }
  return labels[log.service]
}

function taskTone(task: PostSaleTask) {
  if (task.priority === 'Urgente') return 'urgent'
  if (task.priority === 'Alta') return 'high'
  return 'normal'
}
</script>

<template>
  <div class="profile-page">
    <AppNav />

    <main class="profile-shell">
      <header class="profile-header">
        <div>
          <button type="button" class="back-button" @click="router.push('/post-sales')">
            Voltar ao pós-venda
          </button>
          <h1>Ficha do aluno</h1>
          <p>Hub completo da matrícula, pendências, automações fake, risco e histórico do aluno.</p>
        </div>
        <button type="button" class="refresh-button" :disabled="loading" @click="loadProfile()">
          <NIcon :component="RefreshOutline" size="16" />
          Atualizar
        </button>
      </header>

      <div v-if="loading" class="loading-state">
        <NSpin size="large" />
      </div>

      <template v-else-if="profile && student">
        <NAlert v-if="error" type="error" closable class="profile-alert" @close="error = null">
          {{ error }}
        </NAlert>
        <NAlert v-if="feedback" type="success" closable class="profile-alert" @close="feedback = null">
          {{ feedback }}
        </NAlert>

        <section class="student-hero">
          <div class="student-hero__identity">
            <span class="student-avatar">{{ student.studentName.charAt(0).toUpperCase() }}</span>
            <div>
              <span class="status-chip">{{ student.statusLabel }}</span>
              <h2>{{ student.studentName }}</h2>
              <p>{{ student.course }} · {{ student.daysSinceEnrollment }} dias de jornada</p>
            </div>
          </div>

          <div class="student-hero__risk" :class="`risk-${profile.risk.level.toLowerCase()}`" id="risco">
            <span>Score antievasão</span>
            <strong>{{ profile.risk.score }}</strong>
            <small>{{ riskLabel(profile.risk.level) }}</small>
          </div>

          <nav class="hub-nav" aria-label="Navegar pela ficha">
            <a href="#documentos">Documentos</a>
            <a href="#pagamento">Pagamento</a>
            <a href="#contrato">Contrato</a>
            <a href="#timeline">Timeline</a>
          </nav>
        </section>

        <section class="status-grid" aria-label="Resumo da ficha">
          <a v-for="card in statusCards" :key="card.label" :href="card.target" class="status-card" :class="`tone-${card.tone}`">
            <span class="status-card__icon">
              <NIcon :component="card.icon" size="18" />
            </span>
            <small>{{ card.label }}</small>
            <strong>{{ card.value }}</strong>
            <em>{{ card.helper }}</em>
          </a>
        </section>

        <section class="profile-layout">
          <div class="profile-main">
            <section class="profile-panel" id="dados">
              <div class="panel-head">
                <div>
                  <h2>Dados pessoais e matrícula</h2>
                  <p>Informações vindas da matrícula real ou do aluno de exemplo.</p>
                </div>
                <span v-if="profile.enrollment">Matrícula {{ profile.enrollment.number }}</span>
                <span v-else>Aluno de exemplo</span>
              </div>

              <div class="data-sections">
                <article v-for="group in dataSections" :key="group.title" class="data-section">
                  <h3>{{ group.title }}</h3>
                  <dl>
                    <template v-for="row in group.rows" :key="`${group.title}-${row.label}`">
                      <dt>{{ row.label }}</dt>
                      <dd>{{ row.value }}</dd>
                    </template>
                  </dl>
                </article>
              </div>

              <div class="course-strip">
                <div>
                  <span>Curso</span>
                  <strong>{{ profile.course?.name || student.course }}</strong>
                  <small>{{ profile.course?.description || 'Curso registrado na jornada do aluno.' }}</small>
                </div>
                <div>
                  <span>Duração</span>
                  <strong>{{ profile.course?.duration || '-' }}</strong>
                  <small>{{ profile.course?.modality || 'Modalidade não informada' }}</small>
                </div>
                <div>
                  <span>Matrícula</span>
                  <strong>{{ formatCurrency(profile.course?.enrollmentFee) }}</strong>
                  <small>{{ profile.course?.cashDiscountPercent ?? 0 }}% à vista</small>
                </div>
              </div>
            </section>

            <section class="profile-panel" id="documentos">
              <div class="panel-head">
                <div>
                  <h2>Documentos</h2>
                  <p>Checklist calculado com os requisitos configuráveis da escola.</p>
                </div>
                <button type="button" class="panel-action" :disabled="!!actionBusy" @click="simulateDocument('RECEIVE')">
                  {{ actionBusy === 'document-RECEIVE' ? 'Registrando...' : 'Simular recebimento' }}
                </button>
              </div>

              <div class="document-grid">
                <article v-for="item in profile.documents.requirements" :key="`${item.audience}-${item.documentType}`" class="document-row" :class="documentStatusClass(item)">
                  <div>
                    <strong>{{ item.documentType }}</strong>
                    <small>{{ audienceLabel(item.audience) }} · {{ item.required ? 'Obrigatório' : 'Opcional' }}</small>
                    <p>{{ item.instructions || 'Sem instrução adicional.' }}</p>
                  </div>
                  <span>{{ item.status }}</span>
                </article>
              </div>

              <div class="checklist-strip">
                <div v-for="step in profile.documents.checklist" :key="step.key" class="check-item" :class="`check-${step.status}`">
                  <NIcon :component="step.status === 'done' ? CheckmarkCircleOutline : TimeOutline" size="15" />
                  <div>
                    <strong>{{ step.label }}</strong>
                    <small>{{ step.helper }}</small>
                  </div>
                </div>
              </div>
            </section>

            <section class="ops-grid">
              <article class="profile-panel ops-panel" id="pagamento">
                <div class="panel-head panel-head--tight">
                  <div>
                    <h2>Pagamento fake</h2>
                    <p>Estados simulados sem cobrança real.</p>
                  </div>
                </div>
                <div class="ops-status">
                  <span>Status atual</span>
                  <strong>{{ profile.payment.status }}</strong>
                  <small>{{ formatCurrency(profile.payment.amount) }} · {{ profile.payment.method || 'método não definido' }}</small>
                </div>
                <div class="ops-buttons">
                  <button type="button" :disabled="!!actionBusy" @click="simulatePayment('MARK_PAID')">Pago</button>
                  <button type="button" :disabled="!!actionBusy" @click="simulatePayment('FAIL')">Falhou</button>
                  <button type="button" :disabled="!!actionBusy" @click="simulatePayment('REFUND')">Estornado</button>
                </div>
                <p v-if="profile.payment.lastLog" class="last-log">{{ profile.payment.lastLog.visibleMessage }}</p>
              </article>

              <article class="profile-panel ops-panel" id="contrato">
                <div class="panel-head panel-head--tight">
                  <div>
                    <h2>Contrato fake</h2>
                    <p>Assinatura simulada sem D4Sign.</p>
                  </div>
                </div>
                <div class="ops-status">
                  <span>Status atual</span>
                  <strong>{{ profile.contract.status }}</strong>
                  <small>{{ profile.contract.lastLog ? formatDate(profile.contract.lastLog.createdAt) : 'sem evento recente' }}</small>
                </div>
                <div class="ops-buttons">
                  <button type="button" :disabled="!!actionBusy" @click="simulateContract('SEND')">Enviar</button>
                  <button type="button" :disabled="!!actionBusy" @click="simulateContract('VIEW')">Visualizar</button>
                  <button type="button" :disabled="!!actionBusy" @click="simulateContract('SIGN')">Assinar</button>
                </div>
                <p v-if="profile.contract.lastLog" class="last-log">{{ profile.contract.lastLog.visibleMessage }}</p>
              </article>
            </section>

            <section class="profile-panel" id="mensagens">
              <div class="panel-head">
                <div>
                  <h2>Histórico de mensagens</h2>
                  <p>Mensagens do WhatsApp fake e da régua de pós-venda.</p>
                </div>
                <div class="message-actions">
                  <button type="button" :disabled="!!actionBusy" @click="sendWhatsApp">
                    {{ actionBusy === 'whatsapp' ? 'Gerando...' : 'WhatsApp fake' }}
                  </button>
                  <button type="button" :disabled="!!actionBusy || profile.ruler.status === 'CONCLUIDA'" @click="sendRuler">
                    {{ actionBusy === 'ruler' ? 'Disparando...' : 'Disparar régua' }}
                  </button>
                </div>
              </div>

              <div v-if="profile.messages.length" class="message-list">
                <article v-for="message in profile.messages" :key="message.id" class="message-row">
                  <span>{{ serviceLabel(message) }}</span>
                  <strong>{{ message.visibleMessage }}</strong>
                  <small>{{ message.status }} · {{ formatDate(message.createdAt) }}</small>
                </article>
              </div>
              <div v-else class="empty-box">
                <NIcon :component="ChatbubbleEllipsesOutline" size="20" />
                <strong>Nenhuma mensagem simulada ainda</strong>
                <p>Use o botão de WhatsApp fake ou régua para registrar o primeiro contato.</p>
              </div>
            </section>

            <section class="profile-panel" id="timeline">
              <div class="panel-head">
                <div>
                  <h2>Timeline completa</h2>
                  <p>Eventos em ordem cronológica da matrícula até a última automação.</p>
                </div>
              </div>
              <div class="timeline-list">
                <article v-for="event in profile.timeline" :key="event.id" class="timeline-item">
                  <span class="timeline-icon">
                    <NIcon :component="timelineIcon(event)" size="15" />
                  </span>
                  <div>
                    <small>{{ formatDate(event.createdAt) }} · {{ event.source === 'manual' ? 'equipe' : 'sistema' }}</small>
                    <strong>{{ event.title }}</strong>
                    <p>{{ event.description }}</p>
                  </div>
                </article>
              </div>
            </section>
          </div>

          <aside class="profile-side">
            <section class="profile-panel side-panel" id="acoes">
              <div class="panel-head panel-head--tight">
                <div>
                  <h2>Próximas ações</h2>
                  <p>Fila recomendada pelo estado real da jornada.</p>
                </div>
              </div>
              <div class="action-list">
                <article v-for="task in profile.nextActions" :key="task.id" class="action-row" :class="`task-${taskTone(task)}`">
                  <span>{{ task.priority }}</span>
                  <strong>{{ task.title }}</strong>
                  <small>{{ task.ownerTeam }} · {{ formatDate(task.dueAt) }}</small>
                </article>
              </div>
            </section>

            <section class="profile-panel side-panel">
              <div class="panel-head panel-head--tight">
                <div>
                  <h2>Razões do risco</h2>
                  <p>Por que o aluno precisa ou não de atenção.</p>
                </div>
              </div>
              <ul class="risk-list">
                <li v-for="reason in profile.risk.reasons" :key="reason">{{ reason }}</li>
              </ul>
            </section>

            <section class="profile-panel side-panel">
              <div class="panel-head panel-head--tight">
                <div>
                  <h2>Ações rápidas</h2>
                  <p>Hub para demonstrar documentos, contrato e financeiro.</p>
                </div>
              </div>
              <div class="side-actions">
                <a href="#documentos">Ir para documentos</a>
                <a href="#pagamento">Ir para pagamento</a>
                <a href="#contrato">Ir para contrato</a>
                <button type="button" :disabled="!!actionBusy" @click="simulateDocument('APPROVE')">Aprovar documentos</button>
                <button type="button" :disabled="!!actionBusy" @click="simulateDocument('REJECT')">Recusar documentos</button>
              </div>
            </section>
          </aside>
        </section>
      </template>

      <NAlert v-else-if="error" type="error">
        {{ error }}
      </NAlert>
    </main>
  </div>
</template>

<style scoped>
.profile-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--app-bg);
}

.profile-shell {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px 32px;
  scroll-behavior: smooth;
}

.profile-header,
.student-hero,
.panel-head,
.hub-nav,
.message-actions,
.ops-buttons {
  display: flex;
  align-items: center;
}

.profile-header {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.back-button {
  min-height: 28px;
  margin-bottom: 8px;
  border: 0;
  padding: 0;
  color: var(--brand);
  background: transparent;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.profile-header h1 {
  margin: 0;
  color: var(--text);
  font-size: 24px;
  font-weight: 900;
}

.profile-header p,
.panel-head p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

.refresh-button,
.panel-action,
.message-actions button,
.ops-buttons button,
.side-actions button,
.side-actions a {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 11px;
  color: var(--text-soft);
  background: var(--surface-raised);
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
  cursor: pointer;
}

.refresh-button:hover,
.panel-action:hover,
.message-actions button:hover,
.ops-buttons button:hover,
.side-actions button:hover,
.side-actions a:hover {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 35%, var(--border));
  background: var(--brand-soft);
}

.refresh-button:disabled,
.panel-action:disabled,
.message-actions button:disabled,
.ops-buttons button:disabled,
.side-actions button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.loading-state {
  min-height: 420px;
  display: grid;
  place-items: center;
}

.profile-alert {
  margin-bottom: 14px;
}

.student-hero {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
}

.student-hero__identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 14px;
}

.student-avatar {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 8px;
  color: #fff;
  background: var(--brand);
  font-size: 18px;
  font-weight: 900;
}

.status-chip {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 8px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.student-hero h2 {
  margin: 6px 0 4px;
  color: var(--text);
  font-size: 24px;
  font-weight: 900;
}

.student-hero p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.student-hero__risk {
  min-width: 128px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  text-align: center;
}

.student-hero__risk span,
.student-hero__risk small {
  display: block;
  color: var(--muted);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.student-hero__risk strong {
  display: block;
  margin: 4px 0;
  color: var(--text);
  font-size: 34px;
  font-weight: 900;
  line-height: 1;
}

.risk-alto,
.risk-critico {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border));
  background: var(--danger-soft);
}

.risk-medio {
  border-color: color-mix(in srgb, var(--warning) 32%, var(--border));
  background: var(--warning-soft);
}

.hub-nav {
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hub-nav a {
  min-height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--muted-strong);
  background: var(--surface);
  font-size: 11px;
  font-weight: 900;
  text-decoration: none;
}

.hub-nav a:hover {
  color: var(--brand);
  background: var(--brand-soft);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.status-card {
  min-height: 134px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 13px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
  text-decoration: none;
}

.status-card__icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--brand);
  background: var(--brand-soft);
}

.status-card small,
.status-card em {
  color: var(--muted);
  font-size: 11px;
  font-style: normal;
}

.status-card small {
  margin-top: 12px;
  font-weight: 900;
}

.status-card strong {
  display: -webkit-box;
  min-height: 36px;
  margin-top: 5px;
  overflow: hidden;
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
  line-height: 1.3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.status-card em {
  margin-top: auto;
}

.tone-warning .status-card__icon {
  color: var(--warning);
  background: var(--warning-soft);
}

.tone-danger .status-card__icon {
  color: var(--danger);
  background: var(--danger-soft);
}

.tone-info .status-card__icon {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 12%, transparent);
}

.profile-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.36fr);
  gap: 16px;
  align-items: start;
}

.profile-main,
.profile-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.profile-panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 18px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
}

.panel-head {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-head--tight {
  margin-bottom: 12px;
}

.panel-head h2 {
  margin: 0;
  color: var(--text);
  font-size: 16px;
  font-weight: 900;
}

.panel-head > span {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 6px 10px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 11px;
  font-weight: 900;
}

.data-sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.data-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 13px;
  background: var(--surface);
}

.data-section h3 {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.data-section dl {
  display: grid;
  grid-template-columns: minmax(110px, 0.45fr) minmax(0, 1fr);
  gap: 8px 10px;
  margin: 0;
}

.data-section dt {
  color: var(--muted);
  font-size: 11px;
  font-weight: 900;
}

.data-section dd {
  min-width: 0;
  margin: 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.course-strip {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.8fr;
  gap: 10px;
  margin-top: 12px;
}

.course-strip div {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface-soft);
}

.course-strip span,
.course-strip small,
.ops-status span,
.ops-status small {
  display: block;
  color: var(--muted);
  font-size: 11px;
}

.course-strip span,
.ops-status span {
  font-weight: 900;
  text-transform: uppercase;
}

.course-strip strong,
.ops-status strong {
  display: block;
  margin: 5px 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 900;
}

.document-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.document-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface);
}

.document-row strong,
.document-row small,
.document-row p {
  display: block;
}

.document-row strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.document-row small,
.document-row p {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
}

.document-row p {
  margin: 5px 0 0;
}

.document-row > span {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 900;
}

.doc-ok > span {
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent-strong) 12%, transparent);
}

.doc-pending > span {
  color: var(--warning);
  background: var(--warning-soft);
}

.doc-optional > span {
  color: var(--muted-strong);
  background: var(--surface-muted);
}

.checklist-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.check-item {
  display: flex;
  gap: 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  background: var(--surface-soft);
}

.check-item > .n-icon {
  flex-shrink: 0;
  color: var(--brand);
  margin-top: 2px;
}

.check-item strong,
.check-item small {
  display: block;
}

.check-item strong {
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
}

.check-item small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
}

.check-attention > .n-icon,
.check-blocked > .n-icon {
  color: var(--danger);
}

.ops-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ops-panel {
  min-height: 260px;
}

.ops-status {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface);
}

.ops-buttons {
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.last-log {
  margin: 10px 0 0;
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.45;
}

.message-actions {
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-row {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface);
}

.message-row span {
  display: inline-flex;
  margin-bottom: 7px;
  border-radius: 999px;
  padding: 3px 7px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 10px;
  font-weight: 900;
}

.message-row strong,
.message-row small {
  display: block;
}

.message-row strong {
  color: var(--text);
  font-size: 13px;
  line-height: 1.4;
}

.message-row small {
  margin-top: 6px;
  color: var(--muted);
  font-size: 11px;
}

.empty-box {
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

.empty-box > .n-icon {
  color: var(--brand);
}

.empty-box strong {
  color: var(--text);
  font-size: 14px;
}

.empty-box p {
  max-width: 360px;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}

.timeline-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 10px;
}

.timeline-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: var(--brand);
  background: var(--brand-soft);
}

.timeline-item small,
.timeline-item strong,
.timeline-item p {
  display: block;
}

.timeline-item small {
  color: var(--muted);
  font-size: 11px;
}

.timeline-item strong {
  margin-top: 3px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.timeline-item p {
  margin: 4px 0 0;
  color: var(--muted-strong);
  font-size: 12px;
  line-height: 1.4;
}

.side-panel {
  padding: 15px;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-row {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 11px;
  background: var(--surface);
}

.action-row span {
  display: inline-flex;
  margin-bottom: 7px;
  border-radius: 999px;
  padding: 3px 7px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 10px;
  font-weight: 900;
}

.task-high span,
.task-urgent span {
  color: var(--danger);
  background: var(--danger-soft);
}

.action-row strong,
.action-row small {
  display: block;
}

.action-row strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.action-row small {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}

.risk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.risk-list li {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  color: var(--muted-strong);
  background: var(--surface);
  font-size: 12px;
  line-height: 1.4;
}

.side-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

@media (max-width: 1180px) {
  .status-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .profile-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .profile-shell {
    padding: 14px;
  }

  .profile-header,
  .student-hero,
  .panel-head {
    align-items: stretch;
    flex-direction: column;
  }

  .student-hero__identity {
    align-items: flex-start;
  }

  .hub-nav,
  .message-actions {
    justify-content: flex-start;
  }

  .status-grid,
  .data-sections,
  .course-strip,
  .document-grid,
  .checklist-strip,
  .ops-grid {
    grid-template-columns: 1fr;
  }

  .data-section dl {
    grid-template-columns: 1fr;
  }
}
</style>
