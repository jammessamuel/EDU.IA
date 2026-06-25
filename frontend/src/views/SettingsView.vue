<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NAlert, NSpin } from 'naive-ui'
import AppNav from '@/components/layout/AppNav.vue'
import { schoolConfigApi } from '@/api/schoolConfig'
import { simulatorApi } from '@/api/simulator'
import { useWorkspaceStore } from '@/stores/workspace'
import type {
  CommunicationTemplateConfig,
  CourseOfferConfig,
  DocumentRequirementConfig,
  SchoolConfigOverview,
} from '@/types'

const ws = useWorkspaceStore()

const tabs = [
  { key: 'institution', label: 'Instituição' },
  { key: 'messages', label: 'Mensagens' },
  { key: 'courses', label: 'Cursos' },
  { key: 'documents', label: 'Documentos' },
  { key: 'discounts', label: 'Descontos' },
  { key: 'attendance', label: 'Atendimento' },
]

const audienceLabels: Record<string, string> = {
  brasileiro: 'Aluno brasileiro',
  estrangeiro: 'Aluno estrangeiro',
  menor_idade: 'Menor de idade',
}

const loading = ref(true)
const saving = ref<string | null>(null)
const error = ref('')
const notice = ref('')
const activeTab = ref('institution')
const config = ref<SchoolConfigOverview | null>(null)
const preview = ref<{ key: string; title: string; text: string } | null>(null)

const workspaceForm = ref({
  name: '',
  chatbotName: '',
})

const newCourse = ref<Partial<CourseOfferConfig>>({
  name: '',
  description: '',
  duration: '',
  modality: 'Presencial',
  shifts: ['noite'],
  enrollmentFee: 150,
  monthlyFee: 0,
  cashDiscountPercent: 0,
  active: true,
})

const newDocument = ref<Partial<DocumentRequirementConfig>>({
  audience: 'brasileiro',
  documentType: '',
  instructions: '',
  required: true,
  active: true,
})

const iaTemplates = computed(() =>
  (config.value?.templates ?? []).filter((template) => template.category === 'ia' || template.category === 'pos_venda'),
)
const rulerTemplates = computed(() =>
  (config.value?.templates ?? []).filter((template) => template.category === 'regua'),
)
const documentsByAudience = computed(() => {
  const groups: Record<string, DocumentRequirementConfig[]> = {}
  for (const document of config.value?.documents ?? []) {
    const audience = document.audience
    if (!groups[audience]) groups[audience] = []
    groups[audience]!.push(document)
  }
  return groups
})

onMounted(load)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [overview, settings] = await Promise.all([
      schoolConfigApi.overview(),
      simulatorApi.getSchoolSettings().catch(() => null),
    ])
    config.value = overview
    workspaceForm.value = {
      name: settings?.name ?? '',
      chatbotName: settings?.chatbotName ?? '',
    }
  } catch {
    error.value = 'Não foi possível carregar as configurações da escola.'
  } finally {
    loading.value = false
  }
}

function setConfig(next: SchoolConfigOverview) {
  config.value = next
}

function flash(message: string) {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 2600)
}

async function saveProfile() {
  if (!config.value) return
  await runSaving('institution', async () => {
    setConfig(await schoolConfigApi.updateProfile(config.value!.profile))
    flash('Instituição salva.')
  })
}

async function saveWorkspace() {
  await runSaving('attendance', async () => {
    await simulatorApi.updateSchoolSettings({
      name: workspaceForm.value.name,
      chatbotName: workspaceForm.value.chatbotName,
    })
    ws.clear()
    await ws.load()
    flash('Atendimento salvo.')
  })
}

async function saveCommercial() {
  if (!config.value) return
  await runSaving('discounts', async () => {
    setConfig(await schoolConfigApi.updateCommercial(config.value!.commercial))
    flash('Descontos salvos.')
  })
}

async function saveTemplate(template: CommunicationTemplateConfig) {
  await runSaving(`template-${template.key}`, async () => {
    setConfig(await schoolConfigApi.updateTemplate(template.key, template))
    flash(`Template "${template.title}" salvo.`)
  })
}

async function restoreTemplate(template: CommunicationTemplateConfig) {
  await runSaving(`restore-${template.key}`, async () => {
    setConfig(await schoolConfigApi.restoreTemplate(template.key))
    preview.value = null
    flash(`Template "${template.title}" restaurado.`)
  })
}

