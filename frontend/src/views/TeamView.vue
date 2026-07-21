<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NIcon, NSpin } from 'naive-ui'
import {
  BriefcaseOutline,
  CloseOutline,
  CreateOutline,
  KeyOutline,
  PauseCircleOutline,
  PeopleOutline,
  PersonAddOutline,
  PlayCircleOutline,
  RefreshOutline,
  ShieldCheckmarkOutline,
} from '@vicons/ionicons5'
import AppNav from '@/components/layout/AppNav.vue'
import { usersApi } from '@/api/users'
import type { ManagedSchoolUser, UserManagementResponse } from '@/types'

type FilterKey = 'ATIVOS' | 'TODOS' | 'INATIVOS'
type ModalKey = 'create' | 'edit' | 'password' | 'status' | 'credentials' | null

const management = ref<UserManagementResponse | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const filter = ref<FilterKey>('ATIVOS')
const modal = ref<ModalKey>(null)
const selected = ref<ManagedSchoolUser | null>(null)
const replacementUserId = ref('')
const passwordConfirmation = ref('')
const createdCredentials = ref<{ email: string; password: string } | null>(null)
const form = ref({
  name: '',
  email: '',
  roleName: 'CONSULTANT' as 'SCHOOL_ADMIN' | 'CONSULTANT',
  password: '',
})

const users = computed(() => management.value?.users ?? [])
const roles = computed(() => management.value?.roles ?? [])
const filteredUsers = computed(() => {
  if (filter.value === 'ATIVOS') return users.value.filter((user) => user.isActive)
  if (filter.value === 'INATIVOS') return users.value.filter((user) => !user.isActive)
  return users.value
})
const summary = computed(() => ({
  total: users.value.length,
  active: users.value.filter((user) => user.isActive).length,
  admins: users.value.filter((user) => user.isActive && user.role?.name === 'SCHOOL_ADMIN').length,
  workload: users.value.reduce((sum, user) => sum + user.workload.total, 0),
}))
const desiredStatus = computed(() => !selected.value?.isActive)
const needsReplacement = computed(() =>
  Boolean(selected.value && !desiredStatus.value && selected.value.workload.total > 0),
)
const replacementCandidates = computed(() =>
  users.value.filter((user) => user.isActive && user.id !== selected.value?.id),
)

onMounted(load)

