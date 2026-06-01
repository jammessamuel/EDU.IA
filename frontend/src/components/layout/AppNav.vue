<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const links = [
  { to: '/whatsapp',  label: '💬 WhatsApp' },
  { to: '/',          label: 'Simulador'   },
  { to: '/dashboard', label: 'Dashboard'   },
  { to: '/kanban',    label: 'Pipeline'    },
  { to: '/settings',  label: 'Configurações' },
]

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="topbar">
    <div class="topbar__brand">
      <div class="topbar__brand-icon">E</div>
      <span class="topbar__brand-name">EDU<em>.IA</em></span>
    </div>

    <nav class="topbar__nav">
      <button
        v-for="link in links"
        :key="link.to"
        class="topbar__link"
        :class="{ 'topbar__link--active': route.path === link.to }"
        @click="router.push(link.to)"
      >
        {{ link.label }}
      </button>
    </nav>

    <div class="topbar__right">
      <div class="topbar__user">
        <div class="topbar__avatar">{{ auth.user?.name?.charAt(0).toUpperCase() }}</div>
        <span class="topbar__username">{{ auth.user?.name }}</span>
      </div>
      <button class="topbar__logout" @click="logout">Sair</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e9edef;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 0;
  flex-shrink: 0;
  z-index: 10;
}

.topbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 32px;
  text-decoration: none;
}

.topbar__brand-icon {
  width: 32px;
  height: 32px;
  background: #075e54;
  color: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 16px;
  flex-shrink: 0;
}

.topbar__brand-name {
  font-size: 18px;
  font-weight: 800;
  color: #111b21;
  letter-spacing: -0.5px;
}

.topbar__brand-name em {
  font-style: normal;
  color: #075e54;
}

.topbar__nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.topbar__link {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #667;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.topbar__link:hover {
  background: #f5f7fa;
  color: #111b21;
}

.topbar__link--active {
  background: #e8f5e9;
  color: #075e54;
  font-weight: 600;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar__user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar__avatar {
  width: 32px;
  height: 32px;
  background: #128c7e;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.topbar__username {
  font-size: 13px;
  font-weight: 500;
  color: #444;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__logout {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  background: transparent;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.15s;
}

.topbar__logout:hover {
  background: #fff0f0;
  color: #d03050;
  border-color: #d03050;
}
</style>
