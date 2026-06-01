<script setup lang="ts">
import { onMounted } from 'vue'
import { NScrollbar, NEmpty, NAlert } from 'naive-ui'
import { useSimulatorStore } from '@/stores/simulator'
import AppNav from '@/components/layout/AppNav.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import LeadCard from '@/components/leads/LeadCard.vue'

const store = useSimulatorStore()
onMounted(() => store.fetchLeads())
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="workspace">
      <!-- Coluna do chat -->
      <section class="chat-col">
        <ChatHeader @reset="store.resetSession()" />
        <ChatMessages :messages="store.messages" :is-typing="store.isTyping" />
        <ChatInput :disabled="store.isSending" @send="store.sendMessage($event)" />
      </section>

      <!-- Coluna dos leads -->
      <section class="leads-col">
        <div class="leads-col__header">
          <div class="leads-col__title-row">
            <h2 class="leads-col__title">Leads Capturados</h2>
            <span v-if="store.hasLeads" class="leads-col__badge">
              {{ store.leadCount }}
            </span>
          </div>
          <p class="leads-col__sub">Leads qualificados automaticamente pela IA</p>
        </div>

        <NAlert
          v-if="store.error"
          type="error"
          closable
          style="margin: 0 20px 8px"
          @close="store.error = null"
        >
          {{ store.error }}
        </NAlert>

        <NScrollbar class="leads-col__scroll">
          <div class="leads-col__list">
            <div v-if="!store.hasLeads" class="leads-empty">
              <div class="leads-empty__icon">💬</div>
              <p class="leads-empty__title">Nenhum lead ainda</p>
              <p class="leads-empty__desc">
                Converse com o simulador ao lado. Quando a IA coletar curso, turno e nome, o lead aparece aqui automaticamente.
              </p>
            </div>
            <LeadCard v-for="lead in store.leads" :key="lead.id" :lead="lead" />
          </div>
        </NScrollbar>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f5f7fa;
}

.workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── Chat column ── */
.chat-col {
  width: 460px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e9edef;
  background: #fff;
  overflow: hidden;
}

/* ── Leads column ── */
.leads-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.leads-col__header {
  padding: 20px 24px 12px;
  background: #fff;
  border-bottom: 1px solid #e9edef;
  flex-shrink: 0;
}

.leads-col__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.leads-col__title {
  font-size: 17px;
  font-weight: 700;
  color: #111b21;
  margin: 0;
}

.leads-col__badge {
  background: #075e54;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
  line-height: 1.6;
}

.leads-col__sub {
  margin: 3px 0 0;
  font-size: 13px;
  color: #888;
}

.leads-col__scroll {
  flex: 1;
}

.leads-col__list {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Empty state ── */
.leads-empty {
  margin-top: 40px;
  text-align: center;
  padding: 0 32px;
}

.leads-empty__icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.leads-empty__title {
  font-size: 16px;
  font-weight: 600;
  color: #444;
  margin: 0 0 8px;
}

.leads-empty__desc {
  font-size: 13px;
  color: #888;
  line-height: 1.6;
  margin: 0;
  max-width: 320px;
  margin: 0 auto;
}
</style>
