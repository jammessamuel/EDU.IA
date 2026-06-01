<template>
  <div class="login-page">
    <div class="login-card" :class="{ 'login-card--wide': activeTab === 'register' && !selectedVertical }">
      <!-- Header -->
      <div class="login-header">
        <div class="logo-mark">SDR<span>.IA</span></div>
        <p>Atendente de IA para qualificação de leads via WhatsApp</p>
      </div>

      <NTabs v-model:value="activeTab" type="line" animated @update:value="error = null">

        <!-- LOGIN -->
        <NTabPane name="login" tab="Entrar">
          <NForm ref="loginFormRef" :model="loginForm" :rules="loginRules" label-placement="top" style="margin-top:16px">
            <NFormItem label="Email" path="email">
              <NInput v-model:value="loginForm.email" placeholder="admin@demo.edu"
                :input-props="{ type: 'email', autocomplete: 'email' }" @keydown.enter="handleLogin" />
            </NFormItem>
            <NFormItem label="Senha" path="password">
              <NInput v-model:value="loginForm.password" placeholder="••••••••" type="password"
                show-password-on="click" @keydown.enter="handleLogin" />
            </NFormItem>
            <NAlert v-if="error" type="error" :title="error" style="margin-bottom:12px" />
            <NButton type="primary" block :loading="loading" style="margin-top:8px" @click="handleLogin">
              Entrar
            </NButton>
          </NForm>
        </NTabPane>

        <!-- CADASTRO -->
        <NTabPane name="register" tab="Criar conta">

          <!-- Passo 1: escolha do vertical -->
          <div v-if="!selectedVertical" class="vertical-step">
            <p class="vertical-step__label">Qual é o setor do seu negócio?</p>
            <div v-if="loadingVerticals" class="vertical-loading">Carregando...</div>
            <div v-else class="vertical-grid">
              <button
                v-for="v in verticals"
                :key="v.id"
                class="vcard"
                @click="selectVertical(v)"
              >
                <span class="vcard__icon">{{ v.icon }}</span>
                <span class="vcard__name">{{ v.name }}</span>
              </button>
            </div>
          </div>

          <!-- Passo 2: formulário com vertical selecionado -->
          <div v-else>
            <button class="back-btn" @click="selectedVertical = null">
              ← Mudar setor
            </button>
            <div class="selected-vertical" :style="{ borderColor: selectedVertical.color, background: selectedVertical.color + '14' }">
              <span class="selected-vertical__icon">{{ selectedVertical.icon }}</span>
              <span class="selected-vertical__name" :style="{ color: selectedVertical.color }">{{ selectedVertical.name }}</span>
            </div>

            <NForm ref="registerFormRef" :model="registerForm" :rules="registerRules" label-placement="top" style="margin-top:16px">
              <NFormItem label="Seu nome" path="name">
                <NInput v-model:value="registerForm.name" placeholder="Maria Silva" />
              </NFormItem>
              <NFormItem label="Email" path="email">
                <NInput v-model:value="registerForm.email" placeholder="maria@empresa.com"
                  :input-props="{ type: 'email', autocomplete: 'email' }" />
              </NFormItem>
              <NFormItem label="Senha" path="password">
                <NInput v-model:value="registerForm.password" placeholder="Mín. 8 caracteres"
                  type="password" show-password-on="click" />
              </NFormItem>
              <NFormItem label="Nome do negócio" path="workspaceName">
                <NInput v-model:value="registerForm.workspaceName" placeholder="Escritório Silva & Associados" />
              </NFormItem>
              <NAlert v-if="error" type="error" :title="error" style="margin-bottom:12px" />
              <NButton type="primary" block :loading="loading" style="margin-top:8px" @click="handleRegister">
                Criar conta
              </NButton>
            </NForm>
          </div>
        </NTabPane>
      </NTabs>

      <div class="demo-hint">
        <span>Demo: admin@demo.edu / Admin@1234</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, NAlert, NTabs, NTabPane, type FormInst, type FormRules } from 'naive-ui'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../api/client'
