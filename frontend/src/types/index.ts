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
}

export interface SendMessageResponse {
  reply: string
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

export type EnrollmentFieldType = 'text' | 'select' | 'cpf' | 'email' | 'date' | 'cep' | 'phone' | 'document'

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
  studentId: string
  title: string
  studentName: string
  ownerTeam: string
  priority: string
  status?: string
  dueAt: string
  automation: string
  source?: 'automatic' | 'manual'
}

export interface PostSaleAutomation {
  day: number
  title: string
  channel: string
  trigger: string
  message: string
  status: string
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
