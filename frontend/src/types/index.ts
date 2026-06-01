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

export interface Lead {
  id: string
  name: string
  phone?: string
  data: Record<string, string>
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
}

export interface Metrics {
  total: number
  conversionRate: number
  byStatus: Record<string, number>
  byField: Record<string, Record<string, number>>
  byDay: { date: string; count: number }[]
}
