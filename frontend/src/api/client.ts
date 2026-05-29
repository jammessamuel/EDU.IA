import axios from 'axios'
import router from '../router'

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3001',
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// Injeta token JWT em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eduia_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redireciona para login em caso de token inválido/expirado
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('eduia_token')
      localStorage.removeItem('eduia_user')
      router.push('/login')
    }
    return Promise.reject(error)
  },
)

// Mantém compatibilidade com nome antigo
export const apiClient = api
