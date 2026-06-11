<template>
  <div class="msg-row">
    <div class="bubble bubble--ai typing">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  </div>
</template>

<style scoped>
.msg-row {
  display: flex;
  justify-content: flex-start;
  padding: 2px 14px;
}

.bubble {
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(221, 231, 228, 0.86);
  border-radius: 16px 16px 16px 5px;
  box-shadow: var(--shadow-xs);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 7px;
  height: 7px;
  background: var(--muted);
  border-radius: 50%;
  animation: bounce 1.2s infinite ease-in-out;
}

.dot:nth-child(2) { animation-delay: 0.15s; }
.dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}
</style>
