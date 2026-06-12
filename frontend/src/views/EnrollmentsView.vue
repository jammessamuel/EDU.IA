<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { NAlert, NIcon, NScrollbar } from 'naive-ui'
import {
  CloudUploadOutline,
  DocumentTextOutline,
  DownloadOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import { enrollmentApi } from '@/api/enrollments'
import { useAccessibility } from '@/composables/useAccessibility'
import type { ChatMessage, Enrollment, EnrollmentDocument, EnrollmentField, HistoryMessage } from '@/types'

const messages = ref<ChatMessage[]>([
  {
    id: 'welcome',
    from: 'ai',
    text:
      'Oi! Sou da secretaria de matrículas. Posso fazer sua matrícula por aqui e, no final, deixar o comprovante pronto para baixar. Quer começar?',
    timestamp: new Date(),
  },
])

const fields = ref<EnrollmentField[]>([])
const documentRequirements = ref({
  brasil: [
    'CPF e RG/CNH ou documento oficial com foto',
    'Comprovante de residência',
    'Histórico ou certificado escolar',
  ],
  internacional: [
    'Passaporte ou documento nacional de identidade',
    'Visto/permissão de estudo ou residência quando aplicável',
    'Histórico/diploma com tradução ou validação quando exigido',
  ],
})
const enrollments = ref<Enrollment[]>([])
const documents = ref<EnrollmentDocument[]>([])
const selected = ref<Enrollment | null>(null)
const draft = ref<Record<string, unknown>>({})
const isTyping = ref(false)
const isSending = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const docType = ref('PACOTE_COMPLETO')
const docFile = ref<File | null>(null)
const uploadBusy = ref(false)
const { effectiveReduceMotion, updateProfile } = useAccessibility()

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
    if (res.documentRequirements) documentRequirements.value = res.documentRequirements
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
  if (!effectiveReduceMotion.value) await delay(450)
  isTyping.value = true
  await nextTick()

  const startedAt = Date.now()
  try {
    const res = await enrollmentApi.chat({ text: text.trim(), history, draft: draft.value })
    const elapsed = Date.now() - startedAt
    if (!effectiveReduceMotion.value && elapsed < 1300) await delay(1300 - elapsed)

    draft.value = res.draft || draft.value
    if (res.accessibility) await updateProfile(res.accessibility)
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
            <span>Atendimento guiado, pagamento demo e comprovante em PDF.</span>
          </div>
          <button class="icon-action" title="Nova matrícula" @click="resetChat">
            <NIcon :component="RefreshOutline" size="16" />
          </button>
        </div>

        <div class="progress">
          <div class="progress__bar"><span :style="{ width: `${progress}%` }"></span></div>
          <small>{{ collectedRequiredCount }}/{{ requiredCount }} campos obrigatórios coletados</small>
        </div>

        <ChatMessages :messages="messages" :is-typing="isTyping" />

        <ChatInput :disabled="isSending" placeholder="Escreva sua resposta aqui..." @send="sendEnrollmentMessage" />
      </section>

      <section class="enrollment-list">
        <div class="section-head">
          <div>
            <h1>Matrículas</h1>
            <p>{{ enrollments.length }} registros confirmados ou em andamento</p>
          </div>
          <button class="refresh" :disabled="isLoading" @click="loadEnrollments">
            <NIcon :component="RefreshOutline" size="15" />
            Atualizar
          </button>
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

          <button
            type="button"
            class="primary-action"
            :aria-label="`Baixar comprovante PDF da matricula ${selected.number}`"
            @click="enrollmentApi.downloadComprovante(selected.id)"
          >
            <NIcon :component="DownloadOutline" size="17" />
            Baixar comprovante PDF
          </button>

          <div class="detail-section">
            <h3>Documentos</h3>
            <div class="upload-row">
              <label class="upload-field">
                <span>Tipo de documento</span>
                <select v-model="docType">
                  <option value="PACOTE_COMPLETO">PDF completo da matrícula</option>
                  <option>RG</option>
                  <option>CPF</option>
                  <option>PASSAPORTE</option>
                  <option>SSN</option>
                  <option>DRIVER_LICENSE</option>
                  <option>STATE_ID</option>
                  <option>NIE</option>
                  <option>DNI</option>
                  <option>VISTO_PERMISSAO</option>
                  <option>HISTORICO</option>
                  <option>HISTORICO_TRADUZIDO</option>
                  <option>COMPROVANTE_RESIDENCIA</option>
                  <option>FOTO</option>
                  <option>OUTRO</option>
                </select>
              </label>
              <label class="upload-field">
                <span>Arquivo</span>
                <input id="document-file" type="file" accept=".pdf,image/*" @change="onFileChange" />
              </label>
              <button
                type="button"
                :disabled="!docFile || uploadBusy"
                aria-label="Enviar documento da matricula"
                @click="uploadDocument"
              >
                <NIcon :component="CloudUploadOutline" size="15" />
                {{ uploadBusy ? 'Enviando...' : 'Enviar' }}
              </button>
            </div>
            <p class="upload-help">
              Pode enviar um PDF com todos os documentos ou enviar um por um. Para estrangeiros, use passaporte/ID nacional, visto ou permissão quando aplicável e histórico traduzido quando exigido.
            </p>

            <div class="document-guides">
              <div>
                <strong>Brasil</strong>
                <span v-for="item in documentRequirements.brasil" :key="item">{{ item }}</span>
              </div>
              <div>
                <strong>Internacional</strong>
                <span v-for="item in documentRequirements.internacional" :key="item">{{ item }}</span>
              </div>
            </div>

            <div class="document-list">
              <button
                v-for="document in documents"
                :key="document.id"
                type="button"
                class="document-row"
                :aria-label="`Baixar documento ${document.type}: ${document.fileName}`"
                @click="enrollmentApi.downloadDocument(selected.id, document)"
              >
                <strong><NIcon :component="DocumentTextOutline" size="15" /> {{ document.type }}</strong>
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
  grid-template-columns: 170px 1fr 86px;
  gap: 8px;
  align-items: center;
}

.upload-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.upload-field span {
  color: #374151;
  font-size: 11px;
  font-weight: 800;
}

.upload-help {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.45;
}

.document-guides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}

