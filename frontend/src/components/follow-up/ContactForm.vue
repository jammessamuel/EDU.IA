<script setup lang="ts">
import { ref } from 'vue'
import type { ContactInput } from '@/types'

withDefaults(
  defineProps<{
    busy?: boolean
    submitLabel?: string
  }>(),
  { busy: false, submitLabel: 'Registrar contato' },
)

const emit = defineEmits<{ submit: [input: ContactInput] }>()

const channel = ref('WHATSAPP')
const outcome = ref('RESPONDEU')
const note = ref('')
const nextContactAt = ref('')

function submit() {
  emit('submit', {
    channel: channel.value,
    outcome: outcome.value,
    note: note.value.trim() || undefined,
    nextContactAt: nextContactAt.value ? new Date(nextContactAt.value).toISOString() : null,
  })
}
</script>

<template>
  <form class="contact-form" @submit.prevent="submit">
    <label>
      <span>Canal</span>
      <select v-model="channel" :disabled="busy" required>
        <option value="WHATSAPP">WhatsApp</option>
        <option value="LIGACAO">Ligação</option>
        <option value="EMAIL">E-mail</option>
        <option value="PRESENCIAL">Presencial</option>
        <option value="OUTRO">Outro</option>
      </select>
    </label>

    <label>
      <span>Resultado</span>
      <select v-model="outcome" :disabled="busy" required>
        <option value="RESPONDEU">Respondeu</option>
        <option value="NAO_ATENDEU">Não atendeu</option>
        <option value="AGENDADO">Agendado</option>
        <option value="SEM_INTERESSE">Sem interesse</option>
        <option value="CAIXA_POSTAL">Caixa postal</option>
        <option value="NUMERO_INVALIDO">Número inválido</option>
      </select>
    </label>

    <label class="contact-form__wide">
      <span>Nota</span>
      <textarea
        v-model="note"
        :disabled="busy"
        rows="3"
        maxlength="500"
        placeholder="Ex.: liguei, não atendeu; tentar novamente amanhã."
      ></textarea>
    </label>

    <label class="contact-form__wide">
      <span>Próximo contato (opcional)</span>
      <input v-model="nextContactAt" :disabled="busy" type="datetime-local" />
    </label>

    <button type="submit" :disabled="busy">
      {{ busy ? 'Registrando...' : submitLabel }}
    </button>
  </form>
</template>

<style scoped>
.contact-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.contact-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.contact-form label span {
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 800;
}

.contact-form select,
.contact-form input,
.contact-form textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  padding: 9px 10px;
}

.contact-form textarea {
  resize: vertical;
}

.contact-form__wide,
.contact-form button {
  grid-column: 1 / -1;
}

.contact-form button {
  justify-self: end;
  border: 0;
  border-radius: 8px;
  background: var(--brand);
  color: #fff;
  cursor: pointer;
  font-weight: 800;
  padding: 10px 16px;
}

.contact-form button:disabled {
  cursor: wait;
  opacity: 0.6;
}

@media (max-width: 600px) {
  .contact-form {
    grid-template-columns: 1fr;
  }

  .contact-form__wide,
  .contact-form button {
    grid-column: auto;
  }
}
</style>
