<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { NAlert, NIcon, NSpin } from 'naive-ui'
import {
  CardOutline,
  CheckmarkCircleOutline,
  DocumentTextOutline,
  DownloadOutline,
  ShieldCheckmarkOutline,
  TimeOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import { schoolConfigApi, type CommercialPdfKind } from '@/api/schoolConfig'
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
  { key: 'materials', label: 'Materiais' },
  { key: 'attendance', label: 'Atendimento' },
  { key: 'preproduction', label: 'Pré-produção' },
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

const commercialMaterials: Array<{
  kind: CommercialPdfKind
  title: string
  description: string
  filename: string
  icon: Component
}> = [
  {
    kind: 'catalogo-cursos',
    title: 'Catálogo de cursos',
    description: 'Cursos ativos, descrição, duração, modalidade, turnos e valores.',
    filename: 'catalogo-de-cursos.pdf',
    icon: DocumentTextOutline,
  },
  {
    kind: 'tabela-descontos',
    title: 'Tabela de descontos',
    description: 'Campanha, desconto à vista e economia estimada por curso.',
    filename: 'tabela-de-descontos.pdf',
    icon: CardOutline,
  },
  {
    kind: 'fluxo-matricula',
    title: 'Fluxo de matrícula',
    description: 'Etapas, documentos para cada público e caminho até o comprovante.',
    filename: 'fluxo-de-matricula.pdf',
    icon: ShieldCheckmarkOutline,
  },
]

const iaTemplates = computed(() =>
  (config.value?.templates ?? []).filter((template) => template.category === 'ia' || template.category === 'pos_venda'),
)
const rulerTemplates = computed(() =>
  (config.value?.templates ?? []).filter((template) => template.category === 'regua'),
)
const activeCourses = computed(() => (config.value?.courses ?? []).filter((course) => course.active))
const activeIaTemplates = computed(() => iaTemplates.value.filter((template) => template.active))
const activeRulerTemplates = computed(() => rulerTemplates.value.filter((template) => template.active))
const documentsByAudience = computed(() => {
  const groups: Record<string, DocumentRequirementConfig[]> = {}
  for (const document of config.value?.documents ?? []) {
    const audience = document.audience
    if (!groups[audience]) groups[audience] = []
    groups[audience]!.push(document)
  }
  return groups
})
const activeDocumentsByAudience = computed(() => {
  const groups: Record<string, DocumentRequirementConfig[]> = {}
  for (const document of config.value?.documents ?? []) {
    if (!document.active) continue
    const audience = document.audience
    if (!groups[audience]) groups[audience] = []
    groups[audience]!.push(document)
  }
  return groups
})
const requiredRulerDays = [0, 1, 3, 7, 15, 30]
const configuredRulerDays = computed(() =>
  activeRulerTemplates.value
    .map((template) => template.dayOffset)
    .filter((day): day is number => day !== null)
    .sort((a, b) => a - b),
)
const missingRulerDays = computed(() =>
  requiredRulerDays.filter((day) => !configuredRulerDays.value.includes(day)),
)
const readinessGroups = computed(() => {
  const profile = config.value?.profile
  const commercial = config.value?.commercial
  const businessHours = Object.values(profile?.businessHours ?? {}).filter(hasText)
  const supportChannels = Object.values(profile?.supportChannels ?? {}).filter(hasText)
  const documents = activeDocumentsByAudience.value
  const hasForeignDocs = (documents.estrangeiro ?? []).length > 0
  const hasBrazilianDocs = (documents.brasileiro ?? []).length > 0
  const hasMinorDocs = (documents.menor_idade ?? []).length > 0

  return [
    {
      title: 'Demo comercial',
      description: 'O que precisa estar pronto para apresentar e vender sem API externa real.',
      items: [
        {
          title: 'Cursos ativos configurados',
          detail: `${activeCourses.value.length} curso(s) aparecem para IA, PDFs e dashboard.`,
          done: activeCourses.value.length > 0,
          icon: CheckmarkCircleOutline,
          requiredForDemo: true,
        },
        {
          title: 'Materiais comerciais disponíveis',
          detail: 'Catálogo, tabela de descontos e fluxo de matrícula geram PDF pela própria tela.',
          done: true,
          icon: DocumentTextOutline,
          requiredForDemo: true,
        },
        {
          title: 'Oferta e desconto claros',
          detail: commercial?.campaignActive
            ? `Campanha ativa com ${commercial.cashDiscountPercent ?? 0}% à vista.`
            : 'Campanha desativada; a IA ainda usa a condição padrão configurada.',
          done: hasText(commercial?.promotionText) && commercial?.cashDiscountPercent !== null,
          icon: CardOutline,
          requiredForDemo: true,
        },
        {
          title: 'Dashboard executivo no ar',
          detail: 'Gestor vê receita, gargalos, risco, automações, funil e conversão por curso.',
          done: true,
          icon: CheckmarkCircleOutline,
          requiredForDemo: true,
        },
      ],
    },
    {
      title: 'Atendimento e matrícula',
      description: 'Dados que evitam a IA improvisar respostas ou pedir algo errado.',
      items: [
        {
          title: 'Horários de atendimento preenchidos',
          detail: `${businessHours.length} campos de horário com resposta configurada.`,
          done: businessHours.length >= 5,
          icon: TimeOutline,
          requiredForDemo: true,
        },
        {
          title: 'Localização e condução preenchidas',
          detail: 'Endereço, mapa, referência e transporte são usados em perguntas frequentes.',
          done:
            hasText(profile?.address) &&
            hasText(profile?.city) &&
            hasText(profile?.mapLink) &&
            hasText(profile?.transportInfo),
          icon: CheckmarkCircleOutline,
          requiredForDemo: true,
        },
        {
          title: 'Documentos por tipo de aluno',
          detail: `Brasileiro: ${hasBrazilianDocs ? 'ok' : 'faltando'} · estrangeiro: ${hasForeignDocs ? 'ok' : 'faltando'} · menor: ${hasMinorDocs ? 'ok' : 'faltando'}.`,
          done: hasBrazilianDocs && hasForeignDocs && hasMinorDocs,
          icon: ShieldCheckmarkOutline,
          requiredForDemo: true,
        },
        {
          title: 'Mensagens humanizadas ativas',
          detail: `${activeIaTemplates.value.length} template(s) ativos para IA e pós-venda.`,
          done: activeIaTemplates.value.length >= 6,
          icon: CheckmarkCircleOutline,
          requiredForDemo: true,
        },
        {
          title: 'Régua dia 0/1/3/7/15/30 pronta',
          detail: missingRulerDays.value.length
            ? `Faltam dias: ${missingRulerDays.value.join(', ')}.`
            : 'Todos os marcos principais estão ativos.',
          done: missingRulerDays.value.length === 0,
          icon: CheckmarkCircleOutline,
          requiredForDemo: true,
        },
        {
          title: 'Canais de suporte configurados',
          detail: `${supportChannels.length} canal(is)/mensagens de suporte preenchidos.`,
          done: supportChannels.length >= 3 && hasText(workspaceForm.value.chatbotName),
          icon: CheckmarkCircleOutline,
          requiredForDemo: true,
        },
      ],
    },
    {
      title: 'Integrações reais futuras',
      description: 'Não bloqueiam a demo; mostram o que será trocado depois dos mocks.',
      items: [
        {
          title: 'WhatsApp Cloud API oficial',
          detail: 'Próximo passo: app Meta, número, webhook e templates aprovados.',
          done: false,
          icon: TimeOutline,
          requiredForDemo: false,
        },
        {
          title: 'Pagamento real',
          detail: 'Trocar PaymentService fake por gateway sem mexer na UI.',
          done: false,
          icon: TimeOutline,
          requiredForDemo: false,
        },
        {
          title: 'Assinatura digital',
          detail: 'Trocar ContractService fake por D4Sign/Clicksign quando aprovado.',
          done: false,
          icon: TimeOutline,
          requiredForDemo: false,
        },
        {
          title: 'Projeto mãe / AVA',
          detail: 'Conectar matrícula confirmada ao banco/API do sistema principal.',
          done: false,
          icon: TimeOutline,
          requiredForDemo: false,
        },
      ],
    },
  ]
})
const readinessItems = computed(() =>
  readinessGroups.value.flatMap((group) => group.items).filter((item) => item.requiredForDemo),
)
const readinessDone = computed(() => readinessItems.value.filter((item) => item.done).length)
const readinessScore = computed(() =>
  readinessItems.value.length ? Math.round((readinessDone.value / readinessItems.value.length) * 100) : 0,
)
const readinessStatus = computed(() => {
  if (readinessScore.value >= 90) return 'Demo pronta para venda'
  if (readinessScore.value >= 70) return 'Quase pronto'
  return 'Ajustes importantes pendentes'
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

async function downloadCommercialPdf(material: (typeof commercialMaterials)[number]) {
  await runSaving(`pdf-${material.kind}`, async () => {
    await schoolConfigApi.downloadCommercialPdf(material.kind, material.filename)
    flash(`PDF "${material.title}" gerado.`)
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

function hasText(value: unknown) {
  return String(value ?? '').trim().length > 0
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

          <div v-else-if="activeTab === 'materials'" class="tab-body">
            <div class="section-title">
              <div>
                <h2>Materiais comerciais</h2>
                <p>PDFs gerados com cursos, descontos, documentos, horários e localização configurados pela escola.</p>
              </div>
            </div>

            <div class="materials-grid">
              <article v-for="material in commercialMaterials" :key="material.kind" class="material-card">
                <span class="material-card__icon">
                  <NIcon :component="material.icon" size="22" />
                </span>
                <div>
                  <h3>{{ material.title }}</h3>
                  <p>{{ material.description }}</p>
                </div>
                <button class="btn-primary" :disabled="saving === `pdf-${material.kind}`" @click="downloadCommercialPdf(material)">
                  <NIcon :component="DownloadOutline" size="16" />
                  {{ saving === `pdf-${material.kind}` ? 'Gerando...' : 'Baixar PDF' }}
                </button>
              </article>
            </div>

            <div class="preview-box">
              <strong>Como estes PDFs são montados</strong>
              <p>
                O catálogo usa apenas cursos ativos. A tabela usa os descontos configurados. O fluxo de matrícula usa os documentos exigidos para aluno brasileiro, estrangeiro e menor de idade.
              </p>
            </div>
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

          <div v-else-if="activeTab === 'preproduction'" class="tab-body">
            <div class="section-title">
              <div>
                <h2>Pré-produção e demo comercial</h2>
                <p>Checklist para apresentar o produto com segurança antes de conectar WhatsApp, contrato, gateway ou AVA reais.</p>
              </div>
            </div>

            <section class="readiness-hero">
              <div>
                <span>Prontidão da demo</span>
                <strong>{{ readinessScore }}%</strong>
                <p>{{ readinessStatus }} · {{ readinessDone }}/{{ readinessItems.length }} itens essenciais concluídos.</p>
              </div>
              <div class="readiness-meter" aria-label="Prontidão da demo">
                <i :style="{ width: `${readinessScore}%` }"></i>
              </div>
            </section>

            <section class="readiness-grid">
              <article v-for="group in readinessGroups" :key="group.title" class="readiness-group">
                <div class="readiness-group__head">
                  <h3>{{ group.title }}</h3>
                  <p>{{ group.description }}</p>
                </div>

                <div class="readiness-list">
                  <div
                    v-for="item in group.items"
                    :key="item.title"
                    class="readiness-item"
                    :class="{ 'readiness-item--done': item.done, 'readiness-item--future': !item.requiredForDemo }"
                  >
                    <span class="readiness-item__icon">
                      <NIcon :component="item.done ? CheckmarkCircleOutline : item.icon" size="18" />
                    </span>
                    <div>
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.detail }}</small>
                    </div>
                    <em v-if="item.requiredForDemo">{{ item.done ? 'OK' : 'Ajustar' }}</em>
                    <em v-else>Futuro</em>
                  </div>
                </div>
              </article>
            </section>

            <section class="demo-script">
              <h3>Roteiro rápido para vender a demo</h3>
              <ol>
                <li>Entrar pelo simulador e mostrar a IA respondendo cursos, descontos, horário, localização e documentos.</li>
                <li>Abrir uma matrícula em andamento e mostrar que o aluno pode enviar PDF único ou documento por documento.</li>
                <li>Mostrar ficha do aluno com documentos, pagamento fake, contrato fake, timeline e risco de evasão.</li>
                <li>Abrir o dashboard e explicar receita prevista, gargalos, ações do dia e automações disparadas.</li>
                <li>Fechar em Configurações mostrando que a própria escola edita mensagens, cursos, descontos e documentos.</li>
              </ol>
            </section>
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

.materials-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.material-card {
  min-height: 236px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--border, #d9e4df) 82%, transparent);
  border-radius: 8px;
  padding: 16px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--brand, #0f8b6f) 8%, transparent), transparent 48%),
    var(--surface, #ffffff);
  box-shadow: 0 10px 28px rgba(17, 35, 31, 0.08);
}

.material-card__icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--brand, #0f8b6f);
  background: color-mix(in srgb, var(--brand, #0f8b6f) 11%, var(--surface, #ffffff));
}

.material-card h3 {
  margin: 0;
  color: var(--text, #10201b);
  font-size: 16px;
}

.material-card p {
  margin: 6px 0 0;
  color: var(--muted, #66736e);
  font-size: 13px;
  line-height: 1.45;
}

.material-card button {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.readiness-hero {
  display: grid;
  grid-template-columns: minmax(0, 0.55fr) minmax(260px, 0.45fr);
  gap: 18px;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--brand, #0f8b6f) 28%, transparent);
  border-radius: 8px;
  padding: 18px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--brand, #0f8b6f) 12%, transparent), transparent 62%),
    var(--surface, #ffffff);
}

.readiness-hero span {
  color: var(--brand, #0f8b6f);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.readiness-hero strong {
  display: block;
  margin-top: 8px;
  color: var(--text, #10201b);
  font-size: 42px;
  line-height: 1;
  font-weight: 950;
}

.readiness-hero p {
  margin: 8px 0 0;
  color: var(--muted, #66736e);
  font-weight: 750;
}

.readiness-meter {
  height: 16px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--border, #d9e4df) 72%, transparent);
  overflow: hidden;
}

.readiness-meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--brand, #0f8b6f), var(--accent-strong, #14a85a));
}

.readiness-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.readiness-group {
  border: 1px solid color-mix(in srgb, var(--border, #d9e4df) 82%, transparent);
  border-radius: 8px;
  padding: 14px;
  background: color-mix(in srgb, var(--surface, #ffffff) 96%, var(--brand, #0f8b6f));
}

.readiness-group__head h3,
.demo-script h3 {
  margin: 0;
  color: var(--text, #10201b);
}

.readiness-group__head p {
  margin: 5px 0 0;
  color: var(--muted, #66736e);
  font-size: 13px;
  line-height: 1.45;
}

.readiness-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.readiness-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 72px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--border, #d9e4df) 76%, transparent);
  border-radius: 8px;
  background: var(--surface, #ffffff);
}

.readiness-item__icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--warning, #b7791f);
  background: color-mix(in srgb, var(--warning, #b7791f) 12%, transparent);
}

.readiness-item--done .readiness-item__icon {
  color: var(--brand, #0f8b6f);
  background: color-mix(in srgb, var(--brand, #0f8b6f) 12%, transparent);
}

.readiness-item--future .readiness-item__icon {
  color: var(--muted, #66736e);
  background: color-mix(in srgb, var(--muted, #66736e) 10%, transparent);
}

.readiness-item strong {
  display: block;
  color: var(--text, #10201b);
  font-size: 13px;
}

.readiness-item small {
  display: block;
  margin-top: 3px;
  color: var(--muted, #66736e);
  font-size: 12px;
  line-height: 1.35;
}

.readiness-item em {
  color: var(--muted, #66736e);
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  text-transform: uppercase;
}

.readiness-item--done em {
  color: var(--brand, #0f8b6f);
}

.demo-script {
  border: 1px solid color-mix(in srgb, var(--border, #d9e4df) 82%, transparent);
  border-radius: 8px;
  padding: 16px 18px;
  background: var(--surface, #ffffff);
}

.demo-script ol {
  margin: 12px 0 0;
  padding-left: 20px;
  color: var(--muted-strong, #4d625d);
  line-height: 1.55;
  font-weight: 750;
}

.demo-script li + li {
  margin-top: 6px;
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
  .form-grid--wide,
  .materials-grid,
  .readiness-hero,
  .readiness-grid {
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
