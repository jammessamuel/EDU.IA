import { apiClient } from './client'
import type { PostSaleAction, PostSaleOverview, PostSaleSimulatedMessageResponse } from '@/types'

export const postSalesApi = {
  overview(): Promise<PostSaleOverview> {
    return apiClient.get<PostSaleOverview>('/post-sales/overview').then((res) => res.data)
  },

  updateStatus(studentId: string, action: PostSaleAction, note?: string): Promise<PostSaleOverview> {
    return apiClient
      .patch<PostSaleOverview>(`/post-sales/students/${studentId}/status`, { action, note })
      .then((res) => res.data)
  },

  createTask(
    studentId: string,
    input: { title: string; ownerTeam?: string; priority?: string; dueInDays?: number },
  ): Promise<PostSaleOverview> {
    return apiClient
      .post<PostSaleOverview>(`/post-sales/students/${studentId}/tasks`, input)
      .then((res) => res.data)
  },

  simulateMessage(studentId: string, message?: string): Promise<PostSaleSimulatedMessageResponse> {
    return apiClient
      .post<PostSaleSimulatedMessageResponse>(`/post-sales/students/${studentId}/messages/simulate`, { message })
      .then((res) => res.data)
  },
}
