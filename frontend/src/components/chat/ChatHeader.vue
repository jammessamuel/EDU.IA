<script setup lang="ts">
import { NAvatar, NButton } from 'naive-ui'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'
const emit = defineEmits<{ reset: [] }>()

const authStore = useAuthStore()
const router = useRouter()

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="chat-header">
    <NAvatar round size="medium" color="rgba(255,255,255,0.2)" style="color: #fff; font-weight: 700">
      E
    </NAvatar>

    <div class="chat-header__info">
      <span class="chat-header__name">IA Atendente</span>
      <span class="chat-header__status">
        <span class="online-dot"></span> online
      </span>
    </div>

    <NButton
      size="small"
      ghost
      style="color: #fff; border-color: rgba(255,255,255,0.5); margin-right: 8px"
      @click="emit('reset')"
    >
      Reiniciar
    </NButton>

    <NButton
      size="small"
      ghost
      style="color: #fff; border-color: rgba(255,255,255,0.5); margin-right: 8px"
      @click="router.push('/kanban')"
    >
      Pipeline →
    </NButton>

    <NButton
      size="small"
      ghost
      style="color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.3)"
      @click="handleLogout"
    >
      Sair
    </NButton>
  </div>
</template>

<style scoped>
.chat-header {
  background: #075e54;
  color: #fff;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.chat-header__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.chat-header__name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.2;
}

.chat-header__status {
  font-size: 12px;
  opacity: 0.85;
  display: flex;
  align-items: center;
  gap: 4px;
}

.online-dot {
  width: 7px;
  height: 7px;
  background: #25d366;
  border-radius: 50%;
  display: inline-block;
}
</style>
