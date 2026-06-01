import { computed, type Ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import type { ChatMessage } from '@/types'

/**
 * Calcula as opções de quick reply para o estado atual da conversa.
 *
 * Lógica: cada mensagem da IA (exceto a boas-vindas) corresponde a um
 * campo do vertical na ordem. Se esse campo for do tipo "select", retorna
 * suas opções para exibir como botões.
 */
export function useQuickReplies(
  messages: Ref<ChatMessage[]>,
  hasLead:  Ref<boolean>,
  isTyping: Ref<boolean>,
) {
  const ws = useWorkspaceStore()

  return computed((): string[] | null => {
    if (hasLead.value || isTyping.value) return null

    const sortedFields = [...ws.fields].sort((a, b) => a.order - b.order)
    if (!sortedFields.length) return null

    // Mensagens da IA depois da boas-vindas = perguntas sobre cada campo
    const aiQuestions = messages.value.filter(
      (m) => m.from === 'ai' && !m.id.startsWith('welcome') && !m.id.startsWith('pre-'),
    )

    // Ainda na boas-vindas, nenhuma pergunta feita ainda
    if (!aiQuestions.length) return null

    // fieldIdx = qual campo o bot acabou de perguntar
    const fieldIdx = aiQuestions.length - 1
    const field = sortedFields[fieldIdx]

    return field?.type === 'select' && field.options?.length ? field.options : null
  })
}
