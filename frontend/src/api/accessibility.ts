import { apiClient } from './client'
import type { AccessibilityProfile } from '@/types'

export const accessibilityApi = {
  get(): Promise<AccessibilityProfile> {
    return apiClient.get<AccessibilityProfile>('/me/accessibility').then((res) => res.data)
  },

  update(input: Partial<AccessibilityProfile>): Promise<AccessibilityProfile> {
    return apiClient.put<AccessibilityProfile>('/me/accessibility', input).then((res) => res.data)
  },
}
