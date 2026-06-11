<!--
  LoginView.vue — tela de autenticação (login + cadastro).
  Layout split-screen: formulário (creme) à esquerda e, à direita, um painel
  que simula o próprio produto — um atendente de IA digitando em tempo real.
  Toda a lógica de login/cadastro multi-step (com seleção de vertical) foi
  preservada; só a aparência mudou.
-->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NIcon } from 'naive-ui'
import { MoonOutline, SunnyOutline } from '@vicons/ionicons5'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../api/client'
import type { Vertical } from '../types'
import TypewriterText from '../components/auth/TypewriterText.vue'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const authStore = useAuthStore()
const { isDark, themeLabel, toggleTheme } = useTheme()

const mode = ref<'login' | 'register'>('login')
const loading = ref(false)
const error = ref<string | null>(null)
const showPass = ref(false)

// Verticais (setores) carregados do backend para o passo 1 do cadastro
const verticals = ref<Vertical[]>([])
const loadingVerticals = ref(false)
const selectedVertical = ref<Vertical | null>(null)

const loginForm = ref({ email: '', password: '' })
const registerForm = ref({ name: '', email: '', password: '', workspaceName: '' })
const registerStep = computed(() => (selectedVertical.value ? 2 : 1))

onMounted(async () => {
  loadingVerticals.value = true
  try {
    const { data } = await apiClient.get<Vertical[]>('/verticals')
    verticals.value = data
  } catch {
    /* silencioso — o cadastro só é necessário para novos negócios */
  } finally {
    loadingVerticals.value = false
  }
})

function setMode(m: 'login' | 'register') {
  if (mode.value === m) return
  mode.value = m
  error.value = null
}

