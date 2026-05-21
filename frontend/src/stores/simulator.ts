import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { simulatorApi } from '@/api/simulator'
import type { ChatMessage, Lead } from '@/types'

const WELCOME: ChatMessage = {
  id: 'welcome',
  from: 'ai',
  text: 'Olá! Seja bem-vindo ao Colégio Exemplo. Como posso te ajudar hoje?',
  timestamp: new Date(),
}

export const useSimulatorStore = defineStore('simulator', () => {
  const messages = ref<ChatMessage[]>([{ ...WELCOME }])
  const leads = ref<Lead[]>([])
  const isTyping = ref(false)
  const isSending = ref(false)
  const error = ref<string | null>(null)

  const hasLeads = computed(() => leads.value.length > 0)
  const leadCount = computed(() => leads.value.length)

  async function sendMessage(text: string): Promise<void> {
    if (!text.trim() || isSending.value) return

    error.value = null
    isSending.value = true

    messages.value.push({
      id: crypto.randomUUID(),
      from: 'user',
      text: text.trim(),
      timestamp: new Date(),
    })

    await new Promise((resolve) => setTimeout(resolve, 400))
    isTyping.value = true

    try {
      const response = await simulatorApi.sendMessage(text.trim())

      isTyping.value = false
      messages.value.push({
        id: crypto.randomUUID(),
        from: 'ai',
        text: response.reply,
        timestamp: new Date(),
      })

      if (response.lead) {
        leads.value.unshift(response.lead)
      }
    } catch {
      isTyping.value = false
      error.value = 'Não foi possível enviar a mensagem. Tente novamente.'
    } finally {
      isSending.value = false
    }
  }

  async function resetSession(): Promise<void> {
    try {
      await simulatorApi.resetSession()
    } catch {
      // reseta estado local mesmo se backend falhar
    }
    messages.value = [{ ...WELCOME, id: crypto.randomUUID(), timestamp: new Date() }]
    leads.value = []
    error.value = null
    isTyping.value = false
    isSending.value = false
  }

  async function fetchLeads(): Promise<void> {
    try {
      leads.value = await simulatorApi.getLeads()
    } catch {
      // silencioso — painel começa vazio
    }
  }

  return {
    messages,
    leads,
    isTyping,
    isSending,
    error,
    hasLeads,
    leadCount,
    sendMessage,
    resetSession,
    fetchLeads,
  }
})
