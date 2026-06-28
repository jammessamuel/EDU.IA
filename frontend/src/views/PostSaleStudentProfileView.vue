<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAlert, NIcon, NSpin } from 'naive-ui'
import {
  CalendarOutline,
  CardOutline,
  ChatbubbleEllipsesOutline,
  CheckmarkCircleOutline,
  CreateOutline,
  DocumentTextOutline,
  DownloadOutline,
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
import { schoolConfigApi, type CommercialPdfKind } from '@/api/schoolConfig'
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
const pdfBusy = ref<CommercialPdfKind | null>(null)
const rejectDocumentType = ref<string | null>(null)
const rejectReason = ref('')
const validationDraft = ref({
  documentType: 'CPF',
  documentNumber: '',
  email: '',
  phone: '',
})

const studentId = computed(() => String(route.params.studentId ?? ''))
const student = computed(() => profile.value?.student ?? null)

const commercialMaterials: Array<{ kind: CommercialPdfKind; title: string; filename: string }> = [
  { kind: 'catalogo-cursos', title: 'Catálogo de cursos', filename: 'catalogo-de-cursos.pdf' },
  { kind: 'tabela-descontos', title: 'Tabela de descontos', filename: 'tabela-de-descontos.pdf' },
  { kind: 'fluxo-matricula', title: 'Fluxo de matrícula', filename: 'fluxo-de-matricula.pdf' },
]

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
  const documentHelper = current.documents.summary.rejected
    ? `${current.documents.summary.rejected} recusado(s)`
    : `${current.documents.summary.pending} pendentes`
  return [
    {
      label: 'Documentos',
      value: current.student.documentStatus,
      helper: documentHelper,
      icon: DocumentTextOutline,
      tone: current.documents.summary.rejected
        ? 'danger'
        : current.student.status === 'DOCUMENTACAO_PENDENTE'
          ? 'warning'
          : 'brand',
      target: '#documentos',
    },
    {
      label: 'Pagamento',
      value: current.payment.status,
      helper:
        current.payment.amount !== null
          ? formatCurrency(current.payment.amount)
          : 'Sem valor definido',
      icon: CardOutline,
      tone: current.student.status === 'PAGAMENTO_PENDENTE' ? 'danger' : 'info',
      target: '#pagamento',
    },
    {
      label: 'Contrato',
      value: current.contract.status,
      helper: current.contract.lastLog
        ? formatDate(current.contract.lastLog.createdAt)
        : 'Sem simulação recente',
      icon: ShieldCheckmarkOutline,
      tone: current.student.status === 'CONTRATO_PENDENTE' ? 'warning' : 'brand',
      target: '#contrato',
    },
    {
      label: 'Régua',
      value: rulerStatusLabel(current.ruler.status),
      helper:
        current.ruler.nextDay === null ? 'Todos os marcos' : `Próximo dia ${current.ruler.nextDay}`,
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

const validationChecks = computed(() => {
  const documentType = validationDraft.value.documentType
  const documentNumber = validationDraft.value.documentNumber.trim()
  const isCpf = normalizeText(documentType).includes('cpf')
  const isPassport = /passaporte|passport|pasaporte/i.test(documentType)
  return [
    {
      key: 'document',
      label: isCpf ? 'CPF' : isPassport ? 'Passaporte' : 'Documento',
      value: documentNumber || 'Não informado',
      ok: isCpf ? isValidCpf(documentNumber) : validateInternationalDocument(documentNumber),
      message: isCpf
        ? isValidCpf(documentNumber)
          ? 'CPF válido.'
          : 'CPF inválido ou incompleto.'
        : validateInternationalDocument(documentNumber)
          ? 'Documento estrangeiro com formato aceitável.'
          : 'Informe ao menos 5 caracteres com letras ou números.',
    },
    {
      key: 'email',
      label: 'E-mail',
      value: validationDraft.value.email || 'Não informado',
      ok: isValidEmail(validationDraft.value.email),
      message: isValidEmail(validationDraft.value.email)
        ? 'E-mail válido.'
        : 'Formato de e-mail inválido.',
    },
    {
      key: 'phone',
      label: 'Telefone',
      value: validationDraft.value.phone || 'Não informado',
      ok: isValidPhone(validationDraft.value.phone),
      message: isValidPhone(validationDraft.value.phone)
        ? 'Telefone válido.'
        : 'Use DDD + número, com 10 a 15 dígitos.',
    },
  ]
})

onMounted(() => loadProfile())

watch(profile, (current) => {
  if (!current) return
  validationDraft.value = {
    documentType: current.enrollment?.documentType || 'CPF',
    documentNumber: current.enrollment?.documentNumber || current.enrollment?.cpf || '',
    email: current.enrollment?.email || '',
    phone: current.enrollment?.phone || '',
  }
})

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

function simulateDocument(
  action: 'RECEIVE' | 'APPROVE' | 'REJECT',
  input: { documentType?: string; reason?: string; fileName?: string } = {},
) {
  return withAction(docActionKey(action, input.documentType), async () => {
    const res = await postSalesApi.simulateDocument(studentId.value, action, input)
    const log = res.result.log as { visibleMessage?: string } | undefined
    return log?.visibleMessage
  })
}

function uploadFakeDocument(item: PostSaleProfileDocumentRequirement) {
  return simulateDocument('RECEIVE', {
    documentType: item.documentType,
    fileName: fakeFileName(item.documentType),
  })
}

function approveDocument(item: PostSaleProfileDocumentRequirement) {
  return simulateDocument('APPROVE', { documentType: item.documentType })
}

function startReject(item: PostSaleProfileDocumentRequirement) {
  rejectDocumentType.value = item.documentType
  rejectReason.value = item.reason || ''
  error.value = null
}

function cancelReject() {
  rejectDocumentType.value = null
  rejectReason.value = ''
}

async function confirmReject(item: PostSaleProfileDocumentRequirement) {
  if (!rejectReason.value.trim()) {
    error.value = 'Informe o motivo da recusa antes de registrar.'
    return
  }
  await simulateDocument('REJECT', {
    documentType: item.documentType,
    reason: rejectReason.value.trim(),
  })
  cancelReject()
}

async function downloadCommercialPdf(material: (typeof commercialMaterials)[number]) {
  if (pdfBusy.value) return
  pdfBusy.value = material.kind
  error.value = null
  feedback.value = null
  try {
    await schoolConfigApi.downloadCommercialPdf(material.kind, material.filename)
    feedback.value = `PDF "${material.title}" gerado para envio ao aluno.`
  } catch {
    error.value = 'Não foi possível gerar o PDF comercial agora.'
  } finally {
    pdfBusy.value = null
  }
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
  if (item.status === 'APROVADO') return 'doc-approved'
  if (item.status === 'RECEBIDO') return 'doc-ok'
  if (item.status === 'RECUSADO') return 'doc-rejected'
  if (item.status === 'PENDENTE') return 'doc-pending'
  return 'doc-optional'
}

function documentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    RECEBIDO: 'Recebido',
    APROVADO: 'Aprovado',
    RECUSADO: 'Recusado',
    PENDENTE: 'Pendente',
    OPCIONAL: 'Opcional',
  }
  return labels[status] ?? status
}

function docActionKey(action: string, documentType?: string) {
  return `document-${action}-${normalizeText(documentType || 'pacote')}`
}

function fakeFileName(documentType: string) {
  const slug = normalizeText(documentType)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'documento'}-fake.pdf`
}

function validationTone(ok: boolean) {
  return ok ? 'valid-ok' : 'valid-error'
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
    ALERTAS: 'Alertas fake',
  }
  return labels[log.service]
}

function taskTone(task: PostSaleTask) {
  if (task.priority === 'Urgente') return 'urgent'
  if (task.priority === 'Alta') return 'high'
  return 'normal'
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function isValidCpf(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (factor: number) => {
    let total = 0
    for (let i = 0; i < factor - 1; i += 1) total += Number(cpf[i]) * (factor - i)
    const mod = (total * 10) % 11
    return mod === 10 ? 0 : mod
  }
  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10])
}

function validateInternationalDocument(value: string) {
  const normalized = value.replace(/[^a-z0-9]/gi, '')
  return normalized.length >= 5 && normalized.length <= 20
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

function isValidPhone(value: string) {
  const digits = onlyDigits(value)
  return digits.length >= 10 && digits.length <= 15
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
        <NAlert
          v-if="feedback"
          type="success"
          closable
          class="profile-alert"
          @close="feedback = null"
        >
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

          <div
            class="student-hero__risk"
            :class="`risk-${profile.risk.level.toLowerCase()}`"
            id="risco"
          >
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
          <a
            v-for="card in statusCards"
            :key="card.label"
            :href="card.target"
            class="status-card"
            :class="`tone-${card.tone}`"
          >
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

              <div class="validation-panel">
                <div class="validation-panel__head">
                  <div>
                    <h3>Validação em tempo real</h3>
                    <p>
                      Teste CPF, passaporte/documento estrangeiro, e-mail e telefone sem salvar
                      nada.
                    </p>
                  </div>
                </div>
                <div class="validation-form">
                  <label>
                    <span>Tipo</span>
                    <select v-model="validationDraft.documentType">
                      <option>CPF</option>
                      <option>Passaporte</option>
                      <option>SSN</option>
                      <option>Driver License</option>
                      <option>State ID</option>
                      <option>NIE</option>
                      <option>DNI</option>
                    </select>
                  </label>
                  <label>
                    <span>Número do documento</span>
                    <input
                      v-model="validationDraft.documentNumber"
                      type="text"
                      placeholder="CPF, passaporte ou documento estrangeiro"
                    />
                  </label>
                  <label>
                    <span>E-mail</span>
                    <input
                      v-model="validationDraft.email"
                      type="email"
                      placeholder="aluno@email.com"
                    />
                  </label>
                  <label>
                    <span>Telefone</span>
                    <input
                      v-model="validationDraft.phone"
                      type="tel"
                      placeholder="+55 11 99999-9999"
                    />
                  </label>
                </div>
                <div class="validation-results">
                  <article
                    v-for="check in validationChecks"
                    :key="check.key"
                    :class="validationTone(check.ok)"
                  >
                    <strong>{{ check.label }}</strong>
                    <span>{{ check.ok ? 'Válido' : 'Atenção' }}</span>
                    <p>{{ check.message }}</p>
                  </article>
                </div>
              </div>

              <div class="course-strip">
                <div>
                  <span>Curso</span>
                  <strong>{{ profile.course?.name || student.course }}</strong>
                  <small>{{
                    profile.course?.description || 'Curso registrado na jornada do aluno.'
                  }}</small>
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
                <div class="document-summary">
                  <span>{{ profile.documents.summary.pending }} pendentes</span>
                  <span>{{ profile.documents.summary.received }} recebidos</span>
                  <span>{{ profile.documents.summary.approved }} aprovados</span>
                  <span>{{ profile.documents.summary.rejected }} recusados</span>
                </div>
              </div>

              <div class="document-grid">
                <article
                  v-for="item in profile.documents.requirements"
                  :key="`${item.audience}-${item.documentType}`"
                  class="document-row"
                  :class="documentStatusClass(item)"
                >
                  <div class="document-row__main">
                    <div class="document-row__top">
                      <div>
                        <strong>{{ item.documentType }}</strong>
                        <small
                          >{{ audienceLabel(item.audience) }} ·
                          {{ item.required ? 'Obrigatório' : 'Opcional' }}</small
                        >
                      </div>
                      <span>{{ documentStatusLabel(item.status) }}</span>
                    </div>
                    <p>{{ item.instructions || 'Sem instrução adicional.' }}</p>
                    <small v-if="item.fileName" class="document-file"
                      >Arquivo: {{ item.fileName }}</small
                    >
                    <small v-if="item.reason" class="document-reason"
                      >Motivo: {{ item.reason }}</small
                    >
                    <div class="document-actions">
                      <button
                        type="button"
                        :disabled="!!actionBusy"
                        @click="uploadFakeDocument(item)"
                      >
                        {{
                          actionBusy === docActionKey('RECEIVE', item.documentType)
                            ? '...'
                            : 'Upload fake'
                        }}
                      </button>
                      <button type="button" :disabled="!!actionBusy" @click="approveDocument(item)">
                        {{
                          actionBusy === docActionKey('APPROVE', item.documentType)
                            ? '...'
                            : 'Aprovar'
                        }}
                      </button>
                      <button type="button" :disabled="!!actionBusy" @click="startReject(item)">
                        Recusar
                      </button>
                    </div>
                    <div v-if="rejectDocumentType === item.documentType" class="reject-form">
                      <label>
                        <span>Motivo da recusa</span>
                        <textarea
                          v-model="rejectReason"
                          rows="2"
                          placeholder="Ex.: imagem ilegível, documento vencido ou arquivo incompleto"
                        ></textarea>
                      </label>
                      <div>
                        <button
                          type="button"
                          :disabled="!!actionBusy || !rejectReason.trim()"
                          @click="confirmReject(item)"
                        >
                          {{
                            actionBusy === docActionKey('REJECT', item.documentType)
                              ? 'Registrando...'
                              : 'Confirmar recusa'
                          }}
                        </button>
                        <button type="button" :disabled="!!actionBusy" @click="cancelReject">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <div class="checklist-strip">
                <div
                  v-for="step in profile.documents.checklist"
                  :key="step.key"
                  class="check-item"
                  :class="`check-${step.status}`"
                >
                  <NIcon
                    :component="step.status === 'done' ? CheckmarkCircleOutline : TimeOutline"
                    size="15"
                  />
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
                  <small
                    >{{ formatCurrency(profile.payment.amount) }} ·
                    {{ profile.payment.method || 'método não definido' }}</small
                  >
                </div>
                <div class="ops-buttons">
                  <button
                    type="button"
                    :disabled="!!actionBusy"
                    @click="simulatePayment('MARK_PAID')"
                  >
                    Pago
                  </button>
                  <button type="button" :disabled="!!actionBusy" @click="simulatePayment('FAIL')">
                    Falhou
                  </button>
                  <button type="button" :disabled="!!actionBusy" @click="simulatePayment('REFUND')">
                    Estornado
                  </button>
                </div>
                <p v-if="profile.payment.lastLog" class="last-log">
                  {{ profile.payment.lastLog.visibleMessage }}
                </p>
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
                  <small>{{
                    profile.contract.lastLog
                      ? formatDate(profile.contract.lastLog.createdAt)
                      : 'sem evento recente'
                  }}</small>
                </div>
                <div class="ops-buttons">
                  <button type="button" :disabled="!!actionBusy" @click="simulateContract('SEND')">
                    Enviar
                  </button>
                  <button type="button" :disabled="!!actionBusy" @click="simulateContract('VIEW')">
                    Visualizar
                  </button>
                  <button type="button" :disabled="!!actionBusy" @click="simulateContract('SIGN')">
                    Assinar
                  </button>
                </div>
                <p v-if="profile.contract.lastLog" class="last-log">
                  {{ profile.contract.lastLog.visibleMessage }}
                </p>
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
                  <button
                    type="button"
                    :disabled="!!actionBusy || profile.ruler.status === 'CONCLUIDA'"
                    @click="sendRuler"
                  >
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
                    <small
                      >{{ formatDate(event.createdAt) }} ·
                      {{ event.source === 'manual' ? 'equipe' : 'sistema' }}</small
                    >
                    <strong>{{ event.title }}</strong>
                    <p>{{ event.description }}</p>
                  </div>
                </article>
              </div>
            </section>
          </div>

          <aside class="profile-side">
            <section class="profile-panel side-panel">
              <div class="panel-head panel-head--tight">
                <div>
                  <h2>Materiais comerciais</h2>
                  <p>PDFs configuráveis para enviar durante o atendimento.</p>
                </div>
              </div>
              <div class="material-downloads">
                <button
                  v-for="material in commercialMaterials"
                  :key="material.kind"
                  type="button"
                  :disabled="!!pdfBusy"
                  @click="downloadCommercialPdf(material)"
                >
                  <NIcon :component="DownloadOutline" size="15" />
                  {{ pdfBusy === material.kind ? 'Gerando...' : material.title }}
                </button>
              </div>
            </section>

            <section class="profile-panel side-panel" id="acoes">
              <div class="panel-head panel-head--tight">
                <div>
                  <h2>Próximas ações</h2>
                  <p>Fila recomendada pelo estado real da jornada.</p>
                </div>
              </div>
              <div class="action-list">
                <article
                  v-for="task in profile.nextActions"
                  :key="task.id"
                  class="action-row"
                  :class="`task-${taskTone(task)}`"
                >
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
                <button type="button" :disabled="!!actionBusy" @click="simulateDocument('APPROVE')">
                  Aprovar documentos
                </button>
                <a href="#documentos">Recusar documento</a>
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
.material-downloads button,
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
.material-downloads button:hover,
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
.material-downloads button:disabled,
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

.validation-panel {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 13px;
  background: var(--surface-soft);
}

.validation-panel__head h3 {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 900;
}

.validation-panel__head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.validation-form {
  display: grid;
  grid-template-columns: 150px repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.validation-form label,
.reject-form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.validation-form span,
.reject-form span {
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 900;
}

.validation-form input,
.validation-form select,
.reject-form textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  background: var(--input-bg);
  font-size: 12px;
}

.validation-form input,
.validation-form select {
  height: 36px;
  padding: 0 9px;
}

.reject-form textarea {
  resize: vertical;
  padding: 8px 9px;
}

.validation-results {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.validation-results article {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  background: var(--surface);
}

.validation-results strong,
.validation-results span,
.validation-results p {
  display: block;
}

.validation-results strong {
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
}

.validation-results span {
  width: fit-content;
  margin-top: 5px;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 900;
}

.validation-results p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
}

.valid-ok span {
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent-strong) 12%, transparent);
}

.valid-error span {
  color: var(--danger);
  background: var(--danger-soft);
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

.document-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.document-summary span {
  border-radius: 999px;
  padding: 5px 8px;
  color: var(--brand);
  background: var(--brand-soft);
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.document-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.document-row {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface);
}

.document-row__main {
  min-width: 0;
}

.document-row__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
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

.document-row__top > span {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 900;
}

.doc-ok .document-row__top > span,
.doc-approved .document-row__top > span {
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent-strong) 12%, transparent);
}

.doc-pending .document-row__top > span {
  color: var(--warning);
  background: var(--warning-soft);
}

.doc-rejected .document-row__top > span {
  color: var(--danger);
  background: var(--danger-soft);
}

.doc-optional .document-row__top > span {
  color: var(--muted-strong);
  background: var(--surface-muted);
}

.document-file,
.document-reason {
  margin-top: 6px;
}

.document-reason {
  color: var(--danger) !important;
}

.document-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.document-actions button,
.reject-form button {
  min-height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 8px;
  color: var(--text-soft);
  background: var(--surface-soft);
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
}

.document-actions button:hover,
.reject-form button:hover {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 36%, var(--border));
  background: var(--brand-soft);
}

.document-actions button:disabled,
.reject-form button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.reject-form {
  margin-top: 10px;
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
  border-radius: 8px;
  padding: 10px;
  background: var(--danger-soft);
}

.reject-form > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
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

.material-downloads,
.side-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.material-downloads button {
  justify-content: flex-start;
  min-height: 42px;
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
  .validation-form,
  .validation-results,
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
