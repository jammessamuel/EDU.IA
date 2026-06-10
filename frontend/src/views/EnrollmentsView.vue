<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { NAlert, NScrollbar } from 'naive-ui'
import AppNav from '@/components/layout/AppNav.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import { enrollmentApi } from '@/api/enrollments'
import type { ChatMessage, Enrollment, EnrollmentDocument, EnrollmentField, HistoryMessage } from '@/types'

const messages = ref<ChatMessage[]>([
  {
    id: 'welcome',
    from: 'ai',
    text:
      'Oi! Eu sou da secretaria de matrículas. Posso fazer sua matrícula completa por aqui, com validação dos dados, pagamento simulado e comprovante em PDF. Quer começar?',
    timestamp: new Date(),
  },
])

const fields = ref<EnrollmentField[]>([])
const enrollments = ref<Enrollment[]>([])
const documents = ref<EnrollmentDocument[]>([])
const selected = ref<Enrollment | null>(null)
const draft = ref<Record<string, unknown>>({})
const isTyping = ref(false)
const isSending = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const docType = ref('RG')
const docFile = ref<File | null>(null)
const uploadBusy = ref(false)

const requiredCount = computed(() => fields.value.filter((f) => f.required).length)
const collectedRequiredCount = computed(() =>
  fields.value.filter((f) => f.required && String(draft.value[f.name] ?? '').trim()).length,
)
const progress = computed(() => {
  if (!requiredCount.value) return 0
  return Math.round((collectedRequiredCount.value / requiredCount.value) * 100)
})

const detailRows = computed(() => {
  if (!selected.value) return []
  const data = selected.value.data || {}
  return fields.value
    .map((field) => ({
      label: field.label,
      value: String(data[field.name] ?? selected.value?.[field.name as keyof Enrollment] ?? '').trim(),
    }))
    .filter((row) => row.value)
})

onMounted(async () => {
  await Promise.all([loadFields(), loadEnrollments()])
})

async function loadFields() {
  try {
    const res = await enrollmentApi.fields()
    fields.value = res.fields
  } catch {
    error.value = 'Não foi possível carregar os campos de matrícula.'
  }
}

async function loadEnrollments() {
  isLoading.value = true
  try {
    enrollments.value = await enrollmentApi.list()
    if (!selected.value && enrollments.value[0]) await selectEnrollment(enrollments.value[0])
  } catch {
    error.value = 'Não foi possível carregar as matrículas.'
  } finally {
    isLoading.value = false
  }
}

async function selectEnrollment(enrollment: Enrollment) {
  selected.value = enrollment
  try {
    documents.value = await enrollmentApi.documents(enrollment.id)
  } catch {
    documents.value = []
  }
}

async function sendEnrollmentMessage(text: string) {
  if (!text.trim() || isSending.value) return

  const history: HistoryMessage[] = messages.value.map((message) => ({
    role: message.from === 'user' ? 'user' : 'assistant',
    content: message.text,
  }))

  messages.value.push({
    id: crypto.randomUUID(),
    from: 'user',
    text: text.trim(),
    timestamp: new Date(),
  })

  error.value = null
  isSending.value = true
  await delay(450)
  isTyping.value = true
  await nextTick()

  const startedAt = Date.now()
  try {
    const res = await enrollmentApi.chat({ text: text.trim(), history, draft: draft.value })
    const elapsed = Date.now() - startedAt
    if (elapsed < 1300) await delay(1300 - elapsed)

    draft.value = res.draft || draft.value
    messages.value.push({
      id: crypto.randomUUID(),
      from: 'ai',
      text: res.reply,
      timestamp: new Date(),
    })

    if (res.enrollment) {
      selected.value = res.enrollment
      await loadEnrollments()
      await selectEnrollment(res.enrollment)
    }
  } catch (err: any) {
    const message =
      err?.response?.data?.message ||
      'O atendente de matrícula não respondeu agora. Verifique a chave da OpenAI e tente novamente.'
    messages.value.push({
      id: crypto.randomUUID(),
      from: 'ai',
      text: `Não consegui continuar a matrícula: ${message}`,
      timestamp: new Date(),
    })
  } finally {
    isTyping.value = false
    isSending.value = false
  }
}

function resetChat() {
  draft.value = {}
  messages.value = [
    {
      id: crypto.randomUUID(),
      from: 'ai',
      text:
        'Perfeito, vamos começar uma nova matrícula. Antes de seguir, seus dados serão usados apenas para a matrícula, combinado?',
      timestamp: new Date(),
    },
  ]
  error.value = null
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  docFile.value = input.files?.[0] ?? null
}