function selectVertical(v: Vertical) {
  selectedVertical.value = v
  error.value = null
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

async function handleLogin() {
  const f = loginForm.value
  if (!f.email || !f.password) return (error.value = 'Preencha e-mail e senha.')
  if (!isEmail(f.email)) return (error.value = 'E-mail inválido.')
  loading.value = true
  error.value = null
  try {
    await authStore.login(f.email, f.password)
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message ?? 'E-mail ou senha incorretos.'
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (!selectedVertical.value) return (error.value = 'Selecione um setor.')
  const f = registerForm.value
  if (!f.name || f.name.trim().length < 2) return (error.value = 'Informe o seu nome.')
  if (!isEmail(f.email)) return (error.value = 'E-mail inválido.')
  if (f.password.length < 8) return (error.value = 'A senha precisa ter no mínimo 8 caracteres.')
  if (!f.workspaceName || f.workspaceName.trim().length < 2)
    return (error.value = 'Informe o nome do negócio.')
  loading.value = true
  error.value = null
  try {
    await authStore.register(
      f.name,
      f.email,
      f.password,
      f.workspaceName,
      selectedVertical.value.id,
    )
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message ?? 'Não foi possível criar a conta.'
  } finally {
    loading.value = false
  }
}

// Conteúdo do painel da direita muda conforme entrar / criar conta
const panel = computed(() =>
  mode.value === 'login'
    ? {
        tag: 'Que bom te ver de novo.',
        sub: 'Enquanto você esteve fora, seu atendente continuou qualificando leads.',
        chat: [
          'Período da manhã ou da noite? 😊',
          'Posso já reservar a sua vaga?',
          'Te mando os valores e as bolsas agora?',
        ],
      }
    : {
        tag: 'Comece em menos de um minuto.',
        sub: 'Configure seu atendente de IA e deixe ele conversar e qualificar por você.',
        chat: [
          'Oi! Como posso te ajudar hoje?',
          'Me conta: qual curso te interessa?',
          'Já entendi seu perfil. Bora? 🚀',
        ],
      },
)
</script>

<template>
  <div class="auth">
    <button type="button" class="auth-theme" :title="themeLabel" @click="toggleTheme">
      <NIcon :component="isDark ? SunnyOutline : MoonOutline" size="16" />
      <span>{{ themeLabel }}</span>
    </button>

    <!-- ╭──────────────── ESQUERDA: formulário ────────────────╮ -->
    <section class="pane pane--form">
      <div class="form-wrap">
        <!-- marca -->
        <div class="brand">
          <span class="brand__logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
          </span>
          <span class="brand__name">EDU<span>.IA</span></span>
        </div>

        <!-- alternância entrar / criar conta -->
        <div class="seg" role="tablist" aria-label="Entrar ou criar conta">
          <button role="tab" :aria-selected="mode === 'login'" :class="{ 'is-on': mode === 'login' }"
            @click="setMode('login')">Entrar</button>
          <button role="tab" :aria-selected="mode === 'register'" :class="{ 'is-on': mode === 'register' }"
            @click="setMode('register')">Criar conta</button>
          <span class="seg__thumb" :class="{ 'seg__thumb--right': mode === 'register' }" />
        </div>

        <Transition name="swap" mode="out-in">
          <!-- ░░ LOGIN ░░ -->
          <form v-if="mode === 'login'" key="login" class="stack" @submit.prevent="handleLogin">
            <header class="head">
              <h1>Bem-vindo de volta</h1>
              <p>Entre para acompanhar seus leads em tempo real.</p>
            </header>

            <label class="field">
              <span class="field__label">E-mail</span>
              <input v-model="loginForm.email" type="email" autocomplete="email"
                placeholder="voce@empresa.com" />
            </label>

            <label class="field">
              <span class="field__label">Senha</span>
              <div class="field__pw">
                <input v-model="loginForm.password" :type="showPass ? 'text' : 'password'"
                  autocomplete="current-password" placeholder="••••••••" @keyup.enter="handleLogin" />
                <button type="button" class="eye" @click="showPass = !showPass"
                  :aria-label="showPass ? 'Ocultar senha' : 'Mostrar senha'">
                  <svg v-if="showPass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" x2="22" y1="2" y2="22" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </label>

            <p v-if="error" class="err">{{ error }}</p>

            <button class="btn" type="submit" :disabled="loading">
              <span v-if="!loading">Entrar</span>
              <span v-else class="spin" />
            </button>
          </form>

          <!-- ░░ CADASTRO ░░ -->
          <div v-else key="register" class="stack">
            <header class="head">
              <h1>Crie sua conta</h1>
              <p>{{ selectedVertical ? 'Agora é só preencher seus dados.' : 'Comece escolhendo o setor do seu negócio.' }}</p>
            </header>

            <div class="register-steps" aria-label="Progresso do cadastro">
              <span :class="{ 'is-done': registerStep > 1, 'is-on': registerStep === 1 }">1. Setor</span>
              <i></i>
              <span :class="{ 'is-on': registerStep === 2 }">2. Dados</span>
            </div>

            <!-- passo 1: escolher vertical -->
            <div v-if="!selectedVertical">
              <div v-if="loadingVerticals" class="vgrid">
                <span v-for="n in 6" :key="n" class="vskel" />
              </div>
              <div v-else class="vgrid">
                <button v-for="v in verticals" :key="v.id" class="vchip"
                  :style="{ '--vc': v.color }" @click="selectVertical(v)">
                  <span class="vchip__icon">{{ v.icon }}</span>
                  <span class="vchip__name">{{ v.name }}</span>
                </button>
              </div>
              <p class="register-helper">
                O setor define as perguntas iniciais, etapas do pipeline e exemplos da demonstração.
              </p>
            </div>

            <!-- passo 2: dados -->
            <form v-else class="stack" @submit.prevent="handleRegister">
              <button type="button" class="back" @click="selectedVertical = null">← Trocar setor</button>
              <div class="vsel" :style="{ '--vc': selectedVertical.color }">
                <span class="vsel__icon">{{ selectedVertical.icon }}</span>
                <strong>{{ selectedVertical.name }}</strong>
              </div>

              <div class="register-checks">
                <span>Workspace configurado para {{ selectedVertical.name }}</span>
                <span>Você pode ajustar campos e etapas depois em Configurações</span>
              </div>

              <label class="field">
                <span class="field__label">Seu nome</span>
                <input v-model="registerForm.name" placeholder="Maria Silva" autocomplete="name" />
              </label>
              <label class="field">
                <span class="field__label">E-mail</span>
                <input v-model="registerForm.email" type="email" placeholder="maria@empresa.com"
                  autocomplete="email" />
              </label>
              <label class="field">
                <span class="field__label">Senha</span>
                <div class="field__pw">
                  <input v-model="registerForm.password" :type="showPass ? 'text' : 'password'"
                    placeholder="Mínimo 8 caracteres" autocomplete="new-password" />
                  <button type="button" class="eye" @click="showPass = !showPass"
                    :aria-label="showPass ? 'Ocultar senha' : 'Mostrar senha'">
                    <svg v-if="showPass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" x2="22" y1="2" y2="22" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                      stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </label>
              <label class="field">
                <span class="field__label">Nome do negócio</span>
                <input v-model="registerForm.workspaceName" placeholder="Faculdade Horizonte" />
              </label>

              <p v-if="error" class="err">{{ error }}</p>

              <button class="btn" type="submit" :disabled="loading">
                <span v-if="!loading">Criar conta</span>
                <span v-else class="spin" />
              </button>
            </form>
          </div>
        </Transition>

        <!-- dica de demonstração -->
        <div class="demo">
          <span class="demo__dot" />
          Demo: <code>admin@demo.edu</code> · <code>Admin@1234</code>
        </div>
      </div>
    </section>

    <!-- ╭──────────────── DIREITA: painel da IA ────────────────╮ -->
    <aside class="pane pane--show" aria-hidden="true">
      <span class="glow" />
      <span class="grain" />

      <div class="show">
        <div class="chat">
          <div class="bubble bubble--in">Oi! Quero saber sobre o curso 👋</div>
          <div class="bubble bubble--ai">
            <span class="bubble__who">EDU.IA respondendo</span>
            <TypewriterText :key="mode" :text="panel.chat" />
          </div>
        </div>

        <div class="copy">
          <h2>{{ panel.tag }}</h2>
          <p>{{ panel.sub }}</p>
        </div>

        <div class="foot">
          <span class="foot__mark">EDU<span>.IA</span></span>
          <span class="foot__sep">·</span>
          <span>Atendente de IA para qualificação de leads</span>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.auth {
  --green-900: var(--brand-strong);
  --green-800: var(--brand);
  --green-600: color-mix(in srgb, var(--brand) 74%, var(--accent));
  --green-400: var(--accent);
  --cream: var(--app-bg);
  --cream-2: var(--surface-muted);
  --ink: var(--text);
  --line: var(--border);
  --white: var(--surface);

  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr;
  font-family: 'Hanken Grotesk', system-ui, -apple-system, sans-serif;
  color: var(--ink);
  background: var(--cream);
  overflow-y: auto;
}

.auth-theme {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 6;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--brand) 24%, var(--border));
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--brand);
  box-shadow: var(--shadow-xs);
  backdrop-filter: blur(14px);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}

