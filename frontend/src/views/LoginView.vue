<!--
  LoginView.vue — tela de autenticação (login + cadastro).
  Layout split-screen: formulário à esquerda, painel de showcase do produto à
  direita. Visual alinhado ao restante do app (cards flat, borda de 1px,
  sombra sutil — mesma linguagem de AppNav/DashboardView), sem os efeitos
  decorativos (grão, feixes de luz, cards flutuantes) da versão anterior.
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
import { useAccessibility } from '../composables/useAccessibility'
import type { AccessibilityProfile, ColorBlindMode } from '../types'

const router = useRouter()
const authStore = useAuthStore()
const { isDark, themeLabel, toggleTheme } = useTheme()
const { profile: accessibilityProfile, updateProfile } = useAccessibility()

const mode = ref<'login' | 'register'>('login')
const loading = ref(false)
const error = ref<string | null>(null)
const showPass = ref(false)

// Verticais (setores) carregados do backend para o passo 1 do cadastro
const verticals = ref<Vertical[]>([])
const loadingVerticals = ref(false)
const verticalLoadFailed = ref(false)
const selectedVertical = ref<Vertical | null>(null)

const loginForm = ref({ email: '', password: '' })
const registerForm = ref({ name: '', email: '', password: '', workspaceName: '' })
const registerStep = computed(() => (selectedVertical.value ? 2 : 1))

onMounted(() => loadVerticals())

async function loadVerticals() {
  loadingVerticals.value = true
  verticalLoadFailed.value = false
  try {
    const { data } = await apiClient.get<Vertical[]>('/verticals')
    verticals.value = data
  } catch {
    verticalLoadFailed.value = true
  } finally {
    loadingVerticals.value = false
  }
}

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
    router.push('/hoje')
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
    await updateProfile({ ...accessibilityProfile.value })
    router.push('/hoje')
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
        tag: 'Sua IA de matrículas em minutos.',
        sub: 'Configure o atendente e deixe ele conversar e qualificar por você, 24 horas por dia.',
        chat: [
          'Oi! Como posso te ajudar hoje?',
          'Me conta: qual curso te interessa?',
          'Já entendi seu perfil. Bora? 🚀',
        ],
      },
)

// Números de apoio do painel de showcase — reforçam a proposta de valor sem simular dado falso
const highlights = [
  { value: '< 10s', label: 'Tempo de resposta' },
  { value: '24/7', label: 'Atendimento contínuo' },
  { value: '+3x', label: 'Leads qualificados' },
]

const onboardingLanguages = ['Português', 'English', 'Español']
const onboardingDocuments = ['CPF/RG', 'Passaporte', 'SSN', 'NIE/DNI']

const colorBlindOptions: { value: ColorBlindMode; label: string }[] = [
  { value: 'none', label: 'Sem ajuste' },
  { value: 'protanopia', label: 'Protanopia' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'tritanopia', label: 'Tritanopia' },
]

function setAccessibility(input: Partial<AccessibilityProfile>) {
  updateProfile(input)
}

function onAccessibilityToggle(
  key: 'screenReader' | 'highContrast' | 'reduceMotion' | 'simpleLanguage',
  event: Event,
) {
  setAccessibility({ [key]: (event.target as HTMLInputElement).checked })
}

function onColorBlindChange(event: Event) {
  setAccessibility({ colorBlindMode: (event.target as HTMLSelectElement).value as ColorBlindMode })
}

function onFontScaleChange(event: Event) {
  setAccessibility({ fontScale: Number((event.target as HTMLInputElement).value) })
}
</script>

