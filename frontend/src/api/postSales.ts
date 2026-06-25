import { apiClient } from './client'
import type { PostSaleOverview } from '@/types'

export const postSalesApi = {
  overview(): Promise<PostSaleOverview> {
    return apiClient.get<PostSaleOverview>('/post-sales/overview').then((res) => res.data)
  },
}