.auth-theme:hover {
  border-color: color-mix(in srgb, var(--brand) 38%, var(--border));
  transform: translateY(-1px);
}
@media (min-width: 920px) {
  .auth {
    grid-template-columns: 1.04fr 1fr;
    overflow: hidden;
  }
}

/* ── painéis ── */
.pane {
  position: relative;
}
.pane--form {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 44px 28px;
  overflow-y: auto;
}
/* textura de pontos discreta no creme */
.pane--form::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--line) 1px, transparent 1px);
  background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(ellipse at 50% 40%, #000 25%, transparent 75%);
  mask-image: radial-gradient(ellipse at 50% 40%, #000 25%, transparent 75%);
  opacity: 0.34;
  pointer-events: none;
}

.form-wrap {
  position: relative;
  width: 100%;
  max-width: 380px;
  animation: rise 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

/* ── marca ── */
.brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 30px;
}
.brand__logo {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  color: #fff;
  background: linear-gradient(150deg, var(--green-600), var(--green-800));
  box-shadow: 0 7px 18px rgba(7, 94, 84, 0.3);
}
.brand__name {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 800;
  font-size: 21px;
  letter-spacing: 0;
  color: var(--ink);
}
.brand__name span {
  color: var(--green-600);
}

/* ── segmented toggle ── */
.seg {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  background: var(--cream-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-bottom: 26px;
}
.seg button {
  position: relative;
  z-index: 1;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  padding: 9px 0;
  border-radius: 6px;
  transition: color 0.25s;
}
.seg button.is-on {
  color: var(--ink);
}
.seg__thumb {
  position: absolute;
  z-index: 0;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: var(--white);
  border-radius: 6px;
  box-shadow: 0 2px 9px rgba(18, 33, 29, 0.1);
  transition: transform 0.34s cubic-bezier(0.4, 1.2, 0.4, 1);
}
.seg__thumb--right {
  transform: translateX(100%);
}

/* ── cabeçalho do form ── */
.head {
  margin-bottom: 4px;
}
.head h1 {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 700;
  font-size: 27px;
  line-height: 1.1;
  letter-spacing: 0;
  color: var(--ink);
}
.head p {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--muted);
}

/* ── pilha de campos ── */
.stack {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.field__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
}
.field input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  font-family: inherit;
  font-size: 14.5px;
  color: var(--ink);
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: 8px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.field input::placeholder {
  color: color-mix(in srgb, var(--muted) 72%, transparent);
}
.field input:focus {
  border-color: var(--green-600);
  box-shadow: 0 0 0 3px rgba(14, 143, 126, 0.15);
}

.field__pw {
  position: relative;
}
.field__pw input {
  padding-right: 46px;
}
.eye {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s;
}
.eye:hover {
  color: var(--green-800);
}

/* ── botão principal ── */
.btn {
  position: relative;
  height: 48px;
  margin-top: 6px;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(150deg, var(--green-600), var(--green-800));
  box-shadow: 0 9px 22px rgba(7, 94, 84, 0.28);
  display: grid;
  place-items: center;
  transition: transform 0.12s, box-shadow 0.2s, filter 0.2s;
}
.btn:hover {
  filter: brightness(1.06);
  box-shadow: 0 12px 28px rgba(7, 94, 84, 0.36);
}
.btn:active {
  transform: translateY(1px);
}
.btn:disabled {
  opacity: 0.7;
  cursor: progress;
}
.spin {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}

/* ── erro ── */
.err {
  font-size: 13px;
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--surface));
  padding: 9px 12px;
  border-radius: 8px;
}

