<script setup lang="ts">
defineEmits<{ reset: [] }>()
</script>

<template>
  <div class="chat-header">
    <div class="chat-header__avatar">E</div>
    <div class="chat-header__info">
      <span class="chat-header__name">IA Atendente</span>
      <span class="chat-header__status"><span class="dot"></span> online agora</span>
    </div>
    <button class="chat-header__reset" @click="$emit('reset')" title="Reiniciar conversa">
      ↺
    </button>
  </div>
</template>

<style scoped>
.chat-header {
  background: #075e54;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}

.chat-header__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  flex-shrink: 0;
}

.chat-header__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chat-header__name {
  font-size: 15px;
  font-weight: 600;
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
}

.chat-header__reset {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  border: none;
  color: #fff;
  font-size: 18px;
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
