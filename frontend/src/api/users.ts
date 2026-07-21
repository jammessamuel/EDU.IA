import { apiClient } from './client'
import type { ManagedSchoolUser, SchoolUser, UserManagementResponse } from '@/types'

export interface CreateSchoolUserInput {
  name: string
  email: string
  password: string
  roleName: 'SCHOOL_ADMIN' | 'CONSULTANT'
}

export interface UpdateSchoolUserInput {
  name?: string
  email?: string
  roleName?: 'SCHOOL_ADMIN' | 'CONSULTANT'
}

export const usersApi = {
  list(): Promise<SchoolUser[]> {
    return apiClient.get<SchoolUser[]>('/users').then((res) => res.data)
  },

  management(): Promise<UserManagementResponse> {
    return apiClient.get<UserManagementResponse>('/users/management').then((res) => res.data)
  },

  create(input: CreateSchoolUserInput): Promise<ManagedSchoolUser> {
    return apiClient.post<ManagedSchoolUser>('/users', input).then((res) => res.data)
  },

  update(id: string, input: UpdateSchoolUserInput): Promise<ManagedSchoolUser> {
    return apiClient.patch<ManagedSchoolUser>(`/users/${id}`, input).then((res) => res.data)
  },

  updateStatus(
    id: string,
    input: { isActive: boolean; replacementUserId?: string },
  ): Promise<ManagedSchoolUser> {
    return apiClient.patch<ManagedSchoolUser>(`/users/${id}/status`, input).then((res) => res.data)
  },

  resetPassword(id: string, password: string): Promise<{ ok: boolean }> {
    return apiClient
      .post<{ ok: boolean }>(`/users/${id}/reset-password`, { password })
      .then((res) => res.data)
  },
}