.register-steps {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--white) 82%, transparent);
}

.register-steps span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.register-steps span.is-on,
.register-steps span.is-done {
  color: var(--green-800);
}

.register-steps i {
  height: 1px;
  background: var(--line);
}

.register-helper {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.register-checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, var(--green-800) 18%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--green-800) 8%, var(--white));
}

.register-checks span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.register-checks span:first-child {
  color: var(--ink);
  font-weight: 800;
}

/* ── grid de verticais ── */
.vgrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}
.vchip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 15px 6px;
  background: var(--white);
  border: 1.5px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.vchip:hover {
  transform: translateY(-3px);
  border-color: var(--vc, var(--green-600));
  box-shadow: 0 8px 18px color-mix(in srgb, var(--vc, #0e8f7e) 22%, transparent);
}
.vchip__icon {
  font-size: 24px;
  line-height: 1;
}
.vchip__name {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink);
  text-align: center;
  line-height: 1.2;
}
.vskel {
  height: 76px;
  border-radius: 8px;
  background: linear-gradient(100deg, var(--cream-2) 30%, var(--surface-soft) 50%, var(--cream-2) 70%);
  background-size: 220% 100%;
  animation: shimmer 1.3s infinite;
}

/* ── vertical selecionado ── */
.back {
  align-self: flex-start;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.back:hover {
  color: var(--ink);
}
.vsel {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 13px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--vc) 10%, var(--white));
  border: 1.5px solid color-mix(in srgb, var(--vc) 38%, transparent);
}
.vsel__icon {
  font-size: 18px;
}
.vsel strong {
  font-size: 13.5px;
  color: var(--ink);
}

/* ── dica de demo ── */
.demo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  font-size: 12.5px;
  color: var(--muted);
}
.demo code {
  background: var(--cream-2);
  padding: 2px 7px;
  border-radius: 6px;
  color: var(--ink);
  font-size: 12px;
  font-family: ui-monospace, monospace;
}
.demo__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green-400);
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.2);
  animation: pulse 2s infinite;
}

/* ╭─────────── painel da direita ───────────╮ */
.pane--show {
  display: none;
}
@media (min-width: 920px) {
  .pane--show {
    display: block;
    height: 100%;
    overflow: hidden;
    background: var(--auth-panel-bg);
  }
}
.glow {
  display: none;
}
.grain {
  position: absolute;
  inset: 0;
  opacity: 0.05;
  mix-blend-mode: overlay;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.show {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 42px;
  padding: 64px;
  color: #eafff5;
}

/* mini chat */
.chat {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 420px;
}
.bubble {
  padding: 13px 17px;
  border-radius: 8px;
  font-size: 14.5px;
  line-height: 1.45;
  max-width: 90%;
  animation: bubble 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.bubble--in {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-bottom-left-radius: 5px;
  color: #eafff5;
  animation-delay: 0.3s;
}
.bubble--ai {
  align-self: flex-end;
  min-width: 220px;
  min-height: 48px;
  background: var(--accent);
  color: var(--brand-strong);
  font-weight: 500;
  border-bottom-right-radius: 5px;
  box-shadow: 0 12px 34px rgba(37, 211, 102, 0.32);
  animation-delay: 0.6s;
}
.bubble__who {
  display: block;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0;
  opacity: 0.5;
  margin-bottom: 4px;
}

/* tagline */
.copy {
  max-width: 470px;
}
.copy h2 {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 700;
  font-size: 39px;
  line-height: 1.04;
  letter-spacing: 0;
  color: #fff;
  animation: rise 0.7s 0.35s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.copy p {
  margin-top: 15px;
  font-size: 16px;
  line-height: 1.5;
  color: rgba(234, 255, 245, 0.74);
  animation: rise 0.7s 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

/* rodapé */
.foot {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12.5px;
  color: rgba(234, 255, 245, 0.55);
}
.foot__mark {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 800;
  font-size: 15px;
  color: #fff;
}
.foot__mark span {
  color: var(--accent);
}
.foot__sep {
  opacity: 0.4;
}

/* ── transições / keyframes ── */
.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.swap-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
@keyframes bubble {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes shimmer {
  to {
    background-position: -220% 0;
  }
}
@keyframes pulse {
  50% {
    box-shadow: 0 0 0 6px rgba(37, 211, 102, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-wrap,
  .bubble,
  .copy h2,
  .copy p {
    animation: none;
  }
}

@media (max-width: 560px) {
  .auth-theme span {
    display: none;
  }

  .pane--form {
    padding: 72px 20px 32px;
  }

  .vgrid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
