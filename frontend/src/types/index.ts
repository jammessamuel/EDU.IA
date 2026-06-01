export interface Lead {
  id: string
  name: string
  course: string
  unit: string
  shift: string
  qualified: boolean
  status: string
  createdAt: string
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
