<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NScrollbar, NAlert } from 'naive-ui'
import { useSimulatorStore } from '@/stores/simulator'
import AppNav from '@/components/layout/AppNav.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import QuickReplies from '@/components/chat/QuickReplies.vue'
import LeadCard from '@/components/leads/LeadCard.vue'
import LeadDetailModal from '@/components/leads/LeadDetailModal.vue'
import { useQuickReplies } from '@/composables/useQuickReplies'
import { enrollmentApi } from '@/api/enrollments'
import type { EnrollmentField, Lead } from '@/types'

const store  = useSimulatorStore()
const router = useRouter()

const quickReplies = useQuickReplies(
  computed(() => store.messages),
  computed(() => store.isTyping),
)

const detailLead = ref<Lead | null>(null)
const enrollmentFields = ref<EnrollmentField[]>([])

const requiredEnrollmentFields = computed(() => enrollmentFields.value.filter((field) => field.required))
const collectedEnrollmentCount = computed(() =>
  requiredEnrollmentFields.value.filter((field) => String(store.enrollmentDraft[field.name] ?? '').trim()).length,
)
const enrollmentProgress = computed(() => {
  if (!requiredEnrollmentFields.value.length) return 0
  return Math.round((collectedEnrollmentCount.value / requiredEnrollmentFields.value.length) * 100)
})
const savedEnrollmentRows = computed(() =>
  enrollmentFields.value
    .map((field) => ({
      label: field.label,
      value: String(store.enrollmentDraft[field.name] ?? '').trim(),
    }))
    .filter((row) => row.value),
)
const missingEnrollmentFields = computed(() =>
  requiredEnrollmentFields.value
    .filter((field) => !String(store.enrollmentDraft[field.name] ?? '').trim())
    .slice(0, 6),
)
const compactLeads = computed(() => store.leads.slice(0, 5))

function leadSummary(lead: Lead) {
  return Object.values(lead.data ?? {})
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ') || lead.status
}

