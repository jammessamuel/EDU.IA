<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '@/types'

const props = defineProps<{ message: ChatMessage }>()

const isUser = computed(() => props.message.from === 'user')

const time = computed(() =>
  props.message.timestamp.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }),
)
</script>

<template>
  <div class="msg-row" :class="{ 'msg-row--user': isUser }">
    <div class="bubble" :class="isUser ? 'bubble--user' : 'bubble--ai'">
      <span class="bubble__text">{{ message.text }}</span>
      <span class="bubble__time">{{ time }}</span>
    </div>
  </div>
</template>

<style scoped>
.msg-row {
  display: flex;
  justify-content: flex-start;
  padding: 2px 14px;
}

.msg-row--user {
  justify-content: flex-end;
}

.bubble {
  max-width: min(76%, 520px);
  padding: 9px 12px 5px;
  border-radius: 16px;
  position: relative;
  word-break: break-word;
  border: 1px solid transparent;
}

.bubble--user {
  background: linear-gradient(135deg, #25d366, #14b866);
  color: #fff;
  border-radius: 16px 16px 5px 16px;
  box-shadow: 0 8px 20px rgba(37, 211, 102, 0.22);
}

.bubble--ai {
  background: rgba(255, 255, 255, 0.96);
  color: var(--text);
  border-color: rgba(221, 231, 228, 0.86);
  border-radius: 16px 16px 16px 5px;
  box-shadow: var(--shadow-xs);
}

.bubble__text {
  display: block;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.bubble__time {
  display: block;
  font-size: 11px;
  margin-top: 2px;
  text-align: right;
  opacity: 0.65;
}
</style>
