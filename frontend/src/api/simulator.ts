import { apiClient } from './client'
import type { SendMessageResponse, Lead, Metrics, VerticalField, VerticalStage } from '@/types'

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
    return apiClient.get<Lead[]>('/simulator/leads').then((res) => res.data)
  },

  getMetrics(): Promise<Metrics> {
    return apiClient.get<Metrics>('/simulator/metrics').then((res) => res.data)
  },

  getStaleLeads(): Promise<Lead[]> {
    return apiClient.get<Lead[]>('/simulator/leads/stale').then((res) => res.data)
  },

  getSchoolSettings(): Promise<{
    name: string
    chatbotName: string
    fields: VerticalField[]
    stages: VerticalStage[]
  }> {
    return apiClient.get('/simulator/school/settings').then((r) => r.data)
  },

  updateSchoolSettings(data: {
    name?: string
    chatbotName?: string
    customFields?: VerticalField[]
    customStages?: VerticalStage[]
  }) {
    return apiClient.put('/simulator/school/settings', data).then((r) => r.data)
  },

  updateLeadStatus(id: string, status: string): Promise<Lead> {
    return apiClient
      .patch<Lead>(`/simulator/leads/${id}/status`, { status })
      .then((res) => res.data)
  },
}
