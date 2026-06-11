<script setup lang="ts">
import { defineComponent, ref, onMounted } from 'vue'
import { NInput, NSpin } from 'naive-ui'
import AppNav from '@/components/layout/AppNav.vue'
import { simulatorApi } from '@/api/simulator'
import { useWorkspaceStore } from '@/stores/workspace'
import type { VerticalField } from '@/types'

const ws      = useWorkspaceStore()
const loading = ref(true)
const saving  = ref(false)
const saved   = ref(false)

const form = ref({
  name:        '',
  chatbotName: '',
  fields:      [] as VerticalField[],
})

onMounted(async () => {
  const s = await simulatorApi.getSchoolSettings()
  form.value = {
    name:        s.name,
    chatbotName: s.chatbotName,
    fields:      JSON.parse(JSON.stringify(s.fields)), // deep copy para edição
  }
  loading.value = false
})

function addOption(field: VerticalField, val: string) {
  const v = val.trim()
  if (v && field.options && !field.options.includes(v)) field.options.push(v)
}

function removeOption(field: VerticalField, opt: string) {
  if (field.options) field.options = field.options.filter(o => o !== opt)
}

async function save() {
  saving.value = true
  await simulatorApi.updateSchoolSettings({
    name:         form.value.name,
    chatbotName:  form.value.chatbotName,
    customFields: form.value.fields,
  })
  ws.clear(); await ws.load()
  saving.value = false
  saved.value  = true
  setTimeout(() => (saved.value = false), 2500)
}

