import { computed, type Ref } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import type { ChatMessage } from '@/types'

/**
 * Retorna as opções de quick reply para o estado atual da conversa.
 *
 * Regras:
 * - Só aparece quando a ÚLTIMA mensagem é da IA (ela está esperando resposta)
 * - Conta TODAS as mensagens da IA para descobrir qual campo está sendo pedido
 * - A primeira mensagem da IA é sempre a saudação — não conta como campo
 * - Se o campo atual for do tipo "select", retorna suas opções; senão null
 * - Desaparece automaticamente quando todos os campos foram coletados
 */
export function useQuickReplies(
  messages: Ref<ChatMessage[]>,
  isTyping:  Ref<boolean>,
) {
  const ws = useWorkspaceStore()

  return computed((): string[] | null => {
    if (isTyping.value) return null

    const sortedFields = [...ws.fields].sort((a, b) => a.order - b.order)
    if (!sortedFields.length) return null

    const msgs = messages.value
    if (!msgs.length) return null

    // Só mostra quando a última mensagem é da IA (aguardando input do usuário)
    const lastMsg = msgs[msgs.length - 1]
    if (!lastMsg) return null
    if (lastMsg.from !== 'ai') return null

    // Conta todas as mensagens da IA para saber em qual campo estamos
    // A primeira = saudação, as seguintes = perguntas sobre os campos
    const allAiMsgs = msgs.filter(m => m.from === 'ai')
    const fieldIdx = allAiMsgs.length - 2 // -1 zero-index, -1 saudação

    if (fieldIdx < 0) return null

    const field = sortedFields[fieldIdx]
    return field?.type === 'select' && field.options?.length ? field.options : null
  })
}