<template>
  <div class="auth">
    <button type="button" class="auth-theme" :title="themeLabel" @click="toggleTheme">
      <NIcon :component="isDark ? SunnyOutline : MoonOutline" size="15" />
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
              <input v-model="loginForm.email" type="email" autocomplete="email" aria-label="E-mail"
                placeholder="voce@empresa.com" />
            </label>

            <label class="field">
              <span class="field__label">Senha</span>
              <div class="field__pw">
                <input v-model="loginForm.password" :type="showPass ? 'text' : 'password'" aria-label="Senha"
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
              <div v-else-if="verticals.length" class="vgrid">
                <button v-for="v in verticals" :key="v.id" class="vchip"
                  :style="{ '--vc': v.color }" @click="selectVertical(v)">
                  <span class="vchip__icon">{{ v.icon }}</span>
                  <span class="vchip__name">{{ v.name }}</span>
                </button>
              </div>
              <div v-else class="info-box info-box--dashed" aria-live="polite">
                <strong>{{ verticalLoadFailed ? 'Não consegui carregar os setores agora.' : 'Nenhum setor disponível.' }}</strong>
                <span>{{ verticalLoadFailed ? 'Confira a conexão do backend e tente novamente.' : 'Cadastre um setor para liberar novas contas.' }}</span>
                <button type="button" class="info-box__action" @click="loadVerticals">Tentar novamente</button>
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

              <div class="info-box">
                <strong>Workspace configurado para {{ selectedVertical.name }}</strong>
                <span>Você pode ajustar campos e etapas depois em Configurações</span>
              </div>

              <div class="info-box">
                <strong>Atendimento internacional incluído</strong>
                <span>A IA detecta o idioma do aluno e adapta a matrícula para brasileiro ou estrangeiro.</span>
                <div class="info-box__grid">
                  <section>
                    <small>Idiomas</small>
                    <p>
                      <b v-for="language in onboardingLanguages" :key="language">{{ language }}</b>
                    </p>
                  </section>
                  <section>
                    <small>Documentos</small>
                    <p>
                      <b v-for="document in onboardingDocuments" :key="document">{{ document }}</b>
                    </p>
                  </section>
                </div>
              </div>

              <fieldset class="info-box accessibility-setup">
                <legend>Preferências de acessibilidade (opcional)</legend>
                <p>
                  Ajuste agora se você usa leitor de tela, precisa de contraste, menos movimento ou linguagem mais direta.
                </p>

                <div class="accessibility-setup__toggles">
                  <label>
                    <input
                      type="checkbox"
                      :checked="accessibilityProfile.screenReader"
                      @change="onAccessibilityToggle('screenReader', $event)"
                    />
                    <span>Leitor de tela</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      :checked="accessibilityProfile.highContrast"
                      @change="onAccessibilityToggle('highContrast', $event)"
                    />
                    <span>Alto contraste</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      :checked="accessibilityProfile.reduceMotion"
                      @change="onAccessibilityToggle('reduceMotion', $event)"
                    />
                    <span>Reduzir animações</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      :checked="accessibilityProfile.simpleLanguage"
                      @change="onAccessibilityToggle('simpleLanguage', $event)"
                    />
                    <span>Linguagem simples</span>
                  </label>
                </div>

                <label class="accessibility-setup__field">
                  <span>Modo daltonismo</span>
                  <select :value="accessibilityProfile.colorBlindMode" @change="onColorBlindChange">
                    <option v-for="option in colorBlindOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <label class="accessibility-setup__field">
                  <span>Escala da fonte: {{ Math.round(accessibilityProfile.fontScale * 100) }}%</span>
                  <input
                    type="range"
                    min="0.9"
                    max="1.35"
                    step="0.05"
                    :value="accessibilityProfile.fontScale"
                    @input="onFontScaleChange"
                  />
                </label>
              </fieldset>

              <label class="field">
                <span class="field__label">Seu nome</span>
                <input v-model="registerForm.name" aria-label="Seu nome" placeholder="Maria Silva" autocomplete="name" />
              </label>
              <label class="field">
                <span class="field__label">E-mail</span>
                <input v-model="registerForm.email" type="email" aria-label="E-mail" placeholder="maria@empresa.com"
                  autocomplete="email" />
              </label>
              <label class="field">
                <span class="field__label">Senha</span>
                <div class="field__pw">
                  <input v-model="registerForm.password" :type="showPass ? 'text' : 'password'" aria-label="Senha"
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
                <input v-model="registerForm.workspaceName" aria-label="Nome do negócio" placeholder="Faculdade Horizonte" />
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
      <div class="show">
        <span class="show__eyebrow">
          <i />
          Demonstração ao vivo
        </span>

        <div class="copy">
          <h2>{{ panel.tag }}</h2>
          <p>{{ panel.sub }}</p>
        </div>

        <div class="chat">
          <div class="bubble bubble--in">Oi! Quero saber sobre o curso 👋</div>
          <div class="bubble bubble--ai">
            <span class="bubble__who">EDU.IA respondendo</span>
            <TypewriterText :key="mode" :text="panel.chat" />
          </div>
        </div>

        <div class="stat-row">
          <div v-for="h in highlights" :key="h.label" class="stat-tile">
            <strong>{{ h.value }}</strong>
            <span>{{ h.label }}</span>
          </div>
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
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr;
  font-family: 'Hanken Grotesk', system-ui, -apple-system, sans-serif;
  color: var(--text);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--brand) 6%, transparent), transparent 34%),
    linear-gradient(315deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent 38%),
    var(--app-bg);
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
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  color: var(--brand);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  transition: border-color 0.15s, transform 0.15s;
}

