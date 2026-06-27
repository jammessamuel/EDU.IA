import { apiClient } from './client'
import type {
  PostSaleAction,
  PostSaleFakeActionResponse,
  PostSaleIntegrationLog,
  PostSaleOverview,
  PostSaleRulerResponse,
  PostSaleSimulatedMessageResponse,
  PostSaleStudentProfile,
} from '@/types'

export const postSalesApi = {
  overview(): Promise<PostSaleOverview> {
    return apiClient.get<PostSaleOverview>('/post-sales/overview').then((res) => res.data)
  },

  integrationLogs(): Promise<PostSaleIntegrationLog[]> {
    return apiClient
      .get<PostSaleIntegrationLog[]>('/post-sales/integration-logs')
      .then((res) => res.data)
  },

  studentProfile(studentId: string): Promise<PostSaleStudentProfile> {
    return apiClient
      .get<PostSaleStudentProfile>(`/post-sales/students/${studentId}/profile`)
      .then((res) => res.data)
  },

  updateStatus(
    studentId: string,
    action: PostSaleAction,
    note?: string,
  ): Promise<PostSaleOverview> {
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

  updateTask(
    taskId: string,
    input: {
      column?: string
      status?: string
      assignee?: string
      role?: string
      priority?: string
    },
  ): Promise<PostSaleOverview> {
    return apiClient
      .patch<PostSaleOverview>(`/post-sales/tasks/${taskId}`, input)
      .then((res) => res.data)
  },

  simulateMessage(studentId: string, message?: string): Promise<PostSaleSimulatedMessageResponse> {
    return apiClient
      .post<PostSaleSimulatedMessageResponse>(
        `/post-sales/students/${studentId}/messages/simulate`,
        { message },
      )
      .then((res) => res.data)
  },

  simulateRuler(studentId: string, dayOffset?: number | null): Promise<PostSaleRulerResponse> {
    return apiClient
      .post<PostSaleRulerResponse>(`/post-sales/students/${studentId}/ruler/simulate`, {
        dayOffset,
      })
      .then((res) => res.data)
  },

  simulatePayment(
    studentId: string,
    action: 'MARK_PAID' | 'FAIL' | 'REFUND' | 'PENDING',
  ): Promise<PostSaleFakeActionResponse> {
    return apiClient
      .post<PostSaleFakeActionResponse>(`/post-sales/students/${studentId}/fake/payment`, {
        action,
      })
      .then((res) => res.data)
  },

  simulateContract(
    studentId: string,
    action: 'SEND' | 'VIEW' | 'SIGN' | 'EXPIRE',
  ): Promise<PostSaleFakeActionResponse> {
    return apiClient
      .post<PostSaleFakeActionResponse>(`/post-sales/students/${studentId}/fake/contract`, {
        action,
      })
      .then((res) => res.data)
  },

  simulateDocument(
    studentId: string,
    action: 'RECEIVE' | 'APPROVE' | 'REJECT',
    input: { documentType?: string; reason?: string; fileName?: string } = {},
  ): Promise<PostSaleFakeActionResponse> {
    return apiClient
      .post<PostSaleFakeActionResponse>(`/post-sales/students/${studentId}/fake/document`, {
        action,
        documentType: input.documentType ?? 'Pacote de matrícula',
        reason: input.reason,
        fileName: input.fileName,
      })
      .then((res) => res.data)
  },
}
