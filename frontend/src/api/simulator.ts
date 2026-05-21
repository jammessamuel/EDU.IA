import { apiClient } from './client'
import type { SendMessageResponse, Lead, ResetSessionResponse } from '@/types'

export const simulatorApi = {
  sendMessage(text: string): Promise<SendMessageResponse> {
    return apiClient
      .post<SendMessageResponse>('/simulator/messages', { text })
      .then((res) => res.data)
  },

  resetSession(): Promise<ResetSessionResponse> {
    return apiClient
      .delete<ResetSessionResponse>('/simulator/session')
      .then((res) => res.data)
  },

  getLeads(): Promise<Lead[]> {
    return apiClient
      .get<Lead[]>('/simulator/leads')
      .then((res) => res.data)
  },
}
