<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Header -->
      <div class="login-header">
        <div class="logo-icon">🎓</div>
        <h1>EDU.IA</h1>
        <p>Plataforma de captação inteligente</p>
      </div>

      <!-- Abas -->
      <NTabs v-model:value="activeTab" type="line" animated>
        <!-- LOGIN -->
        <NTabPane name="login" tab="Entrar">
          <NForm
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            label-placement="top"
            style="margin-top: 16px"
          >
            <NFormItem label="Email" path="email">
              <NInput
                v-model:value="loginForm.email"
                placeholder="admin@demo.edu"
                :input-props="{ autocomplete: 'email', type: 'email' }"
                @keydown.enter="handleLogin"
              />
            </NFormItem>
            <NFormItem label="Senha" path="password">
              <NInput
                v-model:value="loginForm.password"
                placeholder="••••••••"
                type="password"
                show-password-on="click"
                :input-props="{ autocomplete: 'current-password' }"
                @keydown.enter="handleLogin"
              />
            </NFormItem>
            <NAlert v-if="error" type="error" :title="error" style="margin-bottom: 12px" />
            <NButton
              type="primary"
              block
              :loading="loading"
              style="margin-top: 8px"
              @click="handleLogin"
            >
              Entrar
            </NButton>
          </NForm>
        </NTabPane>

        <!-- CADASTRO -->
        <NTabPane name="register" tab="Criar conta">
          <NForm
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            label-placement="top"
            style="margin-top: 16px"
          >
            <NFormItem label="Seu nome" path="name">
              <NInput v-model:value="registerForm.name" placeholder="Maria Silva" />
            </NFormItem>
            <NFormItem label="Email" path="email">
              <NInput v-model:value="registerForm.email" placeholder="maria@escola.edu" :input-props="{ type: 'email', autocomplete: 'email' }" />
            </NFormItem>
            <NFormItem label="Senha" path="password">
              <NInput
                v-model:value="registerForm.password"
                placeholder="Mín. 8 caracteres"
                type="password"
                show-password-on="click"
              />
            </NFormItem>
            <NFormItem label="Nome da escola" path="schoolName">
              <NInput v-model:value="registerForm.schoolName" placeholder="Escola São Paulo" />
            </NFormItem>
            <NAlert v-if="error" type="error" :title="error" style="margin-bottom: 12px" />
            <NButton
              type="primary"
              block
              :loading="loading"
              style="margin-top: 8px"
              @click="handleRegister"
            >
              Criar conta
            </NButton>
          </NForm>
        </NTabPane>
      </NTabs>

      <div class="demo-hint">
        <NText depth="3" style="font-size: 12px">
          Demo: admin@demo.edu / Admin@1234
        </NText>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NForm, NFormItem, NInput, NButton, NAlert, NTabs, NTabPane, NText,
  type FormInst, type FormRules,
} from 'naive-ui'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'login' | 'register'>('login')
const loading = ref(false)
const error = ref<string | null>(null)

const loginFormRef = ref<FormInst | null>(null)
const registerFormRef = ref<FormInst | null>(null)

const loginForm = ref({ email: '', password: '' })
const registerForm = ref({ name: '', email: '', password: '', schoolName: '' })

const loginRules: FormRules = {
  email: [{ required: true, message: 'Email obrigatório', trigger: 'blur' }],
  password: [{ required: true, message: 'Senha obrigatória', trigger: 'blur' }],
}

const registerRules: FormRules = {
  name: [{ required: true, min: 2, message: 'Nome obrigatório', trigger: 'blur' }],
  email: [{ required: true, type: 'email', message: 'Email inválido', trigger: 'blur' }],
  password: [{ required: true, min: 8, message: 'Mín. 8 caracteres', trigger: 'blur' }],
  schoolName: [{ required: true, min: 2, message: 'Nome da escola obrigatório', trigger: 'blur' }],
}

async function handleLogin() {
  try {
    await loginFormRef.value?.validate()
  } catch {
    return
  }
  loading.value = true
  error.value = null
  try {
    await authStore.login(loginForm.value.email, loginForm.value.password)
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erro ao fazer login'
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  try {
    await registerFormRef.value?.validate()
  } catch {
    return
  }
  loading.value = true
  error.value = null
  try {
    await authStore.register(
      registerForm.value.name,
      registerForm.value.email,
      registerForm.value.password,
      registerForm.value.schoolName,
    )
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erro ao criar conta'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #075e54 0%, #128c7e 50%, #25d366 100%);
}

.login-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.login-header {
  text-align: center;
  margin-bottom: 24px;
}

.logo-icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 8px;
}

.login-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: #075e54;
  letter-spacing: -0.5px;
}

.login-header p {
  margin: 4px 0 0;
  color: #667;
  font-size: 14px;
}

.demo-hint {
  text-align: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
