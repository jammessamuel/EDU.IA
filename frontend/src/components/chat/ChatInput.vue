<script setup lang="ts">
import { ref } from 'vue'
import { NInput, NButton, NIcon } from 'naive-ui'
import { SendOutline } from '@vicons/ionicons5'

const props = defineProps<{ disabled: boolean; placeholder?: string }>()
const emit = defineEmits<{ send: [text: string] }>()

const inputText = ref('')

function handleSend() {
  const text = inputText.value.trim()
  if (!text || props.disabled) return
  emit('send', text)
  inputText.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="chat-input">
    <div class="chat-input__box">
      <NInput
        v-model:value="inputText"
        :placeholder="placeholder ?? 'Digite uma mensagem...'"
        round
        :disabled="disabled"
        style="flex: 1"
        @keydown="handleKeydown"
      />
    </div>
    <NButton
      circle
      type="primary"
      :disabled="disabled || !inputText.trim()"
      :color="'#25D366'"
      @click="handleSend"
    >
      <template #icon>
        <NIcon><SendOutline /></NIcon>
      </template>
    </NButton>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px 14px;
  background: rgba(248, 250, 249, 0.94);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  backdrop-filter: blur(14px);
}

.chat-input__box {
  flex: 1;
  min-width: 0;
}

:deep(.n-input) {
  min-height: 42px;
  background: #fff;
  border-radius: 999px;
  box-shadow: var(--shadow-xs);
}

:deep(.n-input .n-input__input-el) {
  font-size: 14px;
  color: var(--text);
}

:deep(.n-button) {
  width: 42px;
  height: 42px;
  box-shadow: 0 10px 20px rgba(37, 211, 102, 0.22);
}

:deep(.n-button:disabled) {
  box-shadow: none;
}
</style>
