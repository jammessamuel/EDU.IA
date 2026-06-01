import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { apiClient } from '@/api/client'
import type { Vertical, VerticalField, VerticalStage } from '@/types'

interface WorkspaceSettings {
  name: string
  chatbotName: string
  vertical: { id: string; slug: string; name: string; icon: string; color: string } | null
  fields: VerticalField[]
  stages: VerticalStage[]
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const settings = ref<WorkspaceSettings | null>(null)
  const loading  = ref(false)

  const vertical     = computed(() => settings.value?.vertical ?? null)
  const fields       = computed(() => settings.value?.fields   ?? [])
  const stages       = computed(() => settings.value?.stages   ?? DEFAULT_STAGES)
  const brandColor   = computed(() => settings.value?.vertical?.color ?? '#075e54')
  const verticalIcon = computed(() => settings.value?.vertical?.icon  ?? '🤖')
  const firstStage   = computed(() => stages.value[0]?.key ?? 'NOVO')
  const lostStage    = computed(() => stages.value.find(s => s.key === 'PERDIDO')?.key ?? stages.value[stages.value.length - 1]?.key ?? 'PERDIDO')

  function fieldLabel(name: string): string {
    return fields.value.find(f => f.name === name)?.label ?? name
  }

  async function load() {
    if (settings.value || loading.value) return
    loading.value = true
    try {
      const { data } = await apiClient.get<WorkspaceSettings>('/simulator/school/settings')
      settings.value = data
    } catch { /* silencioso */ }
    finally { loading.value = false }
  }

  function clear() { settings.value = null }

  return { settings, loading, vertical, fields, stages, brandColor, verticalIcon, firstStage, lostStage, fieldLabel, load, clear }
})

export const DEFAULT_STAGES: VerticalStage[] = [
  { key: 'NOVO',        label: 'Novo Lead',   color: '#2080f0' },
  { key: 'CONTATO',     label: 'Em Contato',  color: '#f0a020' },
  { key: 'MATRICULADO', label: 'Convertido',  color: '#18a058' },
  { key: 'PERDIDO',     label: 'Perdido',     color: '#999'    },
]

// Store separado para listagem pública de verticals (sem auth)
export const useVerticalListStore = defineStore('verticalList', () => {
  const list = ref<Vertical[]>([])
  const loaded = ref(false)

  async function fetchAll() {
    if (loaded.value) return
    const { data } = await apiClient.get<Vertical[]>('/verticals')
    list.value = data
    loaded.value = true
  }

  return { list, loaded, fetchAll }
})
