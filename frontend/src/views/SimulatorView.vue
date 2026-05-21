<script setup lang="ts">
import { onMounted } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent, NScrollbar, NEmpty, NAlert } from 'naive-ui'
import { useSimulatorStore } from '@/stores/simulator'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import LeadCard from '@/components/leads/LeadCard.vue'

const store = useSimulatorStore()

onMounted(() => {
  store.fetchLeads()
})
</script>

<template>
  <NLayout has-sider style="height: 100vh">

    <!-- Painel esquerdo: simulador WhatsApp -->
    <NLayoutSider
      :width="420"
      :native-scrollbar="false"
      style="border-right: 1px solid #e9edef; display: flex; flex-direction: column"
    >
      <div class="simulator-panel">
        <ChatHeader @reset="store.resetSession()" />
        <ChatMessages :messages="store.messages" :is-typing="store.isTyping" />
        <ChatInput :disabled="store.isSending" @send="store.sendMessage($event)" />
      </div>
    </NLayoutSider>

    <!-- Painel direito: leads qualificados -->
    <NLayoutContent style="background: #f5f7fa">
      <div class="leads-panel">
        <div class="leads-panel__header">
          <h2 class="leads-panel__title">Leads Qualificados pela IA</h2>
          <span v-if="store.hasLeads" class="leads-panel__count">
            {{ store.leadCount }} lead{{ store.leadCount > 1 ? 's' : '' }}
          </span>
        </div>

        <NAlert
          v-if="store.error"
          type="error"
          closable
          style="margin: 0 16px 12px"
          @close="store.error = null"
        >
          {{ store.error }}
        </NAlert>

        <NScrollbar style="flex: 1; min-height: 0">
          <div class="leads-list">
            <NEmpty
              v-if="!store.hasLeads"
              description="Converse com o simulador até a IA coletar todos os dados. O lead aparecerá aqui automaticamente."
              style="margin-top: 60px; padding: 0 24px"
            />
            <LeadCard v-for="lead in store.leads" :key="lead.id" :lead="lead" />
          </div>
        </NScrollbar>
      </div>
    </NLayoutContent>

  </NLayout>
</template>

<style scoped>
.simulator-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.leads-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.leads-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid #e9edef;
  background: #fff;
}

.leads-panel__title {
  font-size: 16px;
  font-weight: 700;
  color: #111b21;
  margin: 0;
}

.leads-panel__count {
  font-size: 12px;
  font-weight: 600;
  color: #25d366;
  background: #e8f5e9;
  padding: 2px 10px;
  border-radius: 12px;
}

.leads-list {
  padding: 16px;
}
</style>