import type { Vertical } from '../types'

const router    = useRouter()
const authStore = useAuthStore()

const activeTab      = ref<'login' | 'register'>('login')
const loading        = ref(false)
const error          = ref<string | null>(null)
const loginFormRef   = ref<FormInst | null>(null)
const registerFormRef= ref<FormInst | null>(null)

// Verticals
const verticals        = ref<Vertical[]>([])
const loadingVerticals = ref(false)
const selectedVertical = ref<Vertical | null>(null)

onMounted(async () => {
  loadingVerticals.value = true
  try {
    const { data } = await apiClient.get<Vertical[]>('/verticals')
    verticals.value = data
  } catch { /* silencioso */ }
  finally { loadingVerticals.value = false }
})

function selectVertical(v: Vertical) {
  selectedVertical.value = v
  error.value = null
}

// Forms
const loginForm    = ref({ email: '', password: '' })
const registerForm = ref({ name: '', email: '', password: '', workspaceName: '' })

const loginRules: FormRules = {
  email:    [{ required: true, message: 'Email obrigatório',  trigger: 'blur' }],
  password: [{ required: true, message: 'Senha obrigatória',  trigger: 'blur' }],
}
const registerRules: FormRules = {
  name:          [{ required: true, min: 2, message: 'Nome obrigatório',           trigger: 'blur' }],
  email:         [{ required: true, type: 'email', message: 'Email inválido',      trigger: 'blur' }],
  password:      [{ required: true, min: 8, message: 'Mín. 8 caracteres',          trigger: 'blur' }],
  workspaceName: [{ required: true, min: 2, message: 'Nome do negócio obrigatório', trigger: 'blur' }],
}

async function handleLogin() {
  try { await loginFormRef.value?.validate() } catch { return }
  loading.value = true; error.value = null
  try {
    await authStore.login(loginForm.value.email, loginForm.value.password)
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message ?? 'Erro ao fazer login'
  } finally { loading.value = false }
}

async function handleRegister() {
  if (!selectedVertical.value) { error.value = 'Selecione um setor'; return }
  try { await registerFormRef.value?.validate() } catch { return }
  loading.value = true; error.value = null
  try {
    await authStore.register(
      registerForm.value.name,
      registerForm.value.email,
      registerForm.value.password,
      registerForm.value.workspaceName,
      selectedVertical.value.id,
    )
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message ?? 'Erro ao criar conta'
  } finally { loading.value = false }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #075e54 100%);
}

.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.25);
  transition: max-width 0.3s ease;
}

.login-card--wide { max-width: 560px; }

/* Brand */
.login-header { text-align: center; margin-bottom: 24px; }

.logo-mark {
  font-size: 32px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -1px;
  line-height: 1;
  margin-bottom: 6px;
}

.logo-mark span { color: #075e54; }

.login-header p {
  margin: 0;
  font-size: 13px;
  color: #888;
  line-height: 1.4;
}

/* Vertical grid */
.vertical-step { margin-top: 16px; }

.vertical-step__label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0 0 14px;
  text-align: center;
}

.vertical-loading { text-align: center; color: #aaa; padding: 20px; }

.vertical-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.vcard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border-radius: 12px;
  border: 1.5px solid #e8e8e8;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.15s;
}

.vcard:hover {
  border-color: #075e54;
  background: #e8f5e9;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(7,94,84,0.12);
}

.vcard__icon { font-size: 26px; line-height: 1; }
.vcard__name { font-size: 12px; font-weight: 600; color: #333; text-align: center; }

/* Selected vertical badge */
.back-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 10px;
}

.back-btn:hover { color: #333; }

.selected-vertical {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1.5px solid;
  margin-bottom: 4px;
}

.selected-vertical__icon { font-size: 20px; }
.selected-vertical__name { font-size: 14px; font-weight: 700; }

/* Demo hint */
.demo-hint {
  text-align: center;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #aaa;
}
</style>