async function load() {
  loading.value = true
  error.value = ''
  try {
    management.value = await usersApi.management()
  } catch (err) {
    error.value = apiError(err, 'Não foi possível carregar a equipe.')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  selected.value = null
  form.value = {
    name: '',
    email: '',
    roleName: 'CONSULTANT',
    password: generatePassword(),
  }
  passwordConfirmation.value = form.value.password
  error.value = ''
  modal.value = 'create'
}

function openEdit(user: ManagedSchoolUser) {
  selected.value = user
  form.value = {
    name: user.name,
    email: user.email,
    roleName: user.role?.name === 'SCHOOL_ADMIN' ? 'SCHOOL_ADMIN' : 'CONSULTANT',
    password: '',
  }
  error.value = ''
  modal.value = 'edit'
}

function openPassword(user: ManagedSchoolUser) {
  selected.value = user
  form.value.password = generatePassword()
  passwordConfirmation.value = form.value.password
  error.value = ''
  modal.value = 'password'
}

function openStatus(user: ManagedSchoolUser) {
  selected.value = user
  replacementUserId.value = ''
  error.value = ''
  modal.value = 'status'
}

function closeModal() {
  if (saving.value) return
  modal.value = null
  selected.value = null
  createdCredentials.value = null
  replacementUserId.value = ''
  passwordConfirmation.value = ''
  error.value = ''
}

async function saveUser() {
  if (!form.value.name.trim() || !form.value.email.trim()) {
    error.value = 'Informe nome e email.'
    return
  }
  if (modal.value === 'create') {
    if (form.value.password.length < 8) {
      error.value = 'A senha precisa ter pelo menos 8 caracteres.'
      return
    }
    if (form.value.password !== passwordConfirmation.value) {
      error.value = 'A confirmação da senha não confere.'
      return
    }
  }

  saving.value = true
  error.value = ''
  try {
    if (modal.value === 'create') {
      const credentials = { email: form.value.email.trim(), password: form.value.password }
      await usersApi.create({
        name: form.value.name.trim(),
        email: credentials.email,
        password: credentials.password,
        roleName: form.value.roleName,
      })
      await load()
      createdCredentials.value = credentials
      modal.value = 'credentials'
      notice.value = 'Funcionário criado com sucesso.'
    } else if (modal.value === 'edit' && selected.value) {
      await usersApi.update(selected.value.id, {
        name: form.value.name.trim(),
        email: form.value.email.trim(),
        roleName: form.value.roleName,
      })
      await load()
      modal.value = null
      notice.value = 'Dados do funcionário atualizados.'
    }
  } catch (err) {
    error.value = apiError(err, 'Não foi possível salvar o funcionário.')
  } finally {
    saving.value = false
  }
}

async function savePassword() {
  if (!selected.value) return
  if (form.value.password.length < 8) {
    error.value = 'A senha precisa ter pelo menos 8 caracteres.'
    return
  }
  if (form.value.password !== passwordConfirmation.value) {
    error.value = 'A confirmação da senha não confere.'
    return
  }

  saving.value = true
  error.value = ''
  try {
    await usersApi.resetPassword(selected.value.id, form.value.password)
    modal.value = null
    notice.value = `Senha de ${selected.value.name} redefinida. As sessões anteriores foram encerradas.`
  } catch (err) {
    error.value = apiError(err, 'Não foi possível redefinir a senha.')
  } finally {
    saving.value = false
  }
}

async function saveStatus() {
  if (!selected.value) return
  if (needsReplacement.value && !replacementUserId.value) {
    error.value = 'Escolha quem receberá as atribuições abertas.'
    return
  }

  saving.value = true
  error.value = ''
  try {
    await usersApi.updateStatus(selected.value.id, {
      isActive: desiredStatus.value,
      ...(replacementUserId.value ? { replacementUserId: replacementUserId.value } : {}),
    })
    const name = selected.value.name
    await load()
    modal.value = null
    notice.value = desiredStatus.value
      ? `${name} foi reativado.`
      : `${name} foi desativado e perdeu o acesso imediatamente.`
  } catch (err) {
    error.value = apiError(err, 'Não foi possível alterar o acesso.')
  } finally {
    saving.value = false
  }
}

function roleDescription(user: ManagedSchoolUser) {
  return roles.value.find((role) => role.name === user.role?.name)?.description ?? ''
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const random = new Uint32Array(10)
  crypto.getRandomValues(random)
  const body = Array.from(random, (value) => alphabet[value % alphabet.length]).join('')
  return `Edu!${body}7`
}

function regeneratePassword() {
  form.value.password = generatePassword()
  passwordConfirmation.value = form.value.password
}

async function copyCredentials() {
  if (!createdCredentials.value) return
  await navigator.clipboard.writeText(
    `Acesso EDU.IA\nEmail: ${createdCredentials.value.email}\nSenha temporária: ${createdCredentials.value.password}`,
  )
  notice.value = 'Credenciais copiadas. Envie por um canal seguro.'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value))
}

function apiError(err: unknown, fallback: string) {
  const candidate = err as { response?: { data?: { message?: string | string[] } } }
  const message = candidate.response?.data?.message
  return Array.isArray(message) ? message.join(' ') : message || fallback
}
</script>

