import { apiClient } from './client'
import type { SchoolUser } from '@/types'

export const usersApi = {
  list(): Promise<SchoolUser[]> {
    return apiClient.get<SchoolUser[]>('/users').then((res) => res.data)
  },
}
