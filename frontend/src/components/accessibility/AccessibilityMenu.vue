<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAccessibility } from '@/composables/useAccessibility'
import type { AccessibilityProfile, ColorBlindMode } from '@/types'

const { profile, loading, updateProfile, resetProfile, syncFromServer } = useAccessibility()
const open = ref(false)

const colorBlindOptions: { value: ColorBlindMode; label: string }[] = [
  { value: 'none', label: 'Sem ajuste' },
  { value: 'protanopia', label: 'Protanopia' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'tritanopia', label: 'Tritanopia' },
]

const fontPercent = computed(() => Math.round(profile.value.fontScale * 100))

function patch(input: Partial<AccessibilityProfile>) {
  updateProfile(input)
}

function checkboxValue(event: Event) {
  return (event.target as HTMLInputElement).checked
}

function selectColorBlindMode(event: Event) {
  patch({ colorBlindMode: (event.target as HTMLSelectElement).value as ColorBlindMode })
}

function selectFontScale(event: Event) {
  patch({ fontScale: Number((event.target as HTMLInputElement).value) })
}

function onShortcut(event: KeyboardEvent) {
  if (event.altKey && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    open.value = !open.value
  }
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  syncFromServer()
  window.addEventListener('keydown', onShortcut)
})

onUnmounted(() => window.removeEventListener('keydown', onShortcut))
</script>

<template>
  <div class="a11y-menu">
    <button
      type="button"
      class="a11y-menu__trigger"
      aria-controls="accessibility-panel"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span aria-hidden="true">A11Y</span>
      <span class="sr-only">Abrir preferências de acessibilidade</span>
    </button>

    <section
      v-if="open"
      id="accessibility-panel"
      class="a11y-menu__panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="accessibility-title"
    >
      <div class="a11y-menu__head">
        <div>
          <h2 id="accessibility-title">Acessibilidade</h2>
          <p>Atalho: Alt+A</p>
        </div>
        <button type="button" class="a11y-menu__close" @click="open = false">
          Fechar
        </button>
      </div>

      <label class="a11y-toggle">
        <input
          type="checkbox"
          :checked="profile.screenReader"
          @change="patch({ screenReader: checkboxValue($event) })"
        />
        <span>Uso leitor de tela</span>
      </label>

      <label class="a11y-toggle">
        <input
          type="checkbox"
          :checked="profile.highContrast"
          @change="patch({ highContrast: checkboxValue($event) })"
        />
        <span>Alto contraste</span>
      </label>

      <label class="a11y-toggle">
        <input
          type="checkbox"
          :checked="profile.reduceMotion"
          @change="patch({ reduceMotion: checkboxValue($event) })"
        />
        <span>Reduzir animações</span>
      </label>

      <label class="a11y-toggle">
        <input
          type="checkbox"
          :checked="profile.simpleLanguage"
          @change="patch({ simpleLanguage: checkboxValue($event) })"
        />
        <span>Linguagem simples</span>
      </label>

      <label class="a11y-field">
        <span>Modo daltonismo</span>
        <select
          :value="profile.colorBlindMode"
          @change="selectColorBlindMode"
        >
          <option v-for="option in colorBlindOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="a11y-field">
        <span>Escala da fonte: {{ fontPercent }}%</span>
        <input
          type="range"
          min="0.9"
          max="1.35"
          step="0.05"
          :value="profile.fontScale"
          @input="selectFontScale"
        />
      </label>

      <button type="button" class="a11y-menu__reset" :disabled="loading" @click="resetProfile">
        Restaurar padrão
      </button>
    </section>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.a11y-menu {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 80;
  font-family: inherit;
}

.a11y-menu__trigger {
  width: 48px;
  height: 48px;
  border: 1px solid color-mix(in srgb, var(--brand) 28%, var(--border));
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--brand);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.a11y-menu__panel {
  position: absolute;
  right: 0;
  bottom: 58px;
  width: min(340px, calc(100vw - 28px));
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-raised);
  color: var(--text);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(18px);
}

.a11y-menu__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.a11y-menu__head h2 {
  font-size: 18px;
  line-height: 1.15;
}

.a11y-menu__head p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
}

.a11y-menu__close,
.a11y-menu__reset {
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--brand);
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.a11y-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.a11y-toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--brand);
}

.a11y-field {
  display: grid;
  gap: 6px;
  color: var(--text);
  font-size: 13px;
  font-weight: 800;
}

.a11y-field select,
.a11y-field input[type='range'] {
  width: 100%;
}

.a11y-field select {
  min-height: 40px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text);
}
</style>
