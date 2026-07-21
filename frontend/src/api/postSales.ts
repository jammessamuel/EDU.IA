import { apiClient } from './client'
import type {
  PostSaleAction,
  PostSaleAlertDispatchResponse,
  PostSaleFakeActionResponse,
  PostSaleIntegrationLog,
  PostSaleOverview,
  PostSaleRulerResponse,
  PostSaleSimulatedMessageResponse,
  PostSaleStudentProfile,
  PostSaleToday,
  ContactAttempt,
  ContactInput,
} from '@/types'

export const postSalesApi = {
  overview(includeDemo = false): Promise<PostSaleOverview> {
    return apiClient
      .get<PostSaleOverview>('/post-sales/overview', { params: { includeDemo } })
      .then((res) => res.data)
  },

  today(onlyMine = false): Promise<PostSaleToday> {
    return apiClient
      .get<PostSaleToday>('/post-sales/today', { params: { onlyMine } })
      .then((res) => res.data)
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

  registerContact(
    studentId: string,
    input: ContactInput,
  ): Promise<{ contact: ContactAttempt; overview: PostSaleOverview }> {
    return apiClient
      .post<{ contact: ContactAttempt; overview: PostSaleOverview }>(
        `/post-sales/students/${studentId}/contacts`,
        input,
      )
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

  assignStudent(studentId: string, assigneeId: string | null): Promise<PostSaleOverview> {
    return apiClient
      .patch<PostSaleOverview>(`/post-sales/students/${studentId}/assignee`, { assigneeId })
      .then((res) => res.data)
  },

  updateLifecycle(
    studentId: string,
    input: {
      status: 'ATIVO' | 'PAUSADO' | 'ENCERRADO'
      reason?: string
      nextActionAt?: string | null
    },
  ): Promise<PostSaleOverview> {
    return apiClient
      .patch<PostSaleOverview>(`/post-sales/students/${studentId}/lifecycle`, input)
      .then((res) => res.data)
  },

  updateOperationalPayment(
    studentId: string,
    status: 'PENDENTE' | 'PAGO' | 'APROVADO' | 'FALHOU' | 'ESTORNADO',
    note?: string,
  ): Promise<PostSaleOverview> {
    return apiClient
      .patch<PostSaleOverview>(`/post-sales/students/${studentId}/operations/payment`, {
        status,
        note,
      })
      .then((res) => res.data)
  },

  updateOperationalContract(
    studentId: string,
    status: 'PENDENTE' | 'ENVIADO' | 'ASSINADO' | 'RECUSADO' | 'EXPIRADO',
    note?: string,
  ): Promise<PostSaleOverview> {
    return apiClient
      .patch<PostSaleOverview>(`/post-sales/students/${studentId}/operations/contract`, {
        status,
        note,
      })
      .then((res) => res.data)
  },

  createTask(
    studentId: string,
    input: {
      title: string
      description?: string
      ownerTeam?: string
      assignee?: string
      assigneeId?: string | null
      role?: string
      priority?: string
      dueInDays?: number
      dueAt?: string
      column?: string
      origin?: string
      reminderDaysBefore?: number | null
      recurrenceIntervalDays?: number | null
    },
  ): Promise<PostSaleOverview> {
    return apiClient
      .post<PostSaleOverview>(`/post-sales/students/${studentId}/tasks`, input)
      .then((res) => res.data)
  },

  createManualTask(input: {
    title: string
    description?: string
    studentKey?: string | null
    studentName?: string
    ownerTeam?: string
    assignee?: string
    assigneeId?: string | null
    role?: string
    priority?: string
    dueAt?: string
    column?: string
    origin?: string
    reminderDaysBefore?: number | null
    recurrenceIntervalDays?: number | null
  }): Promise<PostSaleOverview> {
    return apiClient.post<PostSaleOverview>('/post-sales/tasks', input).then((res) => res.data)
  },

  updateTask(
    taskId: string,
    input: {
      column?: string
      status?: string
      assignee?: string
      assigneeId?: string | null
      role?: string
      priority?: string
      title?: string
      description?: string
      dueAt?: string | null
      recurrenceIntervalDays?: number | null
      action?: 'CANCEL' | 'REOPEN'
    },
  ): Promise<PostSaleOverview> {
    return apiClient
      .patch<PostSaleOverview>(`/post-sales/tasks/${taskId}`, input)
      .then((res) => res.data)
  },

  dispatchAlert(taskId: string): Promise<PostSaleAlertDispatchResponse> {
    return apiClient
      .post<PostSaleAlertDispatchResponse>(`/post-sales/tasks/${taskId}/alert/dispatch`)
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
