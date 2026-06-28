export interface VerticalField {
  name: string
  label: string
  type: 'text' | 'select'
  options: string[] | null
  required: boolean
  order: number
}

export interface VerticalStage {
  key: string
  label: string
  color: string
}

export interface Vertical {
  id: string
  slug: string
  name: string
  icon: string
  color: string
  fields: VerticalField[]
  stages: VerticalStage[]
}

export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'

export interface AccessibilityProfile {
  screenReader: boolean
  highContrast: boolean
  colorBlindMode: ColorBlindMode
  reduceMotion: boolean
  simpleLanguage: boolean
  fontScale: number
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Lead {
  id: string
  name: string
  phone?: string
  data: Record<string, string>
  conversation: ConversationMessage[]
  qualified: boolean
  status: string
  createdAt: string
  updatedAt?: string
}

export type MessageSender = 'user' | 'ai'

export interface ChatMessage {
  id: string
  from: MessageSender
  text: string
  timestamp: Date
  attachments?: ChatAttachment[]
}

export type ChatAttachmentAction = 'open' | 'download'

export interface ChatAttachment {
  id: string
  type: 'pdf'
  title: string
  description?: string
  filename?: string
  url?: string
  pdfKind?: 'catalogo-cursos' | 'tabela-descontos' | 'fluxo-matricula'
  action: ChatAttachmentAction
  mimeType: 'application/pdf'
}

export interface SendMessageResponse {
  reply: string
  attachments?: ChatAttachment[]
  lead: Lead | null
  mode?: 'lead' | 'enrollment'
  enrollmentDraft?: Record<string, unknown> | null
  enrollment?: Enrollment | null
  accessibility?: AccessibilityProfile | null
}

export interface Metrics {
  total: number
  conversionRate: number
  byStatus: Record<string, number>
  byField: Record<string, Record<string, number>>
  byDay: { date: string; count: number }[]
}

export type EnrollmentFieldType =
  | 'text'
  | 'select'
  | 'cpf'
  | 'email'
  | 'date'
  | 'cep'
  | 'phone'
  | 'document'

export type EnrollmentSection =
  | 'pessoais'
  | 'contato'
  | 'endereco'
  | 'academico'
  | 'escolaridade'
  | 'responsavel'
  | 'pagamento'

export type EnrollmentSections = Record<EnrollmentSection, string>

export interface EnrollmentField {
  name: string
  label: string
  section: EnrollmentSection
  type: EnrollmentFieldType
  options?: string[]
  required: boolean
  requiredIf?: 'menor_de_idade' | 'brasileiro'
}

export interface Enrollment {
  id: string
  number: string
  status: string
  studentName: string
  cpf?: string | null
  documentType?: string | null
  documentNumber?: string | null
  preferredLanguage?: string | null
  countryOfResidence?: string | null
  email?: string | null
  phone?: string | null
  course?: string | null
  shift?: string | null
  unit?: string | null
  data: Record<string, unknown>
  paymentStatus: string
  paymentMethod?: string | null
  paymentAmount?: number | null
  paymentRef?: string | null
  authCode: string
  createdAt: string
  confirmedAt?: string | null
  schoolName?: string
  documentsCount?: number
}

export interface EnrollmentDocument {
  id: string
  enrollmentId: string
  type: string
  fileName: string
  storagePath: string
  mimeType?: string | null
  size?: number | null
  uploadedAt: string
}

export interface EnrollmentChatResponse {
  reply: string
  draft: Record<string, unknown>
  enrollment: Enrollment | null
  accessibility?: AccessibilityProfile | null
}

export interface EnrollmentVerifyResponse {
  valid: boolean
  enrollment: Enrollment
}

export type PostSaleLifecycleStatus =
  | 'DOCUMENTACAO_PENDENTE'
  | 'CONTRATO_PENDENTE'
  | 'PAGAMENTO_PENDENTE'
  | 'ACESSO_PENDENTE'
  | 'EM_ACOMPANHAMENTO'
  | 'RISCO_EVASAO'
  | 'ONBOARDING_CONCLUIDO'

export type PostSaleRiskLevel = 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO'
export type PostSaleStepStatus = 'done' | 'pending' | 'blocked' | 'attention'
export type PostSaleAction =
  | 'DOCUMENTS_RECEIVED'
  | 'CONTRACT_SENT'
  | 'CONTRACT_SIGNED'
  | 'PAYMENT_PAID'
  | 'ACCESS_RELEASED'
  | 'RISK_RESOLVED'

export interface PostSaleChecklistStep {
  key: string
  label: string
  status: PostSaleStepStatus
  helper: string
}

export interface PostSaleTimelineEvent {
  id: string
  type: string
  title: string
  description: string
  createdAt: string
  source: 'system' | 'manual'
}

export interface PostSaleRulerStatus {
  status: 'PENDENTE' | 'AGENDADA' | 'CONCLUIDA'
  nextDay: number | null
  nextTitle: string | null
  nextMessage: string | null
  sentDays: number[]
  sentCount: number
  pendingCount: number
  lastSentAt: string | null
}

export interface PostSaleStudent {
  id: string
  enrollmentId: string | null
  studentName: string
  course: string
  startedAt: string
  status: PostSaleLifecycleStatus
  statusLabel: string
  progress: number
  riskScore: number
  riskLevel: PostSaleRiskLevel
  documentStatus: string
  contractStatus: string
  paymentStatus: string
  accessStatus: string
  nextAction: string
  ownerTeam: string
  daysSinceEnrollment: number
  lastContactAt: string
  upcomingDueAt: string
  checklist: PostSaleChecklistStep[]
  timeline: PostSaleTimelineEvent[]
  ruler: PostSaleRulerStatus
  isDemo: boolean
}

export interface PostSaleSummary {
  totalStudents: number
  documentsPending: number
  contractsPending: number
  paymentsPending: number
  accessPending: number
  highRisk: number
  onboardingComplete: number
  automationsQueued: number
  averageProgress: number
}

export interface PostSaleFunnelStage {
  key: PostSaleLifecycleStatus
  label: string
  color: string
  count: number
}

export interface PostSaleTask {
  id: string
  studentId: string | null
  leadId?: string | null
  title: string
  studentName: string
  ownerTeam: string
  assignee?: string
  role?: 'comercial' | 'financeiro' | 'sucesso_do_aluno' | 'secretaria' | 'gestor' | string
  priority: string
  status?: string
  column?:
    | 'a_fazer'
    | 'em_andamento'
    | 'aguardando_aluno'
    | 'aguardando_financeiro'
    | 'concluido'
    | string
  origin?:
    | 'ia'
    | 'matricula'
    | 'documento'
    | 'pagamento'
    | 'contrato'
    | 'risco_evasao'
    | 'lead'
    | 'manual'
    | string
  createdBy?: 'humano' | 'automacao' | string
  relatedEntity?: Record<string, unknown> | string | null
  autoResolve?: boolean
  dueAt: string
  automation: string
  source?: 'automatic' | 'manual'
  firstMovedAt?: string | null
  resolvedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface PostSaleAutomation {
  day: number
  title: string
  channel: string
  trigger: string
  message: string
  status: string
  sentCount: number
  pendingCount: number
  scheduledCount: number
}

export interface PostSaleMessageTemplate {
  title: string
  text: string
}

export interface PostSaleIntegrationLog {
  id: string
  schoolId: string
  studentKey: string | null
  enrollmentId: string | null
  studentName: string | null
  service: 'WHATSAPP' | 'PAGAMENTO' | 'CONTRATO' | 'DOCUMENTOS'
  action: string
  status: string
  requestPayload: Record<string, unknown>
  responsePayload: Record<string, unknown>
  visibleMessage: string
  createdAt: string
}

export interface PostSaleOverview {
  generatedAt: string
  hasDemoData: boolean
  summary: PostSaleSummary
  funnel: PostSaleFunnelStage[]
  students: PostSaleStudent[]
  tasks: PostSaleTask[]
  automations: PostSaleAutomation[]
  messageTemplates: PostSaleMessageTemplate[]
  integrationLogs: PostSaleIntegrationLog[]
}

export interface PostSaleSimulatedMessageResponse {
  message: string
  log: PostSaleIntegrationLog
  overview: PostSaleOverview
}

export interface PostSaleFakeActionResponse {
  result: Record<string, unknown>
  overview: PostSaleOverview
}

export interface PostSaleRulerResponse {
  result: {
    day: number
    title: string
    message: string
    log: PostSaleIntegrationLog
  }
  overview: PostSaleOverview
}

export interface PostSaleProfileField {
  section: string
  label: string
  value: string
}

export interface PostSaleProfileCourse {
  id: string | null
  schoolId?: string
  name: string
  description: string | null
  duration: string | null
  modality: string | null
  shifts: string[]
  enrollmentFee: number | null
  monthlyFee: number | null
  cashDiscountPercent: number | null
  active: boolean
  updatedAt: string
}

export interface PostSaleProfileDocumentRequirement {
  audience: string
  documentType: string
  instructions: string
  required: boolean
  status: 'RECEBIDO' | 'PENDENTE' | 'OPCIONAL' | string
  reason: string | null
  fileName: string | null
  uploadedAt: string | null
  updatedAt: string | null
}

export interface PostSaleStudentProfile {
  generatedAt: string
  student: PostSaleStudent
  enrollment: Enrollment | null
  personalData: PostSaleProfileField[]
  course: PostSaleProfileCourse | null
  documents: {
    checklist: PostSaleChecklistStep[]
    requirements: PostSaleProfileDocumentRequirement[]
    summary: {
      total: number
      required: number
      pending: number
      received: number
      approved: number
      rejected: number
    }
    uploaded: EnrollmentDocument[]
    lastLog: PostSaleIntegrationLog | null
  }
  payment: {
    status: string
    amount: number | null
    method: string | null
    reference: string | null
    lastLog: PostSaleIntegrationLog | null
  }
  contract: {
    status: string
    lastLog: PostSaleIntegrationLog | null
  }
  messages: PostSaleIntegrationLog[]
  timeline: PostSaleTimelineEvent[]
  nextActions: PostSaleTask[]
  ruler: PostSaleRulerStatus
  risk: {
    score: number
    level: PostSaleRiskLevel
    label: string
    reasons: string[]
  }
}

export interface SchoolProfileConfig {
  id: string
  schoolId: string
  businessHours: Record<string, string>
  address: string
  city: string
  state: string
  mapLink: string
  referencePoints: string
  transportInfo: string
  supportChannels: Record<string, string>
  updatedAt: string
}

export interface CommunicationTemplateConfig {
  id: string
  schoolId: string
  key: string
  title: string
  stage: string
  category: 'ia' | 'pos_venda' | 'regua' | string
  dayOffset: number | null
  whatsappText: string
  defaultWhatsappText: string
  active: boolean
  order: number
  updatedAt: string
}

export interface CourseOfferConfig {
  id: string
  schoolId: string
  name: string
  description: string
  duration: string
  modality: string
  shifts: string[]
  enrollmentFee: number | null
  monthlyFee: number | null
  cashDiscountPercent: number | null
  active: boolean
  updatedAt: string
}

export interface DocumentRequirementConfig {
  id: string
  schoolId: string
  audience: 'brasileiro' | 'estrangeiro' | 'menor_idade' | string
  documentType: string
  instructions: string
  required: boolean
  active: boolean
  order: number
  updatedAt: string
}

export interface CommercialConditionConfig {
  id: string
  schoolId: string
  cashDiscountPercent: number | null
  campaignActive: boolean
  campaignValidUntil: string | null
  promotionText: string
  updatedAt: string
}

export interface SchoolConfigOverview {
  profile: SchoolProfileConfig
  templates: CommunicationTemplateConfig[]
  courses: CourseOfferConfig[]
  documents: DocumentRequirementConfig[]
  commercial: CommercialConditionConfig
}

export interface TemplatePreviewResponse {
  key: string
  title: string
  rendered: string
  variables: Record<string, string | number | boolean | null>
}