.auth-theme:hover {
  border-color: color-mix(in srgb, var(--brand) 38%, var(--border));
  transform: translateY(-1px);
}

.auth button:focus-visible,
.auth input:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 46%, transparent);
  outline-offset: 2px;
}

@media (min-width: 920px) {
  .auth {
    display: block;
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
  scrollbar-gutter: stable both-edges;
}

.form-wrap {
  position: relative;
  width: 100%;
  max-width: 380px;
  animation: rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

@media (min-width: 920px) {
  .pane--form {
    position: relative;
    z-index: 3;
    min-height: 100dvh;
    height: auto;
    padding: clamp(28px, 6vh, 76px) 24px;
    overflow: visible;
  }

  .form-wrap {
    max-width: 400px;
    margin-block: auto;
    padding: 30px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    box-shadow: var(--shadow-md);
  }
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
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--brand);
  flex-shrink: 0;
}
.brand__name {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 800;
  font-size: 21px;
  color: var(--text);
}
.brand__name span {
  color: var(--brand);
}

/* ── segmented toggle ── */
.seg {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
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
  font-weight: 700;
  color: var(--muted);
  padding: 9px 0;
  border-radius: 6px;
  transition: color 0.2s;
}
.seg button.is-on {
  color: var(--text);
}
.seg__thumb {
  position: absolute;
  z-index: 0;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: var(--surface);
  border-radius: 6px;
  box-shadow: var(--shadow-xs);
  transition: transform 0.3s cubic-bezier(0.4, 1.2, 0.4, 1);
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
  font-weight: 800;
  font-size: 26px;
  line-height: 1.15;
  color: var(--text);
}
.head p {
  margin-top: 8px;
  font-size: 13.5px;
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
  font-weight: 700;
  color: var(--text);
}
.field input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  font-family: inherit;
  font-size: 14.5px;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field input::placeholder {
  color: color-mix(in srgb, var(--muted) 72%, transparent);
}
.field input:focus {
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
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
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.15s;
}
.eye:hover {
  color: var(--brand);
}

/* ── botão principal ── */
.btn {
  position: relative;
  height: 46px;
  margin-top: 6px;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: var(--brand);
  display: grid;
  place-items: center;
  transition: filter 0.15s, transform 0.15s;
}
.btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}
.btn:active {
  transform: translateY(0);
}
.btn:disabled {
  opacity: 0.7;
  cursor: progress;
  transform: none;
}
.spin {
  width: 17px;
  height: 17px;
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
  border-radius: var(--radius-md);
}

.register-steps {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.register-steps span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.register-steps span.is-on,
.register-steps span.is-done {
  color: var(--brand);
}

.register-steps i {
  height: 1px;
  background: var(--border);
}

.register-helper {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

/* ── caixas de informação (setor, internacional, acessibilidade) ── */
.info-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 13px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.info-box strong {
  color: var(--text);
  font-size: 13px;
  font-weight: 800;
}

.info-box > span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.info-box--dashed {
  border-style: dashed;
  padding: 16px;
}

.info-box__action {
  align-self: flex-start;
  margin-top: 4px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--brand);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}
.info-box__action:hover {
  background: var(--surface-muted);
}

.info-box__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 2px;
}

.info-box__grid section {
  min-width: 0;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.info-box__grid small {
  display: block;
  color: var(--brand);
  font-size: 10.5px;
  font-weight: 900;
  text-transform: uppercase;
}

.info-box__grid p {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}

.info-box__grid b {
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text);
  font-size: 10.5px;
  line-height: 1;
  font-weight: 800;
}

.accessibility-setup legend {
  padding: 0 2px;
  color: var(--text);
  font-size: 13px;
  font-weight: 800;
}

.accessibility-setup__toggles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}

