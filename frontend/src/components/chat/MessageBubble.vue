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
  padding: 2px 12px;
}

.msg-row--user {
  justify-content: flex-end;
}

.bubble {
  max-width: 72%;
  padding: 8px 12px 4px;
  border-radius: 18px;
  position: relative;
  word-break: break-word;
}

.bubble--user {
  background: #25d366;
  color: #fff;
  border-radius: 18px 18px 4px 18px;
}

.bubble--ai {
  background: #fff;
  color: #111b21;
  border-radius: 18px 18px 18px 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.bubble__text {
  display: block;
  font-size: 14px;
  line-height: 1.5;
}

.bubble__time {
  display: block;
  font-size: 11px;
  margin-top: 2px;
  text-align: right;
  opacity: 0.65;
}
</style>
