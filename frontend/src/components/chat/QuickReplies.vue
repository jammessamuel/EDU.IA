<script setup lang="ts">
defineProps<{ options: string[] }>()
defineEmits<{ select: [value: string] }>()
</script>

<template>
  <div class="qr-wrap">
    <button
      v-for="opt in options"
      :key="opt"
      class="qr-btn"
      @click="$emit('select', opt)"
    >
      {{ opt }}
    </button>
  </div>
</template>

<style scoped>
.qr-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 6px 12px 10px;
}

.qr-btn {
  padding: 7px 16px;
  border-radius: 20px;
  border: 1.5px solid #25d366;
  background: #fff;
  color: #075e54;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.qr-btn:hover {
  background: #25d366;
  color: #fff;
  border-color: #25d366;
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(37,211,102,0.25);
}

.qr-btn:active {
  transform: translateY(0);
}
</style>
