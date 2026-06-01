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

    // Histórico enviado ao backend (serverless não guarda estado).
    // Montado ANTES de inserir a nova mensagem do usuário, pois o
    // backend já adiciona o texto atual à conversa.
    const history = messages.value.map((m) => ({
      role: m.from === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    }))

    messages.value.push({
      id: crypto.randomUUID(),
      from: 'user',
      text: text.trim(),
      timestamp: new Date(),
    })

    await new Promise((resolve) => setTimeout(resolve, 400))
    isTyping.value = true

    try {
      const response = await simulatorApi.sendMessage(text.trim(), history)

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

  function resetSession(): void {
    // Conversa é mantida no cliente — reset é puramente local.
    messages.value = [{ ...WELCOME, id: crypto.randomUUID(), timestamp: new Date() }]
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

  async function updateLeadStatus(id: string, status: string): Promise<void> {
    const updated = await simulatorApi.updateLeadStatus(id, status)
    const idx = leads.value.findIndex((l) => l.id === id)
    if (idx >= 0) leads.value[idx] = updated
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
    updateLeadStatus,
  }
})
