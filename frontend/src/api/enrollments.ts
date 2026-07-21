import { apiClient } from './client'
import type {
  Enrollment,
  EnrollmentChatResponse,
  EnrollmentDocument,
  EnrollmentField,
  EnrollmentSections,
  EnrollmentVerifyResponse,
  HistoryMessage,
} from '@/types'

export interface EnrollmentFieldsResponse {
  sections: EnrollmentSections
  fields: EnrollmentField[]
  documentRequirements?: {
    brasil: string[]
    internacional: string[]
  }
}

export const enrollmentApi = {
  fields(): Promise<EnrollmentFieldsResponse> {
    return apiClient.get<EnrollmentFieldsResponse>('/enrollments/fields').then((res) => res.data)
  },

  chat(input: {
    text: string
    history: HistoryMessage[]
    draft: Record<string, unknown>
  }): Promise<EnrollmentChatResponse> {
    return apiClient.post<EnrollmentChatResponse>('/enrollments/chat', input).then((res) => res.data)
  },

  create(data: Record<string, unknown>): Promise<Enrollment> {
    return apiClient
      .post<Enrollment>('/enrollments', { data, simulatePayment: false })
      .then((res) => res.data)
  },

  update(id: string, data: Record<string, unknown>): Promise<Enrollment> {
    return apiClient.patch<Enrollment>(`/enrollments/${id}`, { data }).then((res) => res.data)
  },

  review(
    id: string,
    decision: 'CONFIRM' | 'RETURN' | 'REJECT',
    note?: string,
  ): Promise<Enrollment> {
    return apiClient
      .patch<Enrollment>(`/enrollments/${id}/review`, { decision, note })
      .then((res) => res.data)
  },

  cancel(id: string, note?: string): Promise<Enrollment> {
    return apiClient
      .patch<Enrollment>(`/enrollments/${id}/cancel`, { note })
      .then((res) => res.data)
  },

  reopen(id: string): Promise<Enrollment> {
    return apiClient.patch<Enrollment>(`/enrollments/${id}/reopen`).then((res) => res.data)
  },

  updatePayment(
    id: string,
    status: 'PENDENTE' | 'APROVADO' | 'RECUSADO',
    note?: string,
  ): Promise<Enrollment> {
    return apiClient
      .patch<Enrollment>(`/enrollments/${id}/payment`, { status, note })
      .then((res) => res.data)
  },

  list(): Promise<Enrollment[]> {
    return apiClient.get<Enrollment[]>('/enrollments').then((res) => res.data)
  },

  detail(id: string): Promise<Enrollment> {
    return apiClient.get<Enrollment>(`/enrollments/${id}`).then((res) => res.data)
  },

  confirm(id: string, note?: string): Promise<Enrollment> {
    return apiClient
      .patch<Enrollment>(`/enrollments/${id}/confirm`, { note })
      .then((res) => res.data)
  },

  documents(id: string): Promise<EnrollmentDocument[]> {
    return apiClient.get<EnrollmentDocument[]>(`/enrollments/${id}/documents`).then((res) => res.data)
  },

  uploadDocument(id: string, type: string, file: File): Promise<EnrollmentDocument> {
    const form = new FormData()
    form.append('type', type)
    form.append('file', file)
    return apiClient
      .post<EnrollmentDocument>(`/enrollments/${id}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },

  reviewDocument(
    enrollmentId: string,
    documentId: string,
    status: 'RECEBIDO' | 'APROVADO' | 'RECUSADO',
    note?: string,
  ): Promise<EnrollmentDocument> {
    return apiClient
      .patch<EnrollmentDocument>(
        `/enrollments/${enrollmentId}/documents/${documentId}/review`,
        { status, note },
      )
      .then((res) => res.data)
  },

  async downloadComprovante(id: string): Promise<void> {
    const res = await apiClient.get<Blob>(`/enrollments/${id}/comprovante.pdf`, { responseType: 'blob' })
    downloadBlob(res.data, `comprovante-matricula-${id}.pdf`)
  },

  async downloadDocument(enrollmentId: string, document: EnrollmentDocument): Promise<void> {
    const res = await apiClient.get<Blob>(`/enrollments/${enrollmentId}/documents/${document.id}`, {
      responseType: 'blob',
    })
    downloadBlob(res.data, document.fileName)
  },

  verify(authCode: string): Promise<EnrollmentVerifyResponse> {
    return apiClient.get<EnrollmentVerifyResponse>(`/enrollments/verify/${authCode}`).then((res) => res.data)
  },
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
