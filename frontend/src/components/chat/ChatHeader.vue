<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'

withDefaults(defineProps<{ name?: string; avatar?: string }>(), {
  name: 'IA Atendente',
  avatar: 'E',
})

defineEmits<{ reset: [] }>()
</script>

<template>
  <div class="chat-header">
    <div class="chat-header__avatar">{{ avatar }}</div>
    <div class="chat-header__info">
      <span class="chat-header__name">{{ name }}</span>
      <span class="chat-header__status"><span class="dot"></span> online agora</span>
    </div>
    <button class="chat-header__reset" @click="$emit('reset')" title="Reiniciar conversa">
      <NIcon :component="RefreshOutline" size="17" />
    </button>
  </div>
</template>

<style scoped>
.chat-header {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--brand) 92%, #0f766e), var(--brand-strong));
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.chat-header__avatar {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);
}

.chat-header__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chat-header__name {
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  line-height: 1.2;
}

.chat-header__status {
  font-size: 12px;
  color: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 7px;
  height: 7px;
  background: #25d366;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.18);
}

.chat-header__reset {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.16);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}

.chat-header__reset:hover {
  background: rgba(255,255,255,0.22);
}
</style>