onMounted(async () => {
  store.fetchLeads()
  try {
    const res = await enrollmentApi.fields()
    enrollmentFields.value = res.fields
  } catch {
    // A conversa continua funcionando; a lateral só perde o checklist.
  }
})
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="workspace">
      <!-- ── Chat ── -->
      <section class="chat-col">
        <div class="chat-purpose">
          <strong>Modo Teste</strong> — simule o atendimento antes de conectar ao WhatsApp real.
        </div>
        <ChatHeader
          :name="store.isEnrollmentMode ? 'Secretaria' : 'IA Atendente'"
          :avatar="store.isEnrollmentMode ? 'S' : 'E'"
          @reset="store.resetSession()"
        />
        <ChatMessages :messages="store.messages" :is-typing="store.isTyping" />
        <QuickReplies
          v-if="quickReplies && !store.isSending && !store.isEnrollmentMode"
          :options="quickReplies"
          @select="store.sendMessage($event)"
        />
        <ChatInput :disabled="store.isSending" @send="store.sendMessage($event)" />
      </section>

      <!-- ── Leads capturados ── -->
      <section class="leads-col">
        <template v-if="store.isEnrollmentMode">
          <div class="leads-header">
            <div class="leads-header__left">
              <h2 class="leads-header__title">Matrícula em andamento</h2>
              <span class="leads-header__badge">{{ collectedEnrollmentCount }}/{{ requiredEnrollmentFields.length }}</span>
            </div>
            <button class="btn-pipeline" @click="router.push('/enrollments')">
              Abrir Matrículas →
            </button>
          </div>

          <NAlert v-if="store.error" type="error" closable style="margin: 0 16px 8px" @close="store.error = null">
            {{ store.error }}
          </NAlert>

          <div class="enrollment-panel">
            <div v-if="store.createdEnrollment" class="enrollment-result enrollment-result--inline">
              <div>
                <strong>Matrícula {{ store.createdEnrollment.number }} confirmada</strong>
                <span>{{ store.createdEnrollment.studentName }} · {{ store.createdEnrollment.course }}</span>
              </div>
              <button @click="router.push('/enrollments')">Ver matrícula</button>
            </div>

            <div class="enrollment-progress">
              <div class="enrollment-progress__bar">
                <span :style="{ width: `${enrollmentProgress}%` }"></span>
              </div>
              <small>{{ enrollmentProgress }}% dos dados obrigatórios preenchidos</small>
            </div>

            <div class="enrollment-tip">
              <strong>Como fica mais fácil para o aluno</strong>
              <p>O atendimento pergunta uma etapa por vez. Se ele já tiver documentos, pode mandar tudo em um PDF ou enviar um por um na aba Matrículas depois da confirmação.</p>
            </div>

            <div class="enrollment-block">
              <h3>Dados já salvos</h3>
              <div v-if="savedEnrollmentRows.length" class="enrollment-data">
                <div v-for="row in savedEnrollmentRows" :key="row.label" class="enrollment-row">
                  <span>{{ row.label }}</span>
                  <strong>{{ row.value }}</strong>
                </div>
              </div>
              <p v-else class="enrollment-muted">A conversa ainda não salvou dados da matrícula.</p>
            </div>

            <div class="enrollment-block">
              <h3>Próximos campos</h3>
              <div v-if="missingEnrollmentFields.length" class="missing-list">
                <span v-for="field in missingEnrollmentFields" :key="field.name">{{ field.label }}</span>
              </div>
              <p v-else class="enrollment-muted">Tudo obrigatório foi coletado. Falta só revisar e confirmar.</p>
            </div>

            <div class="secondary-leads">
              <div class="secondary-leads__head">
                <div>
                  <h3>Leads Capturados</h3>
                  <span>{{ store.leadCount }} contatos no pipeline</span>
                </div>
                <button @click="router.push('/kanban')">Pipeline</button>
              </div>

              <div v-if="compactLeads.length" class="lead-mini-list">
                <button
                  v-for="lead in compactLeads"
                  :key="lead.id"
                  class="lead-mini"
                  @click="detailLead = lead"
                >
                  <span class="lead-mini__avatar">{{ lead.name.charAt(0).toUpperCase() }}</span>
                  <span class="lead-mini__body">
                    <strong>{{ lead.name }}</strong>
                    <small>{{ leadSummary(lead) }}</small>
                  </span>
                  <span class="lead-mini__status">{{ lead.status }}</span>
                </button>
              </div>
              <p v-else class="enrollment-muted">Nenhum lead capturado ainda.</p>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="leads-header">
            <div class="leads-header__left">
              <h2 class="leads-header__title">Leads Capturados</h2>
              <span v-if="store.hasLeads" class="leads-header__badge">{{ store.leadCount }}</span>
            </div>
            <button v-if="store.hasLeads" class="btn-pipeline" @click="router.push('/kanban')">
              Ver no Pipeline →
            </button>
          </div>

          <NAlert v-if="store.error" type="error" closable style="margin: 0 16px 8px" @close="store.error = null">
            {{ store.error }}
          </NAlert>

          <div v-if="store.createdEnrollment" class="enrollment-result">
            <div>
              <strong>Matrícula {{ store.createdEnrollment.number }} confirmada</strong>
              <span>{{ store.createdEnrollment.studentName }} · {{ store.createdEnrollment.course }}</span>
            </div>
            <button @click="router.push('/enrollments')">Ver matrícula</button>
          </div>

          <NScrollbar class="leads-scroll">
            <div class="leads-list">
              <!-- Empty state -->
              <div v-if="!store.hasLeads" class="empty-state">
                <div class="empty-state__steps">
                  <div class="step"><span class="step__num">1</span><span class="step__text">Digite uma mensagem no chat ao lado como se fosse o cliente</span></div>
                  <div class="step"><span class="step__num">2</span><span class="step__text">O atendimento vai coletar os dados necessários do seu vertical</span></div>
                  <div class="step"><span class="step__num">3</span><span class="step__text">O lead aparece aqui — clique para ver os detalhes e a conversa</span></div>
                </div>
              </div>

              <!-- Lead cards — clique abre o modal de detalhes -->
              <LeadCard
                v-for="lead in store.leads"
                :key="lead.id"
                :lead="lead"
                @open="detailLead = $event"
              />
            </div>
          </NScrollbar>
        </template>
      </section>
    </div>

    <!-- Modal de detalhe do lead -->
    <LeadDetailModal :lead="detailLead" @close="detailLead = null" />
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

