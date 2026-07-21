import { apiClient } from './client'
import type {
  ContactAttempt,
  ContactInput,
  Lead,
  Metrics,
  SendMessageResponse,
  VerticalField,
  VerticalStage,
} from '@/types'

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export const simulatorApi = {
  sendMessage(
    text: string,
    history: HistoryMessage[],
    enrollmentDraft: Record<string, unknown>,
  ): Promise<SendMessageResponse> {
    return apiClient
      .post<SendMessageResponse>('/simulator/messages', { text, history, enrollmentDraft })
      .then((res) => res.data)
  },

  getLeads(): Promise<Lead[]> {
    return apiClient.get<Lead[]>('/simulator/leads').then((res) => res.data)
  },

  createLead(input: {
    name: string
    phone?: string | null
    data?: Record<string, unknown>
    status?: string
    assigneeId?: string | null
  }): Promise<Lead> {
    return apiClient.post<Lead>('/simulator/leads', input).then((res) => res.data)
  },

  updateLead(
    id: string,
    input: { name?: string; phone?: string | null; data?: Record<string, unknown> },
  ): Promise<Lead> {
    return apiClient.patch<Lead>(`/simulator/leads/${id}`, input).then((res) => res.data)
  },

  getLeadContacts(id: string): Promise<ContactAttempt[]> {
    return apiClient
      .get<ContactAttempt[]>(`/simulator/leads/${id}/contacts`)
      .then((res) => res.data)
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

  updateLeadAssignee(id: string, assigneeId: string | null): Promise<Lead> {
    return apiClient
      .patch<Lead>(`/simulator/leads/${id}/assignee`, { assigneeId })
      .then((res) => res.data)
  },

  registerLeadContact(id: string, input: ContactInput): Promise<Lead> {
    return apiClient
      .post<Lead>(`/simulator/leads/${id}/contacts`, input)
      .then((res) => res.data)
  },
}
