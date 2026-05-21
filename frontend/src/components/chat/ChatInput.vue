<script setup lang="ts">
import { ref } from 'vue'
import { NInput, NButton, NIcon } from 'naive-ui'
import { SendOutline } from '@vicons/ionicons5'

const props = defineProps<{ disabled: boolean }>()
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
    <NInput
      v-model:value="inputText"
      placeholder="Digite uma mensagem..."
      round
      :disabled="disabled"
      style="flex: 1"
      @keydown="handleKeydown"
    />
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
  gap: 8px;
  padding: 10px 16px;
  background: #f0f2f5;
  border-top: 1px solid #e9edef;
  flex-shrink: 0;
}
</style>