.workspace { flex: 1; display: flex; overflow: hidden; }

.chat-col {
  width: 460px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e9edef;
  background: #fff;
  overflow: hidden;
}

.chat-purpose {
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  padding: 8px 16px;
  font-size: 12px;
  color: #92400e;
  flex-shrink: 0;
}

.leads-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.leads-header {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e9edef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.leads-header__left { display: flex; align-items: center; gap: 10px; }

.leads-header__title {
  font-size: 16px;
  font-weight: 700;
  color: #111b21;
  margin: 0;
}

.leads-header__badge {
  background: #075e54;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
}

.btn-pipeline {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #075e54;
  background: #e8f5e9;
  border: 1px solid #b2dfdb;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-pipeline:hover { background: #c8e6c9; }

.enrollment-panel {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.enrollment-progress {
  padding: 14px;
  border: 1px solid #d1fae5;
  border-radius: 8px;
  background: #f0fdf8;
}

.enrollment-progress small {
  display: block;
  margin-top: 8px;
  color: #047857;
  font-size: 12px;
  font-weight: 700;
}

.enrollment-progress__bar {
  height: 8px;
  border-radius: 999px;
  background: #d1fae5;
  overflow: hidden;
}

.enrollment-progress__bar span {
  display: block;
  height: 100%;
  background: #075e54;
  transition: width 0.2s ease;
}

.enrollment-tip,
.enrollment-block {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.enrollment-tip strong,
.enrollment-block h3 {
  display: block;
  margin: 0 0 8px;
  color: #111827;
  font-size: 14px;
}

.enrollment-tip p,
.enrollment-muted {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}

.enrollment-data {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.enrollment-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.45fr) 1fr;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

.enrollment-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.enrollment-row span {
  color: #6b7280;
  font-size: 12px;
}

.enrollment-row strong {
  color: #111827;
  font-size: 13px;
  word-break: break-word;
}

.missing-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.missing-list span {
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
}

.secondary-leads {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.secondary-leads__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.secondary-leads__head h3 {
  margin: 0;
  color: #111827;
  font-size: 14px;
}

.secondary-leads__head span {
  display: block;
  margin-top: 2px;
  color: #6b7280;
  font-size: 12px;
}

.secondary-leads__head button {
  border: 1px solid #b2dfdb;
  border-radius: 8px;
  background: #e8f5e9;
  color: #075e54;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  cursor: pointer;
}

.lead-mini-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lead-mini {
  width: 100%;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 9px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #f9fafb;
  color: #111827;
  text-align: left;
  cursor: pointer;
}

.lead-mini:hover {
  border-color: #b2dfdb;
  background: #f0fdf8;
}

.lead-mini__avatar {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e0f2f1;
  color: #075e54;
  font-size: 12px;
  font-weight: 800;
}

.lead-mini__body {
  min-width: 0;
}

.lead-mini__body strong,
.lead-mini__body small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-mini__body strong {
  font-size: 13px;
}

.lead-mini__body small {
  margin-top: 2px;
  color: #6b7280;
  font-size: 11px;
}

.lead-mini__status {
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 800;
}

.enrollment-result {
  margin: 12px 16px 0;
  padding: 12px;
  border: 1px solid #b2dfdb;
  border-radius: 8px;
  background: #ecfdf5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.enrollment-result--inline {
  margin: 0 0 12px;
}

.enrollment-result strong,
.enrollment-result span {
  display: block;
}

.enrollment-result strong {
  color: #064e3b;
  font-size: 13px;
}

.enrollment-result span {
  color: #047857;
  font-size: 12px;
  margin-top: 2px;
}

.enrollment-result button {
  border: 1px solid #10b981;
  background: #d1fae5;
  color: #065f46;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.leads-scroll { flex: 1; }

.leads-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-state { padding: 20px 8px; }

.empty-state__steps { display: flex; flex-direction: column; gap: 14px; }

.step { display: flex; align-items: flex-start; gap: 12px; }

.step__num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #075e54;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step__text {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  padding-top: 4px;
}
</style>
