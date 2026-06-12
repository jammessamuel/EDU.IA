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
}

export interface EnrollmentVerifyResponse {
  valid: boolean
  enrollment: Enrollment
}
