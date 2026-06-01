<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NInput, NSpin, NTag } from 'naive-ui'
import AppNav from '@/components/layout/AppNav.vue'
import { simulatorApi } from '@/api/simulator'

const loading = ref(true)
const saving  = ref(false)
const saved   = ref(false)

const form = ref({
  name:        '',
  chatbotName: '',
  courses:     [] as string[],
  units:       [] as string[],
})

const newCourse = ref('')
const newUnit   = ref('')

onMounted(async () => {
  const s = await simulatorApi.getSchoolSettings()
  form.value = { ...s }
  loading.value = false
})

function addCourse() {
  const v = newCourse.value.trim()
  if (v && !form.value.courses.includes(v)) form.value.courses.push(v)
  newCourse.value = ''
}

function removeCourse(c: string) {
  form.value.courses = form.value.courses.filter((x) => x !== c)
}

function addUnit() {
  const v = newUnit.value.trim()
  if (v && !form.value.units.includes(v)) form.value.units.push(v)
  newUnit.value = ''
}

function removeUnit(u: string) {
  form.value.units = form.value.units.filter((x) => x !== u)
}

async function save() {
  saving.value = true
  await simulatorApi.updateSchoolSettings(form.value)
  saving.value = false
  saved.value = true
  setTimeout(() => (saved.value = false), 2500)
}
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="settings-subheader">
      <h1 class="settings-subheader__title">Configurações da Escola</h1>
    </div>

    <div v-if="loading" class="settings-loading"><NSpin size="large" /></div>

    <div v-else class="settings-body">
      <div class="settings-card">
        <h2 class="settings-section">Identidade</h2>

        <div class="field">
          <label class="field__label">Nome da escola</label>
          <NInput v-model:value="form.name" placeholder="Ex: Faculdade São Paulo" />
          <p class="field__hint">Aparece para o aluno durante a conversa.</p>
        </div>

        <div class="field">
          <label class="field__label">Nome do atendente virtual</label>
          <NInput v-model:value="form.chatbotName" placeholder="Ex: Ana" />
          <p class="field__hint">Como a IA se apresenta ao aluno.</p>
        </div>
      </div>

      <div class="settings-card">
        <h2 class="settings-section">Cursos oferecidos</h2>
        <p class="settings-desc">A IA só vai oferecer estes cursos na conversa.</p>

        <div class="tags-row">
          <NTag
            v-for="c in form.courses"
            :key="c"
            closable
            type="info"
            @close="removeCourse(c)"
          >
            {{ c }}
          </NTag>
        </div>

        <div class="add-row">
          <NInput
            v-model:value="newCourse"
            placeholder="Adicionar curso..."
            style="max-width: 260px"
            @keydown.enter="addCourse"
          />
          <button class="btn-add" @click="addCourse">+ Adicionar</button>
        </div>
      </div>

      <div class="settings-card">
        <h2 class="settings-section">Unidades</h2>
        <p class="settings-desc">Bairros ou campi que a escola possui.</p>

        <div class="tags-row">
          <NTag
            v-for="u in form.units"
            :key="u"
            closable
            type="success"
            @close="removeUnit(u)"
          >
            {{ u }}
          </NTag>
        </div>

        <div class="add-row">
          <NInput
            v-model:value="newUnit"
            placeholder="Adicionar unidade..."
            style="max-width: 260px"
            @keydown.enter="addUnit"
          />
          <button class="btn-add" @click="addUnit">+ Adicionar</button>
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
  flex-shrink: 0;
}

.settings-subheader__title {
  font-size: 17px;
  font-weight: 700;
  color: #111b21;
  margin: 0;
}

.settings-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 640px;
}

.settings-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  font-size: 15px;
  font-weight: 700;
  color: #111b21;
  margin: 0;
}

.settings-desc { font-size: 13px; color: #888; margin: -8px 0 0; }

.field { display: flex; flex-direction: column; gap: 6px; }

.field__label { font-size: 13px; font-weight: 600; color: #444; }

.field__hint { font-size: 12px; color: #aaa; margin: 0; }

.tags-row { display: flex; flex-wrap: wrap; gap: 8px; }

.add-row { display: flex; align-items: center; gap: 10px; }

.btn-add {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  background: #e8f5e9;
  color: #075e54;
  border: 1px solid #b2dfdb;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-add:hover { background: #c8e6c9; }

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
.btn-save:disabled { background: #18a058; }
</style>