.document-guides div {
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--brand) 16%, white);
  border-radius: 8px;
  background: color-mix(in srgb, var(--brand) 6%, white);
}

.document-guides strong,
.document-guides span {
  display: block;
}

.document-guides strong {
  color: var(--brand);
  font-size: 12px;
  margin-bottom: 6px;
}

.document-guides span {
  color: #6b7280;
  font-size: 11px;
  line-height: 1.35;
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

.upload-field span {
  color: var(--muted-strong);
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

/* Premium shell */
.page {
  background: var(--app-bg);
}

.workspace {
  gap: 18px;
  padding: 18px;
  background: transparent;
}

.enrollment-chat,
.enrollment-list,
.detail-panel {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.detail-panel {
  overflow-y: auto;
}

.chat-strip,
.section-head {
  background: var(--surface-raised);
  border-bottom-color: var(--border);
}

.chat-strip strong,
.section-head h1,
.detail-head h2,
.detail-section h3 {
  color: var(--text);
  font-weight: 900;
}

.chat-strip span,
.section-head p,
.progress small,
.payment-box span,
.payment-box small,
.upload-help,
.document-guides span,
.document-row small,
.muted,
.empty,
.empty-detail,
.data-row span {
  color: var(--muted);
}

.icon-action {
  display: grid;
  place-items: center;
  border-color: var(--border);
  background: var(--surface);
  color: var(--brand);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.icon-action:hover {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
}

.progress {
  border-bottom-color: var(--border);
}

.progress__bar {
  background: rgba(7, 94, 84, 0.13);
}

.progress__bar span {
  background: linear-gradient(90deg, var(--brand), var(--accent));
}

.document-guides div {
  border-color: color-mix(in srgb, var(--brand) 18%, var(--border));
  background: var(--brand-soft);
}

.document-guides strong {
  color: var(--brand);
}

.refresh,
.primary-action,
.upload-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: var(--brand);
  font-weight: 800;
  transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
}

.refresh:hover:not(:disabled),
.primary-action:hover,
.upload-row button:hover:not(:disabled) {
  background: var(--brand-strong);
  box-shadow: var(--shadow-sm);
}

.enrollment-card {
  border-color: var(--border);
  background: var(--surface-raised);
  color: var(--text-soft);
  box-shadow: var(--shadow-xs);
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s;
}

.enrollment-card:hover,
.enrollment-card--active {
  border-color: color-mix(in srgb, var(--brand) 34%, white);
  background: linear-gradient(135deg, var(--brand-soft), var(--surface));
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.enrollment-card__number,
.detail-head__eyebrow,
.document-row strong {
  color: var(--brand);
}

.enrollment-card strong,
.payment-box strong,
.document-row span,
.data-row strong {
  color: var(--text);
}

.enrollment-card__foot {
  color: var(--muted);
}

.status,
.detail-tags span {
  background: var(--brand-soft);
  color: var(--brand);
  border: 1px solid color-mix(in srgb, var(--brand) 18%, white);
}

.detail-head {
  border-bottom-color: var(--border);
}

.payment-box,
.data-row {
  border-color: var(--border);
  background: var(--surface-soft);
}

.detail-section {
  border-top-color: var(--border);
}

.upload-row select,
.upload-row input {
  border-color: var(--border);
  color: var(--text);
  background: var(--input-bg);
}

.document-row {
  border-color: var(--border);
  background: var(--surface);
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}

.document-row:hover {
  border-color: color-mix(in srgb, var(--brand) 28%, white);
  background: var(--surface-soft);
  transform: translateY(-1px);
}

.document-row strong {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

@media (max-width: 1100px) {
  .workspace {
    grid-template-columns: 420px 1fr;
  }

  .detail-panel {
    display: none;
  }
}

@media (max-width: 780px) {
  .workspace {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .enrollment-chat,
  .enrollment-list {
    min-height: 520px;
  }

  .upload-row {
    grid-template-columns: 1fr;
  }
}
</style>
