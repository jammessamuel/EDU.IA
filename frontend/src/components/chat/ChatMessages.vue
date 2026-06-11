<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { NScrollbar } from 'naive-ui'
import MessageBubble from './MessageBubble.vue'
import TypingIndicator from './TypingIndicator.vue'
import type { ChatMessage } from '@/types'

const props = defineProps<{
  messages: ChatMessage[]
  isTyping: boolean
}>()

const scrollbarRef = ref<InstanceType<typeof NScrollbar>>()

async function scrollToBottom() {
  await nextTick()
  scrollbarRef.value?.scrollTo({ top: 999_999, behavior: 'smooth' })
}

watch(() => [props.messages.length, props.isTyping], scrollToBottom, { immediate: true })
</script>

<template>
  <NScrollbar ref="scrollbarRef" class="chat-messages">
    <div class="chat-messages__inner">
      <MessageBubble v-for="msg in messages" :key="msg.id" :message="msg" />
      <TypingIndicator v-if="isTyping" />
    </div>
  </NScrollbar>
</template>

<style scoped>
.chat-messages {
  flex: 1;
  background:
    linear-gradient(rgba(238, 243, 241, 0.88), rgba(238, 243, 241, 0.88)),
    radial-gradient(circle at 1px 1px, rgba(7, 94, 84, 0.14) 1px, transparent 0);
  background-size: auto, 22px 22px;
  min-height: 0;
}

.chat-messages__inner {
  padding: 14px 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
</style>
