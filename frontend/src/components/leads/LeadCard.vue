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
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-xs);
  display: flex;
  overflow: hidden;
  transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
}

.lead-card:hover {
  border-color: color-mix(in srgb, var(--accent, #075e54) 32%, white);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.lead-card__bar {
  width: 4px;
  flex-shrink: 0;
  background: var(--accent, #075e54);
}

.lead-card__body {
  flex: 1;
  padding: 12px 14px;
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
  border-radius: 8px;
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
  font-weight: 800;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lead-card__time { font-size: 11px; color: var(--muted); }

.lead-card__qualified {
  font-size: 11px;
  font-weight: 800;
  color: var(--accent, #075e54);
  background: color-mix(in srgb, var(--accent, #075e54) 10%, white);
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--accent, #075e54) 18%, white);
}

.lead-card__tags { display: flex; flex-wrap: wrap; gap: 5px; }

.tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--muted-strong);
  font-weight: 700;
}
</style>