async function previewTemplate(template: CommunicationTemplateConfig) {
  await runSaving(`preview-${template.key}`, async () => {
    const result = await schoolConfigApi.previewTemplate(template.key)
    preview.value = { key: template.key, title: result.title, text: result.rendered }
  })
}

async function saveCourse(course: CourseOfferConfig) {
  await runSaving(`course-${course.id}`, async () => {
    setConfig(await schoolConfigApi.updateCourse(course.id, course))
    flash(`Curso "${course.name}" salvo.`)
  })
}

async function addCourse() {
  await runSaving('new-course', async () => {
    setConfig(await schoolConfigApi.createCourse(newCourse.value))
    newCourse.value = {
      name: '',
      description: '',
      duration: '',
      modality: 'Presencial',
      shifts: ['noite'],
      enrollmentFee: 150,
      monthlyFee: 0,
      cashDiscountPercent: 0,
      active: true,
    }
    flash('Curso adicionado.')
  })
}

async function saveDocument(document: DocumentRequirementConfig) {
  await runSaving(`document-${document.id}`, async () => {
    setConfig(await schoolConfigApi.updateDocument(document.id, document))
    flash(`Documento "${document.documentType}" salvo.`)
  })
}

async function addDocument() {
  await runSaving('new-document', async () => {
    setConfig(await schoolConfigApi.createDocument(newDocument.value))
    newDocument.value = {
      audience: 'brasileiro',
      documentType: '',
      instructions: '',
      required: true,
      active: true,
    }
    flash('Documento adicionado.')
  })
}

async function runSaving(key: string, action: () => Promise<void>) {
  saving.value = key
  error.value = ''
  try {
    await action()
  } catch {
    error.value = 'Não foi possível salvar. Revise os campos e tente novamente.'
  } finally {
    saving.value = null
  }
}

function inputValue(event: Event) {
  return (event.target as HTMLInputElement).value
}

