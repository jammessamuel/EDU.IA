<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NIcon } from 'naive-ui'
import {
  BarChartOutline,
  GitNetworkOutline,
  LogOutOutline,
  LogoWhatsapp,
  PlayCircleOutline,
  SchoolOutline,
  SettingsOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'

const router   = useRouter()
const route    = useRoute()
const auth     = useAuthStore()
const ws       = useWorkspaceStore()

onMounted(() => ws.load())

const links = [
  { to: '/whatsapp',  label: 'WhatsApp', icon: LogoWhatsapp },
  { to: '/',          label: 'Simulador', icon: PlayCircleOutline },
  { to: '/enrollments', label: 'Matrículas', icon: SchoolOutline },
  { to: '/dashboard', label: 'Dashboard', icon: BarChartOutline },
  { to: '/kanban',    label: 'Pipeline', icon: GitNetworkOutline },
  { to: '/settings',  label: 'Configurações', icon: SettingsOutline },
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
        <span v-else>S</span>
      </div>
      <div class="topbar__brand-copy">
        <span class="topbar__brand-name">SDR<em>.IA</em></span>
        <small>atendimento e matrícula</small>
      </div>
    </div>

    <nav class="topbar__nav">
      <button
        v-for="link in links"
        :key="link.to"
        class="topbar__link"
        :class="{ 'topbar__link--active': route.path === link.to }"
        @click="router.push(link.to)"
      >
        <NIcon :component="link.icon" size="16" />
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
      <button class="topbar__logout" title="Sair" @click="logout">
        <NIcon :component="LogOutOutline" size="15" />
        <span>Sair</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 64px;
  background: rgba(255, 255, 255, 0.86);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  padding: 0 22px;
  gap: 0;
  flex-shrink: 0;
  z-index: 10;
  box-shadow: var(--shadow-xs);
}

.topbar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-right: 28px;
  min-width: 178px;
}

.topbar__brand-icon {
  width: 38px;
  height: 38px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--brand, #075e54) 72%, #25d366), var(--brand, #075e54));
  color: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 900;
  flex-shrink: 0;
  transition: background 0.3s;
  box-shadow: 0 10px 26px color-mix(in srgb, var(--brand, #075e54) 28%, transparent);
}

.topbar__brand-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.topbar__brand-name {
  font-size: 18px;
  font-weight: 900;
  color: var(--text);
  line-height: 1;
}

.topbar__brand-name em {
  font-style: normal;
  color: var(--brand, #075e54);
  transition: color 0.3s;
}

.topbar__brand-copy small {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.topbar__nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.topbar__link {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted-strong);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}

.topbar__link:hover {
  background: var(--surface-muted);
  color: var(--text);
}

.topbar__link--active {
  background: color-mix(in srgb, var(--brand, #075e54) 11%, white);
  color: var(--brand, #075e54);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--brand, #075e54) 16%, white);
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar__vertical-badge {
  font-size: 12px;
  font-weight: 800;
  color: var(--brand, #075e54);
  background: color-mix(in srgb, var(--brand, #075e54) 10%, white);
  padding: 6px 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--brand, #075e54) 25%, white);
  white-space: nowrap;
}

.topbar__user {
  display: flex;
  align-items: center;
  gap: 7px;
}

.topbar__avatar {
  width: 32px;
  height: 32px;
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
  font-weight: 700;
  color: var(--text-soft);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__logout {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
  background: transparent;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.topbar__logout:hover {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 35%, white);
}

@media (max-width: 1120px) {
  .topbar {
    padding: 0 14px;
  }

  .topbar__brand {
    min-width: auto;
    margin-right: 12px;
  }

  .topbar__brand-copy small,
  .topbar__username,
  .topbar__vertical-badge {
    display: none;
  }
}

@media (max-width: 820px) {
  .topbar__link {
    padding: 8px;
  }

  .topbar__link {
    font-size: 0;
  }

  .topbar__link :deep(.n-icon) {
    font-size: 18px;
  }

  .topbar__logout span {
    display: none;
  }
}
</style>
