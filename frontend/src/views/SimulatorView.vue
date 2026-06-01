<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NScrollbar, NAlert } from 'naive-ui'
import { useSimulatorStore } from '@/stores/simulator'
import AppNav from '@/components/layout/AppNav.vue'
import ChatHeader from '@/components/chat/ChatHeader.vue'
import ChatMessages from '@/components/chat/ChatMessages.vue'
import ChatInput from '@/components/chat/ChatInput.vue'
import QuickReplies from '@/components/chat/QuickReplies.vue'
import LeadCard from '@/components/leads/LeadCard.vue'
import LeadDetailModal from '@/components/leads/LeadDetailModal.vue'
import { useQuickReplies } from '@/composables/useQuickReplies'
import type { Lead } from '@/types'

const store  = useSimulatorStore()
const router = useRouter()

const quickReplies = useQuickReplies(
  computed(() => store.messages),
  computed(() => store.isTyping),
)

const detailLead = ref<Lead | null>(null)

onMounted(() => store.fetchLeads())
</script>

<template>
  <div class="page">
    <AppNav />

    <div class="workspace">
      <!-- ── Chat ── -->
      <section class="chat-col">
        <div class="chat-purpose">
          🧪 <strong>Modo Teste</strong> — simule a conversa para testar a IA antes de conectar ao WhatsApp real.
        </div>
        <ChatHeader @reset="store.resetSession()" />
        <ChatMessages :messages="store.messages" :is-typing="store.isTyping" />
        <QuickReplies
          v-if="quickReplies && !store.isSending"
          :options="quickReplies"
          @select="store.sendMessage($event)"
        />
        <ChatInput :disabled="store.isSending" @send="store.sendMessage($event)" />
      </section>

      <!-- ── Leads capturados ── -->
      <section class="leads-col">
        <div class="leads-header">
          <div class="leads-header__left">
            <h2 class="leads-header__title">Leads Capturados</h2>
            <span v-if="store.hasLeads" class="leads-header__badge">{{ store.leadCount }}</span>
          </div>
          <button v-if="store.hasLeads" class="btn-pipeline" @click="router.push('/kanban')">
            Ver no Pipeline →
          </button>
        </div>

        <NAlert v-if="store.error" type="error" closable style="margin: 0 16px 8px" @close="store.error = null">
          {{ store.error }}
        </NAlert>

        <NScrollbar class="leads-scroll">
          <div class="leads-list">
            <!-- Empty state -->
            <div v-if="!store.hasLeads" class="empty-state">
              <div class="empty-state__steps">
                <div class="step"><span class="step__num">1</span><span class="step__text">Digite uma mensagem no chat ao lado como se fosse o cliente</span></div>
                <div class="step"><span class="step__num">2</span><span class="step__text">A IA vai coletar os dados necessários do seu vertical</span></div>
                <div class="step"><span class="step__num">3</span><span class="step__text">O lead aparece aqui — clique para ver os detalhes e a conversa</span></div>
              </div>
            </div>

            <!-- Lead cards — clique abre o modal de detalhes -->
            <LeadCard
              v-for="lead in store.leads"
              :key="lead.id"
              :lead="lead"
              @open="detailLead = $event"
            />
          </div>
        </NScrollbar>
      </section>
    </div>

    <!-- Modal de detalhe do lead -->
    <LeadDetailModal :lead="detailLead" @close="detailLead = null" />
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

.workspace { flex: 1; display: flex; overflow: hidden; }

.chat-col {
  width: 460px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e9edef;
  background: #fff;
  overflow: hidden;
}

.chat-purpose {
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  padding: 8px 16px;
  font-size: 12px;
  color: #92400e;
  flex-shrink: 0;
}

.leads-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.leads-header {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e9edef;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.leads-header__left { display: flex; align-items: center; gap: 10px; }

.leads-header__title {
  font-size: 16px;
  font-weight: 700;
  color: #111b21;
  margin: 0;
}

.leads-header__badge {
  background: #075e54;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 20px;
}

.btn-pipeline {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #075e54;
  background: #e8f5e9;
  border: 1px solid #b2dfdb;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-pipeline:hover { background: #c8e6c9; }

.leads-scroll { flex: 1; }

.leads-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.empty-state { padding: 20px 8px; }

.empty-state__steps { display: flex; flex-direction: column; gap: 14px; }

.step { display: flex; align-items: flex-start; gap: 12px; }

.step__num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #075e54;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step__text {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  padding-top: 4px;
}
</style>