const AddOptionInput = defineComponent({
  props: { field: { type: Object as () => VerticalField, required: true } },
  emits: ['add'],
  setup(_, { emit }) {
    const val = ref('')
    function add() {
      if (val.value.trim()) {
        emit('add', val.value)
        val.value = ''
      }
    }
    return { val, add }
  },
  template:
    '<div class="add-option"><input v-model="val" class="add-option__input" placeholder="Nova opção..." @keydown.enter="add" /><button class="add-option__btn" @click="add">+</button></div>',
})
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="settings-subheader">
      <h1 class="settings-subheader__title">Configurações</h1>
      <div v-if="ws.vertical" class="settings-vertical-badge" :style="{ background: ws.brandColor + '18', color: ws.brandColor, borderColor: ws.brandColor + '44' }">
        {{ ws.vertical.icon }} {{ ws.vertical.name }}
      </div>
    </div>

    <div v-if="loading" class="settings-loading"><NSpin size="large" /></div>

    <div v-else class="settings-body">

      <!-- Identidade -->
      <div class="settings-card">
        <h2 class="settings-section">Identidade do Workspace</h2>
        <div class="field">
          <label class="field__label">Nome do negócio</label>
          <NInput v-model:value="form.name" placeholder="Ex: Escritório Silva & Filhos" />
          <p class="field__hint">Aparece para o cliente durante a conversa.</p>
        </div>
        <div class="field">
          <label class="field__label">Nome do atendente virtual</label>
          <NInput v-model:value="form.chatbotName" placeholder="Ex: Ana, João, Assistente..." />
          <p class="field__hint">Como a IA se apresenta.</p>
        </div>
      </div>

      <!-- Campos do vertical -->
      <div class="settings-card">
        <h2 class="settings-section">Campos de Qualificação</h2>
        <p class="settings-desc">A IA coleta estes dados durante a conversa. Para campos de seleção, você pode customizar as opções.</p>

        <div v-for="field in form.fields" :key="field.name" class="field-row">
          <div class="field-row__header">
            <span class="field-row__label">{{ field.label }}</span>
            <span class="field-row__type">{{ field.type === 'select' ? 'seleção' : 'texto livre' }}</span>
          </div>

          <div v-if="field.type === 'select' && field.options" class="field-options">
            <div class="options-list">
              <span
                v-for="opt in field.options"
                :key="opt"
                class="option-tag"
                :style="{ '--brand': ws.brandColor }"
              >
                {{ opt }}
                <button class="option-tag__remove" @click="removeOption(field, opt)">×</button>
              </span>
            </div>
            <AddOptionInput :field="field" @add="addOption(field, $event)" />
          </div>
          <div v-else class="field-text-note">
            A IA aceita qualquer texto para este campo.
          </div>
        </div>
      </div>

      <!-- Pipeline stages (read-only) -->
      <div class="settings-card">
        <h2 class="settings-section">Etapas do Pipeline</h2>
        <p class="settings-desc">Definidas pelo setor. Entre em contato para customizar.</p>
        <div class="stages-row">
          <div
            v-for="stage in ws.stages"
            :key="stage.key"
            class="stage-chip"
            :style="{ background: stage.color + '18', color: stage.color, borderColor: stage.color + '55' }"
          >
            {{ stage.label }}
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <button class="btn-save" :disabled="saving" @click="save">
          {{ saving ? 'Salvando…' : saved ? '✓ Salvo!' : 'Salvar configurações' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: #f5f7fa; }

.settings-subheader {
  background: #fff;
  border-bottom: 1px solid #e9edef;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.settings-subheader__title { font-size: 17px; font-weight: 700; color: #111b21; margin: 0; }

.settings-vertical-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 11px;
  border-radius: 20px;
  border: 1px solid;
}

.settings-loading { flex: 1; display: flex; align-items: center; justify-content: center; }

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 660px;
}

.settings-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-section { font-size: 14px; font-weight: 700; color: #111b21; margin: 0; }
.settings-desc { font-size: 12px; color: #888; margin: -6px 0 0; }

.field { display: flex; flex-direction: column; gap: 5px; }
.field__label { font-size: 13px; font-weight: 600; color: #444; }
.field__hint { font-size: 11px; color: #bbb; margin: 0; }

/* Field rows */
.field-row {
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-row__header { display: flex; align-items: center; justify-content: space-between; }
.field-row__label { font-size: 13px; font-weight: 600; color: #333; }
.field-row__type { font-size: 11px; color: #aaa; background: #f5f5f5; padding: 2px 8px; border-radius: 10px; }

.field-options { display: flex; flex-direction: column; gap: 8px; }

.options-list { display: flex; flex-wrap: wrap; gap: 6px; }

.option-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--brand, #075e54) 10%, white);
  color: var(--brand, #075e54);
  font-weight: 500;
}

.option-tag__remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  opacity: 0.6;
  padding: 0;
}

.option-tag__remove:hover { opacity: 1; }

:deep(.add-option) { display: flex; gap: 7px; align-items: center; }

:deep(.add-option__input) {
  flex: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  outline: none;
  max-width: 220px;
}

:deep(.add-option__input:focus) { border-color: #075e54; }

:deep(.add-option__btn) {
  padding: 6px 14px;
  border-radius: 8px;
  background: #e8f5e9;
  color: #075e54;
  border: 1px solid #b2dfdb;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.field-text-note { font-size: 12px; color: #aaa; font-style: italic; }

/* Stages */
.stages-row { display: flex; flex-wrap: wrap; gap: 8px; }

.stage-chip {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid;
}

/* Footer */
.settings-footer { display: flex; justify-content: flex-end; }

.btn-save {
  padding: 10px 28px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  background: #075e54;
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 180px;
}

.btn-save:hover:not(:disabled) { background: #128c7e; }
.btn-save:disabled { opacity: 0.7; }

/* Premium shell */
.page {
  background: var(--app-bg);
}

.settings-subheader {
  background: rgba(255, 255, 255, 0.84);
  border-bottom-color: var(--border);
  backdrop-filter: blur(12px);
}

.settings-subheader__title {
  color: var(--text);
  font-size: 18px;
  font-weight: 900;
}

.settings-body {
  max-width: 760px;
  padding: 22px 24px 28px;
}

.settings-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-xs);
  background: rgba(255, 255, 255, 0.94);
}

.settings-section {
  color: var(--text);
  font-weight: 900;
}

.settings-desc,
.field__hint,
.field-text-note {
  color: var(--muted);
}

.field__label,
.field-row__label {
  color: var(--text-soft);
  font-weight: 800;
}

.field-row {
  border-color: var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.field-row__type {
  background: var(--surface-muted);
  color: var(--muted-strong);
  border-radius: 999px;
  font-weight: 800;
}

:deep(.add-option__input) {
  border-color: var(--border);
}

:deep(.add-option__input:focus) {
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}

:deep(.add-option__btn) {
  background: #fff;
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 24%, white);
}

.btn-save {
  border-radius: 8px;
  background: var(--brand);
  box-shadow: var(--shadow-xs);
}

.btn-save:hover:not(:disabled) {
  background: var(--brand-strong);
  box-shadow: var(--shadow-sm);
}
</style>
