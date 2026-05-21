<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NTag, NSpace } from 'naive-ui'
import type { Lead } from '@/types'

const props = defineProps<{ lead: Lead }>()

const courseType = computed(() => {
  const map: Record<string, 'error' | 'warning' | 'info' | 'success'> = {
    Enfermagem: 'error',
    Direito: 'warning',
    Administração: 'info',
    Pedagogia: 'success',
  }
  return map[props.lead.course] ?? 'default'
})

const shiftLabel = computed(() => {
  const map: Record<string, string> = { manhã: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
  return map[props.lead.shift] ?? props.lead.shift
})

const formattedDate = computed(() =>
  new Date(props.lead.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }),
)
</script>

<template>
  <NCard
    size="small"
    :bordered="true"
    :style="{ borderLeft: '4px solid #25D366', marginBottom: '10px' }"
  >
    <div class="lead-header">
      <span class="lead-name">{{ lead.name }}</span>
      <NTag size="small" type="success" round>✓ Qualificado</NTag>
    </div>

    <NSpace size="small" style="margin-top: 8px">
      <NTag size="small" :type="courseType" round>{{ lead.course }}</NTag>
      <NTag size="small" type="default" round>{{ lead.unit }}</NTag>
      <NTag size="small" type="default" round>{{ shiftLabel }}</NTag>
    </NSpace>

    <p class="lead-date">{{ formattedDate }}</p>
  </NCard>
</template>

<style scoped>
.lead-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lead-name {
  font-size: 14px;
  font-weight: 600;
  color: #111b21;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-date {
  font-size: 11px;
  color: #888;
  margin-top: 6px;
  margin-bottom: 0;
}
</style>
