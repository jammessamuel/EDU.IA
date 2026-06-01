<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'

const router   = useRouter()
const route    = useRoute()
const auth     = useAuthStore()
const ws       = useWorkspaceStore()

onMounted(() => ws.load())

const links = [
  { to: '/whatsapp',  label: 'WhatsApp'     },
  { to: '/',          label: 'Simulador'    },
  { to: '/dashboard', label: 'Dashboard'    },
  { to: '/kanban',    label: 'Pipeline'     },
  { to: '/settings',  label: 'Configurações'},
]

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="topbar" :style="{ '--brand': ws.brandColor }">
    <div class="topbar__brand">
      <div class="topbar__brand-icon">
        <span v-if="ws.verticalIcon !== '🤖'">{{ ws.verticalIcon }}</span>
        <span v-else style="font-weight:900;font-size:13px">S</span>
      </div>
      <span class="topbar__brand-name">SDR<em>.IA</em></span>
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
      <div v-if="ws.vertical" class="topbar__vertical-badge">
        {{ ws.vertical.icon }} {{ ws.vertical.name }}
      </div>
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
  padding: 0 20px;
  gap: 0;
  flex-shrink: 0;
  z-index: 10;
}

.topbar__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 24px;
}

.topbar__brand-icon {
  width: 32px;
  height: 32px;
  background: var(--brand, #075e54);
  color: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  transition: background 0.3s;
}

.topbar__brand-name {
  font-size: 18px;
  font-weight: 900;
  color: #111b21;
  letter-spacing: -0.5px;
}

.topbar__brand-name em {
  font-style: normal;
  color: var(--brand, #075e54);
  transition: color 0.3s;
}

.topbar__nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.topbar__link {
  padding: 6px 13px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.topbar__link:hover {
  background: #f5f7fa;
  color: #111;
}

.topbar__link--active {
  background: color-mix(in srgb, var(--brand, #075e54) 12%, white);
  color: var(--brand, #075e54);
  font-weight: 600;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar__vertical-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand, #075e54);
  background: color-mix(in srgb, var(--brand, #075e54) 10%, white);
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--brand, #075e54) 25%, white);
  white-space: nowrap;
}

.topbar__user {
  display: flex;
  align-items: center;
  gap: 7px;
}

.topbar__avatar {
  width: 30px;
  height: 30px;
  background: var(--brand, #075e54);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  transition: background 0.3s;
}

.topbar__username {
  font-size: 13px;
  font-weight: 500;
  color: #444;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__logout {
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #888;
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
