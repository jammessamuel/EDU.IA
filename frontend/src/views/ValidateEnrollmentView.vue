<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { enrollmentApi } from '@/api/enrollments'
import type { Enrollment } from '@/types'

const route = useRoute()
const enrollment = ref<Enrollment | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const authCode = computed(() => String(route.params.authCode || '').toUpperCase())

onMounted(async () => {
  try {
    const res = await enrollmentApi.verify(authCode.value)
    enrollment.value = res.enrollment
  } catch {
    error.value = 'Comprovante não encontrado ou código inválido.'
  } finally {
    isLoading.value = false
  }
})

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <main class="verify-page">
    <section class="verify-panel">
      <div class="brand-mark">SDR<span>.IA</span></div>

      <div v-if="isLoading" class="state">Validando comprovante...</div>

      <div v-else-if="error" class="state state--error">
        <strong>Código inválido</strong>
        <span>{{ error }}</span>
      </div>

      <template v-else-if="enrollment">
        <div class="success-mark">✓</div>
        <h1>Comprovante autêntico</h1>
        <p>Este código pertence a uma matrícula registrada no sistema.</p>

        <dl class="verify-data">
          <div>
            <dt>Nº de matrícula</dt>
            <dd>{{ enrollment.number }}</dd>
          </div>
          <div>
            <dt>Aluno</dt>
            <dd>{{ enrollment.studentName }}</dd>
          </div>
          <div>
            <dt>Instituição</dt>
            <dd>{{ enrollment.schoolName || 'Instituição' }}</dd>
          </div>
          <div>
            <dt>Curso</dt>
            <dd>{{ enrollment.course || '-' }}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>{{ enrollment.status }}</dd>
          </div>
          <div>
            <dt>Confirmada em</dt>
            <dd>{{ formatDate(enrollment.confirmedAt || enrollment.createdAt) }}</dd>
          </div>
          <div>
            <dt>Código</dt>
            <dd>{{ enrollment.authCode }}</dd>
          </div>
        </dl>
      </template>
    </section>
  </main>
</template>

<style scoped>
.verify-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background:
    linear-gradient(135deg, rgba(7, 94, 84, 0.08), transparent 36%),
    var(--app-bg);
  padding: 24px;
}

.verify-panel {
  width: min(560px, 100%);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 28px;
  box-shadow: var(--shadow-md);
}

.brand-mark {
  color: var(--text);
  font-size: 18px;
  font-weight: 900;
  margin-bottom: 24px;
}

.brand-mark span {
  color: var(--brand);
}

.success-mark {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 26px;
  font-weight: 900;
  margin-bottom: 14px;
}

h1 {
  margin: 0;
  color: var(--text);
  font-size: 28px;
}

p {
  color: var(--muted);
  margin: 8px 0 22px;
}

.verify-data {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.verify-data div {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface-soft);
}

dt {
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 4px;
}

dd {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.state {
  color: #374151;
  font-size: 15px;
}

.state--error {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #991b1b;
}

@media (max-width: 620px) {
  .verify-data {
    grid-template-columns: 1fr;
  }
}
</style>
