import { apiClient } from './client'
import type { SendMessageResponse, Lead } from '@/types'

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export const simulatorApi = {
  sendMessage(text: string, history: HistoryMessage[]): Promise<SendMessageResponse> {
    return apiClient
      .post<SendMessageResponse>('/simulator/messages', { text, history })
      .then((res) => res.data)
  },

  getLeads(): Promise<Lead[]> {
    return apiClient
      .get<Lead[]>('/simulator/leads')
      .then((res) => res.data)
  },

  updateLeadStatus(id: string, status: string): Promise<Lead> {
    return apiClient
      .patch<Lead>(`/simulator/leads/${id}/status`, { status })
      .then((res) => res.data)
  },
}
