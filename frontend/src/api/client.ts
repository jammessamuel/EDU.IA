import axios from 'axios'

export const apiClient = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000',
  withCredentials: true,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)
