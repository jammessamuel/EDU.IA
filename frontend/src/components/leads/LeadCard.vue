<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Lead } from '@/types'

const props = defineProps<{ lead: Lead }>()
const emit  = defineEmits<{ open: [lead: Lead] }>()
const ws    = useWorkspaceStore()

const initial      = computed(() => props.lead.name.charAt(0).toUpperCase())
const dataEntries  = computed(() => Object.entries(props.lead.data ?? {}))
const accentColor  = computed(() => ws.brandColor)

const formattedDate = computed(() =>
  new Date(props.lead.createdAt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }),
)
</script>

<template>
  <div class="lead-card" :style="{ '--accent': accentColor }" title="Clique para ver detalhes" @click="emit('open', lead)">
    <div class="lead-card__bar"></div>
    <div class="lead-card__body">
      <div class="lead-card__top">
        <div class="lead-card__avatar">{{ initial }}</div>
        <div class="lead-card__identity">
          <span class="lead-card__name">{{ lead.name }}</span>
          <span class="lead-card__time">{{ formattedDate }}</span>
        </div>
        <span class="lead-card__qualified">✓ Qualificado</span>
      </div>
      <div class="lead-card__tags">
        <span
          v-for="[key, val] in dataEntries"
          :key="key"
          class="tag"
          :title="ws.fieldLabel(key)"
        >
          {{ val }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lead-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  display: flex;
  overflow: hidden;
  transition: box-shadow 0.15s, transform 0.15s;
}

.lead-card:hover {
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

.lead-card__bar {
  width: 4px;
  flex-shrink: 0;
  background: var(--accent, #075e54);
}

.lead-card__body {
  flex: 1;
  padding: 11px 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lead-card__top {
  display: flex;
  align-items: center;
  gap: 9px;
}

.lead-card__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--accent, #075e54) 12%, white);
  color: var(--accent, #075e54);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.lead-card__identity {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.lead-card__name {
  font-size: 14px;
  font-weight: 600;
  color: #111b21;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-card__time { font-size: 11px; color: #aaa; }

.lead-card__qualified {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent, #075e54);
  background: color-mix(in srgb, var(--accent, #075e54) 10%, white);
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.lead-card__tags { display: flex; flex-wrap: wrap; gap: 5px; }

.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  background: #f5f7fa;
  color: #555;
  font-weight: 500;
}
</style>
