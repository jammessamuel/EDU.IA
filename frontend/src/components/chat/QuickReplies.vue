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
  gap: 8px;
  padding: 8px 14px 12px;
  background: rgba(248, 250, 249, 0.94);
  border-top: 1px solid var(--border);
}

.qr-btn {
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--brand) 28%, white);
  background: #fff;
  color: var(--brand);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  white-space: nowrap;
  box-shadow: var(--shadow-xs);
}

.qr-btn:hover {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(7, 94, 84, 0.16);
}

.qr-btn:active {
  transform: translateY(0);
}
</style>
