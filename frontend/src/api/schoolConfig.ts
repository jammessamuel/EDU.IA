import { apiClient } from './client'
import type {
  CommercialConditionConfig,
  CommunicationTemplateConfig,
  CourseOfferConfig,
  DocumentRequirementConfig,
  SchoolConfigOverview,
  SchoolProfileConfig,
  TemplatePreviewResponse,
} from '@/types'

export const schoolConfigApi = {
  overview(): Promise<SchoolConfigOverview> {
    return apiClient.get<SchoolConfigOverview>('/school-config/overview').then((res) => res.data)
  },

  updateProfile(profile: Partial<SchoolProfileConfig>): Promise<SchoolConfigOverview> {
    return apiClient.put<SchoolConfigOverview>('/school-config/profile', profile).then((res) => res.data)
  },

  updateCommercial(commercial: Partial<CommercialConditionConfig>): Promise<SchoolConfigOverview> {
    return apiClient.put<SchoolConfigOverview>('/school-config/commercial', commercial).then((res) => res.data)
  },

  updateTemplate(key: string, template: Partial<CommunicationTemplateConfig>): Promise<SchoolConfigOverview> {
    return apiClient.put<SchoolConfigOverview>(`/school-config/templates/${key}`, template).then((res) => res.data)
  },

  restoreTemplate(key: string): Promise<SchoolConfigOverview> {
    return apiClient.post<SchoolConfigOverview>(`/school-config/templates/${key}/restore`).then((res) => res.data)
  },

  previewTemplate(key: string, variables?: Record<string, unknown>): Promise<TemplatePreviewResponse> {
    return apiClient
      .post<TemplatePreviewResponse>(`/school-config/templates/${key}/preview`, { variables })
      .then((res) => res.data)
  },

  createCourse(course: Partial<CourseOfferConfig>): Promise<SchoolConfigOverview> {
    return apiClient.post<SchoolConfigOverview>('/school-config/courses', course).then((res) => res.data)
  },

  updateCourse(id: string, course: Partial<CourseOfferConfig>): Promise<SchoolConfigOverview> {
    return apiClient.put<SchoolConfigOverview>(`/school-config/courses/${id}`, course).then((res) => res.data)
  },

  createDocument(document: Partial<DocumentRequirementConfig>): Promise<SchoolConfigOverview> {
    return apiClient.post<SchoolConfigOverview>('/school-config/documents', document).then((res) => res.data)
  },

  updateDocument(id: string, document: Partial<DocumentRequirementConfig>): Promise<SchoolConfigOverview> {
    return apiClient.put<SchoolConfigOverview>(`/school-config/documents/${id}`, document).then((res) => res.data)
  },
}