async function uploadDocument() {
  if (!selected.value || !docFile.value || uploadBusy.value) return
  uploadBusy.value = true
  try {
    const doc = await enrollmentApi.uploadDocument(selected.value.id, docType.value, docFile.value)
    documents.value.unshift(doc)
    docFile.value = null
    const input = document.querySelector<HTMLInputElement>('#document-file')
    if (input) input.value = ''
  } catch {
    error.value = 'Não foi possível enviar o documento.'
  } finally {
    uploadBusy.value = false
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(value?: number | null) {
  if (value == null) return '-'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatFileSize(value?: number | null) {
  if (!value) return '-'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="page">
    <AppNav />

    <main class="workspace">
      <section class="enrollment-chat">
        <div class="chat-strip">
          <div>
            <strong>Matrícula assistida</strong>
            <span>IA coleta dados, valida CPF/e-mail e finaliza com comprovante.</span>
          </div>
          <button class="icon-action" title="Nova matrícula" @click="resetChat">↺</button>
        </div>

        <div class="progress">
          <div class="progress__bar"><span :style="{ width: `${progress}%` }"></span></div>
          <small>{{ collectedRequiredCount }}/{{ requiredCount }} campos obrigatórios coletados</small>
        </div>

        <ChatMessages :messages="messages" :is-typing="isTyping" />
        <ChatInput :disabled="isSending" @send="sendEnrollmentMessage" />
      </section>

      <section class="enrollment-list">
        <div class="section-head">
          <div>
            <h1>Matrículas</h1>
            <p>{{ enrollments.length }} registros confirmados ou em andamento</p>
          </div>
          <button class="refresh" :disabled="isLoading" @click="loadEnrollments">Atualizar</button>
        </div>

        <NAlert v-if="error" type="error" closable class="alert" @close="error = null">
          {{ error }}
        </NAlert>

        <NScrollbar class="list-scroll">
          <div class="cards">
            <button
              v-for="enrollment in enrollments"
              :key="enrollment.id"
              class="enrollment-card"
              :class="{ 'enrollment-card--active': selected?.id === enrollment.id }"
              @click="selectEnrollment(enrollment)"
            >
              <span class="enrollment-card__number">{{ enrollment.number }}</span>
              <strong>{{ enrollment.studentName }}</strong>
              <span>{{ enrollment.course || 'Curso não informado' }} · {{ enrollment.unit || 'Unidade' }}</span>
              <div class="enrollment-card__foot">
                <span class="status">{{ enrollment.status }}</span>
                <span>{{ formatDate(enrollment.confirmedAt || enrollment.createdAt) }}</span>
              </div>
            </button>

            <div v-if="!enrollments.length && !isLoading" class="empty">
              Nenhuma matrícula criada ainda.
            </div>
          </div>
        </NScrollbar>
      </section>

      <aside class="detail-panel">
        <template v-if="selected">
          <div class="detail-head">
            <span class="detail-head__eyebrow">Matrícula {{ selected.number }}</span>
            <h2>{{ selected.studentName }}</h2>
            <div class="detail-tags">
              <span>{{ selected.status }}</span>
              <span>{{ selected.paymentStatus }}</span>
            </div>
          </div>

          <div class="payment-box">
            <span>Pagamento demo</span>
            <strong>{{ formatMoney(selected.paymentAmount) }}</strong>
            <small>{{ selected.paymentMethod || 'Forma não informada' }} · {{ selected.paymentRef || 'sem referência' }}</small>
          </div>

          <button class="primary-action" @click="enrollmentApi.downloadComprovante(selected.id)">
            Baixar comprovante PDF
          </button>

          <div class="detail-section">
            <h3>Documentos</h3>
            <div class="upload-row">
              <select v-model="docType">
                <option>RG</option>
                <option>CPF</option>
                <option>HISTORICO</option>
                <option>COMPROVANTE_RESIDENCIA</option>
                <option>FOTO</option>
                <option>OUTRO</option>
              </select>
              <input id="document-file" type="file" @change="onFileChange" />
              <button :disabled="!docFile || uploadBusy" @click="uploadDocument">
                {{ uploadBusy ? 'Enviando...' : 'Enviar' }}
              </button>
            </div>

            <div class="document-list">
              <button
                v-for="document in documents"
                :key="document.id"
                class="document-row"
                @click="enrollmentApi.downloadDocument(selected.id, document)"
              >
                <strong>{{ document.type }}</strong>
                <span>{{ document.fileName }}</span>
                <small>{{ formatFileSize(document.size) }}</small>
              </button>
              <p v-if="!documents.length" class="muted">Nenhum documento enviado.</p>
            </div>
          </div>

          <div class="detail-section">
            <h3>Dados coletados</h3>
            <div class="data-grid">
              <div v-for="row in detailRows" :key="row.label" class="data-row">
                <span>{{ row.label }}</span>
                <strong>{{ row.value }}</strong>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-detail">
          Selecione uma matrícula para ver comprovante, documentos e dados coletados.
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f5f7fa;
}

.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(380px, 460px) minmax(280px, 380px) minmax(320px, 1fr);
  min-height: 0;
  overflow: hidden;
}

.enrollment-chat,
.enrollment-list,
.detail-panel {
  min-height: 0;
  border-right: 1px solid #e5e7eb;
  background: #fff;
}

.enrollment-chat {
  display: flex;
  flex-direction: column;
}

.chat-strip {
  min-height: 58px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chat-strip strong,
.chat-strip span {
  display: block;
}

.chat-strip strong {
  color: #111827;
  font-size: 14px;
}

.chat-strip span {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.4;
}

.icon-action {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  cursor: pointer;
}

.progress {
  padding: 10px 16px;
  border-bottom: 1px solid #eef2f7;
}

.progress small {
  display: block;
  margin-top: 6px;
  color: #6b7280;
  font-size: 11px;
}

.progress__bar {
  height: 7px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}

.progress__bar span {
  display: block;
  height: 100%;
  background: #075e54;
  transition: width 0.2s ease;
}

.enrollment-list {
  display: flex;
  flex-direction: column;
}

.section-head {
  min-height: 78px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-head h1 {
  margin: 0;
  font-size: 18px;
  color: #111827;
}

.section-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.refresh,
.primary-action,
.upload-row button {
  border: none;
  border-radius: 8px;
  background: #075e54;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.refresh {
  padding: 8px 11px;
  font-size: 12px;
}

.refresh:disabled,
.upload-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.alert {
  margin: 12px;
}

.list-scroll {
  flex: 1;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}

.enrollment-card {
  width: 100%;
  text-align: left;
  padding: 13px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.enrollment-card:hover,
.enrollment-card--active {
  border-color: #075e54;
  background: #f0fdf8;
}

.enrollment-card__number {
  display: block;
  color: #075e54;
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 5px;
}

.enrollment-card strong {
  display: block;
  color: #111827;
  font-size: 14px;
  margin-bottom: 4px;
}

.enrollment-card span {
  font-size: 12px;
}

.enrollment-card__foot {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #6b7280;
  font-size: 11px;
}

.status,
.detail-tags span {
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  padding: 3px 8px;
  font-weight: 800;
  font-size: 10px;
}

.detail-panel {
  overflow-y: auto;
  padding: 18px;
  border-right: none;
}

.detail-head {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 14px;
}

.detail-head__eyebrow {
  color: #075e54;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.detail-head h2 {
  margin: 4px 0 10px;
  color: #111827;
  font-size: 22px;
}

.detail-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.payment-box {
  margin: 16px 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  background: #fafaf9;
}

.payment-box span,
.payment-box small {
  display: block;
  color: #6b7280;
  font-size: 12px;
}

.payment-box strong {
  display: block;
  color: #111827;
  font-size: 24px;
  margin: 4px 0;
}

.primary-action {
  width: 100%;
  padding: 11px 14px;
  margin-bottom: 18px;
}

.detail-section {
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
  margin-top: 16px;
}

.detail-section h3 {
  margin: 0 0 12px;
  color: #111827;
  font-size: 14px;
}

.upload-row {
  display: grid;
  grid-template-columns: 120px 1fr 86px;
  gap: 8px;
  align-items: center;
}

.upload-row select,
.upload-row input {
  min-width: 0;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0 9px;
  background: #fff;
  font-size: 12px;
}

.upload-row button {
  height: 36px;
  font-size: 12px;
}

.document-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.document-row {
  display: grid;
  grid-template-columns: 90px 1fr 58px;
  gap: 8px;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  text-align: left;
  cursor: pointer;
}

.document-row strong {
  color: #075e54;
  font-size: 11px;
}

.document-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 12px;
}

.document-row small,
.muted,
.empty,
.empty-detail {
  color: #6b7280;
  font-size: 12px;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.data-row {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  min-width: 0;
}

.data-row span,
.data-row strong {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
}

.data-row span {
  color: #6b7280;
  font-size: 11px;
  margin-bottom: 4px;
}

.data-row strong {
  color: #111827;
  font-size: 12px;
}

.empty,
.empty-detail {
  padding: 24px 12px;
  text-align: center;
}

@media (max-width: 1100px) {
  .workspace {
    grid-template-columns: 420px 1fr;
  }

  .detail-panel {
    display: none;
  }
}
</style>