function updateShifts(course: { shifts?: string[] }, value: string) {
  course.shifts = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function shiftsValue(course: { shifts?: string[] }) {
  return (course.shifts ?? []).join(', ')
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
}
</script>

<template>
  <div class="page">
    <AppNav />

    <header class="settings-head">
      <div>
        <p class="eyebrow">Configurações da escola</p>
        <h1>Dados que alimentam a IA e o pós-venda</h1>
      </div>
      <div v-if="ws.vertical" class="vertical-badge">
        {{ ws.vertical.icon }} {{ ws.vertical.name }}
      </div>
    </header>

    <main class="settings-main">
      <div v-if="loading" class="loading">
        <NSpin size="large" />
      </div>

      <template v-else-if="config">
        <nav class="tabs" aria-label="Abas de configuração">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tab"
            :class="{ 'tab--active': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <section class="panel">
          <NAlert v-if="error" type="error" closable class="notice" @close="error = ''">
            {{ error }}
          </NAlert>
          <NAlert v-if="notice" type="success" closable class="notice" @close="notice = ''">
            {{ notice }}
          </NAlert>

          <div v-if="activeTab === 'institution'" class="tab-body">
            <div class="section-title">
              <div>
                <h2>Instituição</h2>
                <p>Horários, endereço, mapa e transporte usados nas respostas automáticas.</p>
              </div>
              <button class="btn-primary" :disabled="saving === 'institution'" @click="saveProfile">
                {{ saving === 'institution' ? 'Salvando...' : 'Salvar instituição' }}
              </button>
            </div>

            <div class="form-grid">
              <label class="field">
                <span>Segunda a sexta</span>
                <input v-model="config.profile.businessHours.weekdays" />
              </label>
              <label class="field">
                <span>Sábado</span>
                <input v-model="config.profile.businessHours.saturday" />
              </label>
              <label class="field">
                <span>Domingo/feriados</span>
                <input v-model="config.profile.businessHours.sundayHolidays" />
              </label>
              <label class="field">
                <span>Secretaria</span>
                <input v-model="config.profile.businessHours.secretaria" />
              </label>
              <label class="field">
                <span>Financeiro</span>
                <input v-model="config.profile.businessHours.financeiro" />
              </label>
              <label class="field">
                <span>Atendimento online</span>
                <input v-model="config.profile.businessHours.online" />
              </label>
            </div>

            <div class="form-grid form-grid--wide">
              <label class="field">
                <span>Endereço</span>
                <input v-model="config.profile.address" />
              </label>
              <label class="field">
                <span>Cidade</span>
                <input v-model="config.profile.city" />
              </label>
              <label class="field">
                <span>UF</span>
                <input v-model="config.profile.state" maxlength="2" />
              </label>
              <label class="field field--full">
                <span>Link do Google Maps</span>
                <input v-model="config.profile.mapLink" />
              </label>
              <label class="field field--full">
                <span>Pontos de referência</span>
                <textarea v-model="config.profile.referencePoints" rows="3" />
              </label>
              <label class="field field--full">
                <span>Condução/transporte</span>
                <textarea v-model="config.profile.transportInfo" rows="3" />
              </label>
            </div>
          </div>

          <div v-else-if="activeTab === 'messages'" class="tab-body">
            <div class="section-title">
              <div>
                <h2>Mensagens</h2>
                <p>Templates com variáveis como {nome}, {curso}, {valor}, {desconto}, {horario} e {endereco}.</p>
              </div>
            </div>

            <div v-if="preview" class="preview-box">
              <strong>Prévia: {{ preview.title }}</strong>
              <p>{{ preview.text }}</p>
            </div>

            <h3 class="subsection">IA e pós-venda</h3>
            <article v-for="template in iaTemplates" :key="template.key" class="editable-row">
              <div class="editable-row__head">
                <label class="field field--compact">
                  <span>Título</span>
                  <input v-model="template.title" />
                </label>
                <label class="field field--compact">
                  <span>Etapa</span>
                  <input v-model="template.stage" />
                </label>
                <label class="switch">
                  <input v-model="template.active" type="checkbox" />
                  <span>Ativo</span>
                </label>
              </div>
              <label class="field">
                <span>Texto WhatsApp</span>
                <textarea v-model="template.whatsappText" rows="4" />
              </label>
              <div class="row-actions">
                <button class="btn-secondary" :disabled="saving === `preview-${template.key}`" @click="previewTemplate(template)">
                  Pré-visualizar
                </button>
                <button class="btn-secondary" :disabled="saving === `restore-${template.key}`" @click="restoreTemplate(template)">
                  Restaurar padrão
                </button>
                <button class="btn-primary" :disabled="saving === `template-${template.key}`" @click="saveTemplate(template)">
                  Salvar
                </button>
              </div>
            </article>

            <h3 class="subsection">Régua dia 0/1/3/7/15/30</h3>
            <article v-for="template in rulerTemplates" :key="template.key" class="editable-row">
              <div class="editable-row__head">
                <label class="field field--compact">
                  <span>Título</span>
                  <input v-model="template.title" />
                </label>
                <label class="field field--compact">
                  <span>Etapa</span>
                  <input v-model="template.stage" />
                </label>
                <div class="day-pill">Dia {{ template.dayOffset }}</div>
                <label class="switch">
                  <input v-model="template.active" type="checkbox" />
                  <span>Ativo</span>
                </label>
              </div>
              <label class="field">
                <span>Texto WhatsApp</span>
                <textarea v-model="template.whatsappText" rows="4" />
              </label>
              <div class="row-actions">
                <button class="btn-secondary" @click="previewTemplate(template)">Pré-visualizar</button>
                <button class="btn-secondary" @click="restoreTemplate(template)">Restaurar padrão</button>
                <button class="btn-primary" @click="saveTemplate(template)">Salvar</button>
              </div>
            </article>
          </div>

          <div v-else-if="activeTab === 'courses'" class="tab-body">
            <div class="section-title">
              <div>
                <h2>Cursos</h2>
                <p>Cursos inativos não aparecem nas respostas da IA nem na oferta de matrícula.</p>
              </div>
            </div>

            <article v-for="course in config.courses" :key="course.id" class="editable-row">
              <div class="editable-row__head">
                <label class="field field--compact">
                  <span>Nome</span>
                  <input v-model="course.name" />
                </label>
                <label class="field field--compact">
                  <span>Duração</span>
                  <input v-model="course.duration" />
                </label>
                <label class="field field--compact">
                  <span>Modalidade</span>
                  <input v-model="course.modality" />
                </label>
                <label class="switch">
                  <input v-model="course.active" type="checkbox" />
                  <span>Ativo</span>
                </label>
              </div>
              <label class="field">
                <span>Descrição</span>
                <textarea v-model="course.description" rows="3" />
              </label>
              <div class="form-grid">
                <label class="field">
                  <span>Turnos</span>
                  <input :value="shiftsValue(course)" @input="updateShifts(course, inputValue($event))" />
                </label>
                <label class="field">
                  <span>Valor matrícula</span>
                  <input v-model.number="course.enrollmentFee" type="number" min="0" />
                </label>
                <label class="field">
                  <span>Mensalidade</span>
                  <input v-model.number="course.monthlyFee" type="number" min="0" />
                </label>
                <label class="field">
                  <span>Desconto à vista (%)</span>
                  <input v-model.number="course.cashDiscountPercent" type="number" min="0" max="100" />
                </label>
              </div>
              <div class="course-summary">
                {{ money(course.enrollmentFee) }} matrícula · {{ money(course.monthlyFee) }} mensalidade
              </div>
              <div class="row-actions">
                <button class="btn-primary" :disabled="saving === `course-${course.id}`" @click="saveCourse(course)">
                  Salvar curso
                </button>
              </div>
            </article>

            <article class="editable-row editable-row--new">
              <h3>Novo curso</h3>
              <div class="editable-row__head">
                <label class="field field--compact">
                  <span>Nome</span>
                  <input v-model="newCourse.name" />
                </label>
                <label class="field field--compact">
                  <span>Duração</span>
                  <input v-model="newCourse.duration" />
                </label>
                <label class="field field--compact">
                  <span>Modalidade</span>
                  <input v-model="newCourse.modality" />
                </label>
              </div>
              <label class="field">
                <span>Descrição</span>
                <textarea v-model="newCourse.description" rows="3" />
              </label>
              <div class="form-grid">
                <label class="field">
                  <span>Turnos</span>
                  <input :value="shiftsValue(newCourse)" @input="updateShifts(newCourse, inputValue($event))" />
                </label>
                <label class="field">
                  <span>Valor matrícula</span>
                  <input v-model.number="newCourse.enrollmentFee" type="number" min="0" />
                </label>
                <label class="field">
                  <span>Mensalidade</span>
                  <input v-model.number="newCourse.monthlyFee" type="number" min="0" />
                </label>
                <label class="field">
                  <span>Desconto à vista (%)</span>
                  <input v-model.number="newCourse.cashDiscountPercent" type="number" min="0" max="100" />
                </label>
              </div>
              <div class="row-actions">
                <button class="btn-primary" :disabled="saving === 'new-course'" @click="addCourse">Adicionar curso</button>
              </div>
            </article>
          </div>

          <div v-else-if="activeTab === 'documents'" class="tab-body">
            <div class="section-title">
              <div>
                <h2>Documentos</h2>
                <p>A IA usa esta lista para responder brasileiros, estrangeiros e menores de idade.</p>
              </div>
            </div>

            <section v-for="(documents, audience) in documentsByAudience" :key="audience" class="document-group">
              <h3>{{ audienceLabels[String(audience)] ?? audience }}</h3>
              <article v-for="document in documents" :key="document.id" class="editable-row">
                <div class="editable-row__head">
                  <label class="field field--compact">
                    <span>Documento</span>
                    <input v-model="document.documentType" />
                  </label>
                  <label class="field field--compact">
                    <span>Público</span>
                    <select v-model="document.audience">
                      <option value="brasileiro">Brasileiro</option>
                      <option value="estrangeiro">Estrangeiro</option>
                      <option value="menor_idade">Menor de idade</option>
                    </select>
                  </label>
                  <label class="switch">
                    <input v-model="document.required" type="checkbox" />
                    <span>Obrigatório</span>
                  </label>
                  <label class="switch">
                    <input v-model="document.active" type="checkbox" />
                    <span>Ativo</span>
                  </label>
                </div>
                <label class="field">
                  <span>Instruções para o aluno</span>
                  <textarea v-model="document.instructions" rows="3" />
                </label>
                <div class="row-actions">
                  <button class="btn-primary" :disabled="saving === `document-${document.id}`" @click="saveDocument(document)">
                    Salvar documento
                  </button>
                </div>
              </article>
            </section>

            <article class="editable-row editable-row--new">
              <h3>Novo documento</h3>
              <div class="editable-row__head">
                <label class="field field--compact">
                  <span>Documento</span>
                  <input v-model="newDocument.documentType" />
                </label>
                <label class="field field--compact">
                  <span>Público</span>
                  <select v-model="newDocument.audience">
                    <option value="brasileiro">Brasileiro</option>
                    <option value="estrangeiro">Estrangeiro</option>
                    <option value="menor_idade">Menor de idade</option>
                  </select>
                </label>
                <label class="switch">
                  <input v-model="newDocument.required" type="checkbox" />
                  <span>Obrigatório</span>
                </label>
              </div>
              <label class="field">
                <span>Instruções</span>
                <textarea v-model="newDocument.instructions" rows="3" />
              </label>
              <div class="row-actions">
                <button class="btn-primary" :disabled="saving === 'new-document'" @click="addDocument">Adicionar documento</button>
              </div>
            </article>
          </div>

          <div v-else-if="activeTab === 'discounts'" class="tab-body">
            <div class="section-title">
              <div>
                <h2>Descontos</h2>
                <p>Condição comercial consumida pela IA quando o aluno pergunta promoção, valores ou pagamento à vista.</p>
              </div>
              <button class="btn-primary" :disabled="saving === 'discounts'" @click="saveCommercial">
                {{ saving === 'discounts' ? 'Salvando...' : 'Salvar descontos' }}
              </button>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>Desconto à vista padrão (%)</span>
                <input v-model.number="config.commercial.cashDiscountPercent" type="number" min="0" max="100" />
              </label>
              <label class="field">
                <span>Validade da campanha</span>
                <input v-model="config.commercial.campaignValidUntil" type="date" />
              </label>
              <label class="switch switch--inline">
                <input v-model="config.commercial.campaignActive" type="checkbox" />
                <span>Campanha ativa</span>
              </label>
            </div>
            <label class="field">
              <span>Texto comercial da promoção</span>
              <textarea v-model="config.commercial.promotionText" rows="5" />
            </label>
          </div>

          <div v-else-if="activeTab === 'attendance'" class="tab-body">
            <div class="section-title">
              <div>
                <h2>Atendimento</h2>
                <p>Nome do workspace, nome da IA e canais exibidos nas respostas da escola.</p>
              </div>
              <button class="btn-primary" :disabled="saving === 'attendance'" @click="saveWorkspace">
                {{ saving === 'attendance' ? 'Salvando...' : 'Salvar atendimento' }}
              </button>
            </div>

            <div class="form-grid">
              <label class="field">
                <span>Nome do negócio</span>
                <input v-model="workspaceForm.name" />
              </label>
              <label class="field">
                <span>Nome da IA</span>
                <input v-model="workspaceForm.chatbotName" />
              </label>
              <label class="field">
                <span>WhatsApp</span>
                <input v-model="config.profile.supportChannels.whatsapp" />
              </label>
              <label class="field">
                <span>E-mail</span>
                <input v-model="config.profile.supportChannels.email" />
              </label>
              <label class="field">
                <span>Telefone</span>
                <input v-model="config.profile.supportChannels.phone" />
              </label>
              <label class="field field--full">
                <span>Mensagem fora do horário</span>
                <textarea v-model="config.profile.supportChannels.afterHoursMessage" rows="3" />
              </label>
            </div>
            <div class="row-actions">
              <button class="btn-secondary" :disabled="saving === 'institution'" @click="saveProfile">
                Salvar canais institucionais
              </button>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg, #f4f7f6);
  color: var(--text, #10201b);
}

.settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  border-bottom: 1px solid color-mix(in srgb, var(--border, #d9e4df) 82%, transparent);
  background: var(--surface, #ffffff);
}

.settings-head h1 {
  margin: 2px 0 0;
  font-size: 22px;
  line-height: 1.2;
}

.eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--brand, #0f8b6f);
}

.vertical-badge,
.day-pill {
  border: 1px solid color-mix(in srgb, var(--brand, #0f8b6f) 26%, transparent);
  background: color-mix(in srgb, var(--brand, #0f8b6f) 9%, var(--surface, #ffffff));
  color: var(--brand, #0f8b6f);
  border-radius: 999px;
  padding: 7px 12px;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
}

.settings-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 18px;
  padding: 20px 24px 28px;
}

.loading {
  grid-column: 1 / -1;
  display: grid;
  place-items: center;
  min-height: 420px;
}

.tabs {
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-self: start;
  position: sticky;
  top: 16px;
}

.tab {
  height: 44px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--muted, #66736e);
  font-weight: 800;
  text-align: left;
  padding: 0 13px;
  cursor: pointer;
}

.tab--active {
  background: var(--surface, #ffffff);
  color: var(--text, #10201b);
  border-color: color-mix(in srgb, var(--brand, #0f8b6f) 26%, transparent);
  box-shadow: 0 8px 24px rgba(15, 35, 30, 0.08);
}

.panel {
  min-width: 0;
  background: var(--surface, #ffffff);
  border: 1px solid color-mix(in srgb, var(--border, #d9e4df) 88%, transparent);
  border-radius: 10px;
  padding: 18px;
  box-shadow: 0 12px 34px rgba(17, 35, 31, 0.08);
}

.notice {
  margin-bottom: 14px;
}

.tab-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--border, #d9e4df) 70%, transparent);
}

.section-title h2,
.editable-row h3,
.document-group h3,
.subsection {
  margin: 0;
  color: var(--text, #10201b);
}

.section-title p,
.field span,
.course-summary {
  color: var(--muted, #66736e);
}

.section-title p {
  margin: 4px 0 0;
  max-width: 760px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.form-grid--wide {
  grid-template-columns: 2fr 1fr 90px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field--compact {
  flex: 1 1 190px;
}

.field--full {
  grid-column: 1 / -1;
}

.field span {
  font-size: 12px;
  font-weight: 800;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--border, #d9e4df) 90%, transparent);
  border-radius: 8px;
  background: var(--input-bg, #f8fbfa);
  color: var(--text, #10201b);
  font: inherit;
  padding: 10px 11px;
  outline: none;
}

textarea {
  resize: vertical;
  min-height: 86px;
}

input:focus,
textarea:focus,
select:focus {
  border-color: var(--brand, #0f8b6f);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand, #0f8b6f) 14%, transparent);
}

.editable-row,
.document-group,
.preview-box {
  border: 1px solid color-mix(in srgb, var(--border, #d9e4df) 82%, transparent);
  border-radius: 8px;
  padding: 14px;
  background: color-mix(in srgb, var(--surface, #ffffff) 94%, var(--brand, #0f8b6f));
}

.editable-row--new {
  background: color-mix(in srgb, var(--surface, #ffffff) 88%, #edf5ff);
}

.editable-row__head {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  font-weight: 800;
  color: var(--text, #10201b);
  white-space: nowrap;
}

.switch input {
  width: 18px;
  height: 18px;
  accent-color: var(--brand, #0f8b6f);
}

.switch--inline {
  align-self: end;
}

.btn-primary,
.btn-secondary {
  min-height: 40px;
  border-radius: 8px;
  padding: 0 14px;
  font-weight: 900;
  cursor: pointer;
}

.btn-primary {
  border: 1px solid var(--brand, #0f8b6f);
  background: var(--brand, #0f8b6f);
  color: white;
}

.btn-secondary {
  border: 1px solid color-mix(in srgb, var(--brand, #0f8b6f) 32%, transparent);
  background: transparent;
  color: var(--brand, #0f8b6f);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.55;
  cursor: wait;
}

.preview-box strong {
  display: block;
  margin-bottom: 8px;
}

.preview-box p {
  white-space: pre-wrap;
  margin: 0;
  line-height: 1.55;
}

.subsection {
  font-size: 14px;
  padding-top: 4px;
}

.course-summary {
  font-size: 12px;
  font-weight: 800;
}

@media (max-width: 980px) {
  .settings-main {
    grid-template-columns: 1fr;
  }

  .tabs {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .tab {
    flex: 0 0 auto;
    text-align: center;
  }

  .form-grid,
  .form-grid--wide {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .settings-head,
  .section-title {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-main {
    padding: 14px;
  }

  .panel {
    padding: 14px;
  }
}
</style>