<template>
  <div class="team-page">
    <AppNav />

    <main class="team-shell">
      <header class="team-header">
        <div>
          <span class="eyebrow">Gestão de acesso</span>
          <h1>Equipe</h1>
          <p>
            Cadastre quem trabalha na escola e garanta um responsável real para cada acompanhamento.
          </p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-secondary" :disabled="loading" @click="load">
            <NIcon :component="RefreshOutline" size="17" />
            Atualizar
          </button>
          <button type="button" class="btn-primary" @click="openCreate">
            <NIcon :component="PersonAddOutline" size="18" />
            Novo funcionário
          </button>
        </div>
      </header>

      <p v-if="error && !modal" class="banner banner--error">{{ error }}</p>
      <p v-if="notice" class="banner banner--success">
        {{ notice }}
        <button type="button" aria-label="Fechar aviso" @click="notice = ''">×</button>
      </p>

      <div v-if="loading" class="loading-state"><NSpin size="large" /></div>

      <template v-else-if="management">
        <section class="summary-grid" aria-label="Resumo da equipe">
          <article>
            <NIcon :component="PeopleOutline" size="21" />
            <span>Funcionários</span>
            <strong>{{ summary.total }}</strong>
          </article>
          <article>
            <NIcon :component="PlayCircleOutline" size="21" />
            <span>Ativos</span>
            <strong>{{ summary.active }}</strong>
          </article>
          <article>
            <NIcon :component="ShieldCheckmarkOutline" size="21" />
            <span>Administradores</span>
            <strong>{{ summary.admins }}</strong>
          </article>
          <article>
            <NIcon :component="BriefcaseOutline" size="21" />
            <span>Itens atribuídos</span>
            <strong>{{ summary.workload }}</strong>
          </article>
        </section>

        <section class="team-panel">
          <header class="panel-toolbar">
            <div class="filter-group" aria-label="Filtro de funcionários">
              <button
                v-for="item in ['ATIVOS', 'TODOS', 'INATIVOS'] as FilterKey[]"
                :key="item"
                type="button"
                :class="{ active: filter === item }"
                @click="filter = item"
              >
                {{ item === 'ATIVOS' ? 'Ativos' : item === 'INATIVOS' ? 'Inativos' : 'Todos' }}
              </button>
            </div>
            <span>{{ filteredUsers.length }} resultado(s)</span>
          </header>

          <div v-if="filteredUsers.length" class="member-list">
            <article v-for="user in filteredUsers" :key="user.id" class="member-card">
              <div class="member-identity">
                <div class="avatar">{{ user.name.charAt(0).toUpperCase() }}</div>
                <div>
                  <div class="name-row">
                    <h2>{{ user.name }}</h2>
                    <span v-if="user.isCurrentUser" class="you-chip">Você</span>
                    <span class="status-chip" :class="{ inactive: !user.isActive }">
                      {{ user.isActive ? 'Ativo' : 'Inativo' }}
                    </span>
                  </div>
                  <p>{{ user.email }}</p>
                  <small>Desde {{ formatDate(user.createdAt) }}</small>
                </div>
              </div>

              <div class="role-box">
                <span>{{ user.roleLabel }}</span>
                <p>{{ roleDescription(user) }}</p>
              </div>

              <div class="workload-grid" aria-label="Carga de trabalho">
                <span
                  ><strong>{{ user.workload.assignedLeads }}</strong> leads</span
                >
                <span
                  ><strong>{{ user.workload.pendingEnrollments }}</strong> matrículas</span
                >
                <span
                  ><strong>{{ user.workload.activeCases }}</strong> casos</span
                >
                <span
                  ><strong>{{ user.workload.openTasks }}</strong> tarefas</span
                >
              </div>

              <div class="member-actions">
                <button type="button" title="Editar" @click="openEdit(user)">
                  <NIcon :component="CreateOutline" size="17" />
                  Editar
                </button>
                <button
                  v-if="!user.isCurrentUser"
                  type="button"
                  title="Redefinir senha"
                  @click="openPassword(user)"
                >
                  <NIcon :component="KeyOutline" size="17" />
                  Senha
                </button>
                <button
                  v-if="!user.isCurrentUser"
                  type="button"
                  :class="user.isActive ? 'danger' : 'success'"
                  @click="openStatus(user)"
                >
                  <NIcon
                    :component="user.isActive ? PauseCircleOutline : PlayCircleOutline"
                    size="17"
                  />
                  {{ user.isActive ? 'Desativar' : 'Reativar' }}
                </button>
              </div>
            </article>
          </div>
          <div v-else class="empty-state">
            <NIcon :component="PeopleOutline" size="34" />
            <strong>Nenhum funcionário neste filtro.</strong>
          </div>
        </section>
      </template>
    </main>

    <div v-if="modal" class="modal-backdrop" @click.self="closeModal">
      <section
        class="modal-card"
        :aria-label="modal === 'create' ? 'Novo funcionário' : 'Gerenciar funcionário'"
      >
        <header>
          <div>
            <span>Equipe EDU.IA</span>
            <h2 v-if="modal === 'create'">Cadastrar funcionário</h2>
            <h2 v-else-if="modal === 'edit'">Editar funcionário</h2>
            <h2 v-else-if="modal === 'password'">Redefinir senha</h2>
            <h2 v-else-if="modal === 'status'">
              {{ desiredStatus ? 'Reativar acesso' : 'Desativar acesso' }}
            </h2>
            <h2 v-else>Credenciais criadas</h2>
          </div>
          <button type="button" class="icon-button" aria-label="Fechar" @click="closeModal">
            <NIcon :component="CloseOutline" size="20" />
          </button>
        </header>

        <p v-if="error" class="banner banner--error">{{ error }}</p>

        <form
          v-if="modal === 'create' || modal === 'edit'"
          class="modal-form"
          @submit.prevent="saveUser"
        >
          <label>
            <span>Nome completo</span>
            <input v-model="form.name" autocomplete="name" required minlength="2" />
          </label>
          <label>
            <span>Email de acesso</span>
            <input v-model="form.email" type="email" autocomplete="email" required />
          </label>
          <label>
            <span>Perfil de acesso</span>
            <select v-model="form.roleName" :disabled="Boolean(selected?.isCurrentUser)">
              <option v-for="role in roles" :key="role.name" :value="role.name">
                {{ role.label }} — {{ role.description }}
              </option>
            </select>
          </label>
          <template v-if="modal === 'create'">
            <label>
              <span>Senha temporária</span>
              <div class="password-row">
                <input
                  v-model="form.password"
                  type="text"
                  autocomplete="new-password"
                  required
                  minlength="8"
                />
                <button type="button" @click="regeneratePassword">
                  Gerar
                </button>
              </div>
            </label>
            <label>
              <span>Confirmar senha</span>
              <input
                v-model="passwordConfirmation"
                type="password"
                autocomplete="new-password"
                required
                minlength="8"
              />
            </label>
            <p class="form-help">
              O funcionário poderá entrar imediatamente. Compartilhe a senha por um canal seguro.
            </p>
          </template>
          <footer>
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              {{
                saving
                  ? 'Salvando...'
                  : modal === 'create'
                    ? 'Criar funcionário'
                    : 'Salvar alterações'
              }}
            </button>
          </footer>
        </form>

        <form v-else-if="modal === 'password'" class="modal-form" @submit.prevent="savePassword">
          <p class="modal-copy">
            Defina uma nova senha temporária para <strong>{{ selected?.name }}</strong
            >.
          </p>
          <label>
            <span>Nova senha</span>
            <div class="password-row">
              <input
                v-model="form.password"
                type="text"
                autocomplete="new-password"
                required
                minlength="8"
              />
              <button type="button" @click="regeneratePassword">
                Gerar
              </button>
            </div>
          </label>
          <label>
            <span>Confirmar senha</span>
            <input
              v-model="passwordConfirmation"
              type="password"
              autocomplete="new-password"
              required
              minlength="8"
            />
          </label>
          <p class="form-help">
            Ao salvar, todas as sessões anteriores desse funcionário serão encerradas.
          </p>
          <footer>
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? 'Salvando...' : 'Redefinir senha' }}
            </button>
          </footer>
        </form>

        <div v-else-if="modal === 'status'" class="status-content">
          <p class="modal-copy">
            <template v-if="desiredStatus">
              <strong>{{ selected?.name }}</strong> poderá entrar novamente e receber novas
              atribuições.
            </template>
            <template v-else>
              <strong>{{ selected?.name }}</strong> perderá o acesso imediatamente.
            </template>
          </p>
          <div v-if="needsReplacement" class="reassignment-box">
            <strong
              >{{ selected?.workload.total }} item(ns) de trabalho precisam ser
              redistribuídos.</strong
            >
            <label>
              <span>Novo responsável</span>
              <select v-model="replacementUserId" required>
                <option value="">Selecione um funcionário ativo</option>
                <option
                  v-for="candidate in replacementCandidates"
                  :key="candidate.id"
                  :value="candidate.id"
                >
                  {{ candidate.name }} — {{ candidate.roleLabel }}
                </option>
              </select>
            </label>
          </div>
          <footer>
            <button type="button" class="btn-secondary" @click="closeModal">Cancelar</button>
            <button
              type="button"
              :class="desiredStatus ? 'btn-primary' : 'btn-danger'"
              :disabled="saving"
              @click="saveStatus"
            >
              {{
                saving
                  ? 'Salvando...'
                  : desiredStatus
                    ? 'Reativar funcionário'
                    : 'Redistribuir e desativar'
              }}
            </button>
          </footer>
        </div>

        <div v-else-if="modal === 'credentials' && createdCredentials" class="credentials-content">
          <p class="modal-copy">O acesso foi criado. Estas credenciais só ficam visíveis agora.</p>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{{ createdCredentials.email }}</dd>
            </div>
            <div>
              <dt>Senha temporária</dt>
              <dd>{{ createdCredentials.password }}</dd>
            </div>
          </dl>
          <p class="form-help">
            Envie por um canal seguro e peça ao funcionário para guardar a senha.
          </p>
          <footer>
            <button type="button" class="btn-secondary" @click="copyCredentials">
              Copiar credenciais
            </button>
            <button type="button" class="btn-primary" @click="closeModal">Concluir</button>
          </footer>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.team-page {
  height: 100vh;
  height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--app-bg);
  color: var(--text);
  -webkit-overflow-scrolling: touch;
}

