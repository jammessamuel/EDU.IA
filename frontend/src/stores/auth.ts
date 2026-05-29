import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

interface AuthUser {
  id: string
  name: string
  email: string
  schoolId: string
  schoolName?: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('eduia_token'))
  const user = ref<AuthUser | null>(JSON.parse(localStorage.getItem('eduia_user') ?? 'null'))

  const isAuthenticated = computed(() => !!token.value)

  async function login(email: string, password: string) {
    const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('eduia_token', data.token)
    localStorage.setItem('eduia_user', JSON.stringify(data.user))
  }

  async function register(name: string, email: string, password: string, schoolName: string) {
    const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/register', {
      name,
      email,
      password,
      schoolName,
    })
    token.value = data.token
    user.value = data.user
    localStorage.setItem('eduia_token', data.token)
    localStorage.setItem('eduia_user', JSON.stringify(data.user))
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignora erro de rede no logout
    }
    token.value = null
    user.value = null
    localStorage.removeItem('eduia_token')
    localStorage.removeItem('eduia_user')
  }

  return { token, user, isAuthenticated, login, register, logout }
})
