<script setup lang="ts">
import { computed, ref } from 'vue'
import { schoolConfigApi } from '@/api/schoolConfig'
import type { ChatMessage } from '@/types'

const props = defineProps<{ message: ChatMessage }>()

const isUser = computed(() => props.message.from === 'user')
const busyAttachmentId = ref<string | null>(null)

const time = computed(() =>
  props.message.timestamp.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }),
)

const senderLabel = computed(() => (isUser.value ? 'Você' : 'Atendente de IA'))
const attachmentLabel = computed(() => {
  const count = props.message.attachments?.length ?? 0
  if (!count) return ''
  return count === 1 ? ' 1 PDF anexado.' : ` ${count} PDFs anexados.`
})

async function openAttachment(attachment: NonNullable<ChatMessage['attachments']>[number]) {
  if (busyAttachmentId.value) return

  if (attachment.url) {
    window.open(attachment.url, '_blank', 'noopener,noreferrer')
    return
  }

  if (!attachment.pdfKind) return

  busyAttachmentId.value = attachment.id
  try {
    await schoolConfigApi.downloadCommercialPdf(attachment.pdfKind, attachment.filename)
  } finally {
    busyAttachmentId.value = null
  }
}
</script>

<template>
  <div class="msg-row" :class="{ 'msg-row--user': isUser }">
    <div
      class="bubble"
      :class="isUser ? 'bubble--user' : 'bubble--ai'"
      role="article"
      :aria-label="`${senderLabel}, ${time}: ${message.text}.${attachmentLabel}`"
    >
      <span class="bubble__text">{{ message.text }}</span>
      <div
        v-if="message.attachments?.length"
        class="bubble__attachments"
        aria-label="Anexos da mensagem"
      >
        <article v-for="attachment in message.attachments" :key="attachment.id" class="pdf-card">
          <span class="pdf-card__badge">PDF</span>
          <div class="pdf-card__body">
            <strong>{{ attachment.title }}</strong>
            <small>{{ attachment.description || attachment.filename || 'Material em PDF' }}</small>
          </div>
          <button
            type="button"
            class="pdf-card__action"
            :disabled="busyAttachmentId === attachment.id"
            @click="openAttachment(attachment)"
          >
            {{ busyAttachmentId === attachment.id ? 'Gerando...' : 'Abrir PDF' }}
          </button>
        </article>
      </div>
      <span class="bubble__time" aria-hidden="true">{{ time }}</span>
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
  background: var(--chat-user-bg);
  color: #fff;
  border-radius: 16px 16px 5px 16px;
  box-shadow: 0 8px 20px rgba(37, 211, 102, 0.22);
}

.bubble--ai {
  background: var(--chat-ai-bg);
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

.bubble__attachments {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.pdf-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border: 1px solid rgba(0, 128, 96, 0.18);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(20, 184, 166, 0.04)),
    rgba(255, 255, 255, 0.58);
}

.pdf-card__badge {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.pdf-card__body {
  min-width: 0;
}

.pdf-card__body strong,
.pdf-card__body small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pdf-card__body strong {
  color: var(--text);
  font-size: 13px;
  line-height: 1.25;
}

.pdf-card__body small {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
}

.pdf-card__action {
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: #047857;
  color: #fff;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(4, 120, 87, 0.22);
}

.pdf-card__action:hover {
  background: #065f46;
}

.pdf-card__action:disabled {
  cursor: wait;
  opacity: 0.7;
}

.bubble--user .pdf-card {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.22);
}

.bubble--user .pdf-card__body strong,
.bubble--user .pdf-card__body small {
  color: #fff;
}

@media (max-width: 540px) {
  .bubble {
    max-width: min(88%, 520px);
  }

  .pdf-card {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .pdf-card__action {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