.team-shell {
  width: min(1320px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 56px;
}

.team-header,
.header-actions,
.summary-grid article,
.panel-toolbar,
.member-identity,
.name-row,
.member-actions,
.modal-card > header,
.password-row,
.banner,
footer {
  display: flex;
  align-items: center;
}

.team-header {
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

.eyebrow,
.modal-card > header span {
  color: var(--brand);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.team-header h1 {
  margin: 3px 0;
  font-size: 32px;
}

.team-header p,
.role-box p,
.member-identity p,
.modal-copy,
.form-help {
  color: var(--muted);
}

.team-header p,
.member-identity p,
.role-box p,
.modal-copy {
  margin: 0;
}

.header-actions,
.member-actions,
footer {
  gap: 10px;
}

button {
  font: inherit;
}

.btn-primary,
.btn-secondary,
.btn-danger,
.member-actions button,
.filter-group button,
.password-row button,
.icon-button {
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
}

.btn-primary {
  background: var(--brand);
  color: #fff;
}

.btn-secondary {
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
}

.btn-danger {
  background: var(--danger);
  color: #fff;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.banner {
  justify-content: space-between;
  gap: 16px;
  margin: 0 0 16px;
  border-radius: 9px;
  padding: 11px 13px;
  font-size: 13px;
  font-weight: 700;
}

.banner button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 20px;
}

.banner--error {
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  background: var(--danger-soft);
  color: var(--danger);
}

.banner--success {
  border: 1px solid color-mix(in srgb, var(--brand) 30%, transparent);
  background: var(--brand-soft);
  color: var(--brand);
}

.loading-state,
.empty-state {
  display: grid;
  min-height: 320px;
  place-items: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.summary-grid article {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-raised);
  padding: 16px;
  box-shadow: var(--shadow-xs);
}

.summary-grid .n-icon {
  grid-row: 1 / 3;
  color: var(--brand);
}

.summary-grid span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
}

.summary-grid strong {
  font-size: 25px;
}

.team-panel {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
}

.panel-toolbar {
  justify-content: space-between;
  gap: 16px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
}

.panel-toolbar > span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.filter-group {
  display: inline-flex;
  gap: 3px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-muted);
  padding: 3px;
}

