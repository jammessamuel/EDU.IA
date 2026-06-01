<script setup lang="ts">
import { computed } from 'vue'
import type { Lead } from '@/types'

const props = defineProps<{ lead: Lead }>()

const courseColor: Record<string, { bg: string; text: string }> = {
  Enfermagem:     { bg: '#ffeaea', text: '#c0392b' },
  Direito:        { bg: '#fff7e6', text: '#d97706' },
  Administração:  { bg: '#e8f4fd', text: '#1d6fa4' },
  Pedagogia:      { bg: '#e8f8f0', text: '#1e8449' },
}

const accent = computed(() => courseColor[props.lead.course] ?? { bg: '#f5f5f5', text: '#555' })
const initial = computed(() => props.lead.name.charAt(0).toUpperCase())

const formattedDate = computed(() =>
  new Date(props.lead.createdAt).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }),
)

const shiftIcon: Record<string, string> = { manhã: '🌅', tarde: '☀️', noite: '🌙' }
const shiftEmoji = computed(() => shiftIcon[props.lead.shift?.toLowerCase()] ?? '📅')
</script>

<template>
  <div class="lead-card">
    <div class="lead-card__bar" :style="{ background: accent.text }"></div>
    <div class="lead-card__body">
      <div class="lead-card__top">
        <div class="lead-card__avatar" :style="{ background: accent.bg, color: accent.text }">
          {{ initial }}
        </div>
        <div class="lead-card__identity">
          <span class="lead-card__name">{{ lead.name }}</span>
          <span class="lead-card__time">{{ formattedDate }}</span>
        </div>
        <span class="lead-card__qualified">✓ Qualificado</span>
      </div>
      <div class="lead-card__tags">
        <span class="tag tag--course" :style="{ background: accent.bg, color: accent.text }">
          {{ lead.course }}
        </span>
        <span class="tag">🏫 {{ lead.unit }}</span>
        <span class="tag">{{ shiftEmoji }} {{ lead.shift }}</span>
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

.lead-card__bar { width: 4px; flex-shrink: 0; }

.lead-card__body {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lead-card__top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lead-card__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
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
  color: #18a058;
  background: #e8f8f0;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
}

.lead-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  background: #f5f7fa;
  color: #555;
  font-weight: 500;
}

.tag--course { font-weight: 600; }
</style>