.accessibility-setup__toggles label {
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.accessibility-setup input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--brand);
}

.accessibility-setup__field {
  display: grid;
  gap: 6px;
  margin-top: 6px;
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.accessibility-setup__field select {
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}
.vchip:hover {
  transform: translateY(-2px);
  border-color: var(--vc, var(--brand));
}
.vchip__icon {
  font-size: 22px;
  line-height: 1;
}
.vchip__name {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text);
  text-align: center;
  line-height: 1.2;
}
.vskel {
  height: 76px;
  border-radius: var(--radius-md);
  background: linear-gradient(100deg, var(--surface-muted) 30%, var(--surface-soft) 50%, var(--surface-muted) 70%);
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
  color: var(--text);
}
.vsel {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 13px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--vc) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--vc) 32%, var(--border));
}
.vsel__icon {
  font-size: 17px;
}
.vsel strong {
  font-size: 13.5px;
  color: var(--text);
}

/* ── dica de demo ── */
.demo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
  font-size: 12.5px;
  color: var(--muted);
}
.demo code {
  background: var(--surface-muted);
  padding: 2px 7px;
  border-radius: 6px;
  color: var(--text);
  font-size: 12px;
  font-family: ui-monospace, monospace;
}
.demo__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

/* ╭─────────── painel da direita — showcase ───────────╮ */
.pane--show {
  display: none;
}
@media (min-width: 920px) {
  .pane--show {
    position: fixed;
    inset: 0;
    display: block;
    height: 100%;
    background: var(--auth-panel-bg);
  }
}

.show {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 22px;
  max-width: 480px;
  padding: 64px;
  color: #eafff5;
  pointer-events: none;
}

@media (min-width: 920px) and (max-width: 1279px) {
  .show {
    display: none;
  }
}

@media (min-width: 1280px) {
  .show {
    position: absolute;
    inset: 0;
    height: auto;
    margin-inline-start: auto;
    padding: clamp(40px, 6vh, 72px) clamp(48px, 6vw, 96px);
  }
}

.show__eyebrow {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(234, 255, 245, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(234, 255, 245, 0.86);
  font-size: 12px;
  font-weight: 800;
  animation: rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.show__eyebrow i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #4ade80;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.22);
  animation: pulse 2.4s ease-out infinite;
}

/* tagline */
.copy {
  animation: rise 0.55s 0.05s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.copy h2 {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 800;
  font-size: 36px;
  line-height: 1.08;
  color: #fff;
}
.copy p {
  margin-top: 13px;
  font-size: 15.5px;
  line-height: 1.5;
  color: rgba(234, 255, 245, 0.74);
}

/* mini chat */
.chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
  animation: rise 0.55s 0.1s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.bubble {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.45;
  max-width: 92%;
}
.bubble--in {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-bottom-left-radius: 4px;
  color: #eafff5;
}
.bubble--ai {
  align-self: flex-end;
  min-width: 210px;
  min-height: 46px;
  background: var(--accent);
  color: var(--brand-strong);
  font-weight: 500;
  border-bottom-right-radius: 4px;
}
.bubble__who {
  display: block;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  opacity: 0.55;
  margin-bottom: 4px;
}

/* stats de apoio */
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  max-width: 440px;
  animation: rise 0.55s 0.15s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.stat-tile {
  padding: 12px;
  border: 1px solid rgba(234, 255, 245, 0.14);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.06);
}
.stat-tile strong {
  display: block;
  color: #fff;
  font-size: 19px;
  font-weight: 900;
  line-height: 1.1;
}
.stat-tile span {
  display: block;
  margin-top: 4px;
  color: rgba(234, 255, 245, 0.6);
  font-size: 11px;
  line-height: 1.3;
}

/* rodapé */
.foot {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12.5px;
  color: rgba(234, 255, 245, 0.5);
}
.foot__mark {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 800;
  font-size: 14px;
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
  transition: opacity 0.2s ease, transform 0.2s ease;
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
    transform: translateY(12px);
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
    box-shadow: 0 0 0 5px rgba(74, 222, 128, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-wrap,
  .copy,
  .chat,
  .stat-row,
  .show__eyebrow,
  .show__eyebrow i {
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

  .info-box__grid {
    grid-template-columns: 1fr;
  }

  .accessibility-setup__toggles {
    grid-template-columns: 1fr;
  }
}
</style>