.filter-group button {
  background: transparent;
  color: var(--muted-strong);
  padding: 7px 11px;
}

.filter-group button.active {
  background: var(--surface-raised);
  color: var(--brand);
  box-shadow: var(--shadow-xs);
}

.member-card {
  display: grid;
  grid-template-columns: minmax(230px, 1.2fr) minmax(210px, 0.8fr) minmax(290px, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 17px;
  border-bottom: 1px solid var(--border);
}

.member-card:last-child {
  border-bottom: 0;
}

.member-identity {
  gap: 12px;
  min-width: 0;
}

.avatar {
  width: 44px;
  height: 44px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 10px;
  background: var(--brand);
  color: #fff;
  font-size: 17px;
  font-weight: 900;
}

.member-identity h2 {
  margin: 0;
  font-size: 15px;
}

.member-identity p {
  margin-top: 3px;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-identity small {
  color: var(--muted);
  font-size: 10px;
}

.name-row {
  flex-wrap: wrap;
  gap: 6px;
}

.you-chip,
.status-chip,
.role-box > span {
  border-radius: 999px;
  font-size: 10px;
  font-weight: 900;
  padding: 4px 7px;
}

.you-chip,
.role-box > span {
  background: var(--brand-soft);
  color: var(--brand);
}

.status-chip {
  background: var(--success-soft, var(--brand-soft));
  color: var(--success, var(--brand));
}

.status-chip.inactive {
  background: var(--surface-muted);
  color: var(--muted);
}

.role-box p {
  margin-top: 7px;
  font-size: 11px;
  line-height: 1.35;
}

.workload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.workload-grid span {
  border-radius: 7px;
  background: var(--surface-muted);
  color: var(--muted);
  padding: 7px 9px;
  font-size: 10px;
}

.workload-grid strong {
  color: var(--text);
  font-size: 12px;
}

.member-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.member-actions button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--surface-muted);
  color: var(--muted-strong);
  padding: 8px 9px;
  font-size: 11px;
}

.member-actions button.danger {
  color: var(--danger);
}

.member-actions button.success {
  color: var(--brand);
}

.empty-state {
  align-content: center;
  gap: 8px;
  color: var(--muted);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 20px;
  background: rgba(4, 15, 12, 0.66);
  backdrop-filter: blur(5px);
}

.modal-card {
  width: min(620px, 100%);
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-raised);
  padding: 19px;
  box-shadow: var(--shadow-md);
}

.modal-card > header {
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 17px;
}

.modal-card h2 {
  margin: 3px 0 0;
  font-size: 21px;
}

.icon-button {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 38px;
  height: 38px;
  background: var(--surface-muted);
  color: var(--text);
}

.modal-form,
.status-content,
.credentials-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-form label,
.reassignment-box label {
  display: grid;
  gap: 6px;
}

.modal-form label > span,
.reassignment-box label > span {
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 800;
}

input,
select {
  width: 100%;
  min-height: 42px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  background: var(--input-bg);
  color: var(--text);
  padding: 0 11px;
}

input:focus,
select:focus {
  border-color: var(--brand);
  box-shadow: var(--focus-ring);
}

.password-row {
  gap: 8px;
}

.password-row button {
  min-height: 42px;
  background: var(--brand-soft);
  color: var(--brand);
  padding: 0 12px;
}

.form-help {
  margin: -3px 0 0;
  font-size: 11px;
  line-height: 1.4;
}

.reassignment-box {
  display: grid;
  gap: 13px;
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  border-radius: 9px;
  background: var(--warning-soft);
  color: var(--warning-strong, var(--text));
  padding: 13px;
}

.credentials-content dl {
  display: grid;
  gap: 9px;
  margin: 0;
}

.credentials-content dl > div {
  display: grid;
  gap: 4px;
  border-radius: 8px;
  background: var(--surface-muted);
  padding: 11px;
}

.credentials-content dt {
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.credentials-content dd {
  margin: 0;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 800;
  overflow-wrap: anywhere;
}

footer {
  justify-content: flex-end;
  margin-top: 5px;
}

@media (max-width: 1120px) {
  .member-card {
    grid-template-columns: minmax(240px, 1fr) minmax(220px, 0.8fr);
  }

  .member-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .team-shell {
    width: min(100% - 20px, 1320px);
    padding-top: 18px;
  }

  .team-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions button {
    flex: 1;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .member-card {
    grid-template-columns: 1fr;
  }

  .member-actions {
    grid-column: auto;
  }

  .panel-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-group {
    width: 100%;
  }

  .filter-group button {
    flex: 1;
  }
}

@media (max-width: 480px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .header-actions,
  footer,
  .password-row {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
