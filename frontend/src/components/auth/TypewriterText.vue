<!--
  TypewriterText.vue — efeito de "digitação" (porta do componente React p/ Vue).
  Digita o texto char a char; se for uma lista (ou loop=true), apaga e passa
  para o próximo. Uso na tela de login pra simular a IA respondendo em tempo real.
-->
<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useAccessibility } from '@/composables/useAccessibility'

const props = withDefaults(
  defineProps<{
    text: string | string[]
    speed?: number
    cursor?: string
    loop?: boolean
    deleteSpeed?: number
    delay?: number
  }>(),
  { speed: 55, cursor: '▍', loop: true, deleteSpeed: 28, delay: 1800 },
)

const display = ref('')
const { effectiveReduceMotion } = useAccessibility()
let timer: ReturnType<typeof setTimeout> | undefined

function asArray(): string[] {
  return Array.isArray(props.text) ? props.text : [props.text]
}

const fullText = computed(() => asArray()[0] ?? '')

function start() {
  clearTimeout(timer)
  display.value = ''
  const frases = asArray()
  if (effectiveReduceMotion.value) {
    display.value = frases[0] ?? ''
    return
  }
  let fi = 0 // índice da frase
  let ci = 0 // índice do caractere
  let apagando = false

  const tick = () => {
    const atual = frases[fi] ?? ''

    if (!apagando) {
      ci++
      display.value = atual.slice(0, ci)
      if (ci >= atual.length) {
        // terminou de escrever: para (frase única sem loop) ou aguarda e apaga
        if (!props.loop && frases.length === 1) return
        timer = setTimeout(() => {
          apagando = true
          tick()
        }, props.delay)
        return
      }
      timer = setTimeout(tick, props.speed)
    } else {
      ci--
      display.value = atual.slice(0, Math.max(0, ci))
      if (ci <= 0) {
        apagando = false
        fi = (fi + 1) % frases.length
        timer = setTimeout(tick, props.speed)
        return
      }
      timer = setTimeout(tick, props.deleteSpeed)
    }
  }

  tick()
}

onMounted(start)
watch(() => props.text, start)
watch(effectiveReduceMotion, start)
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <span class="tw" :aria-label="fullText">
    <span aria-hidden="true">{{ display }}<span class="tw__cursor">{{ cursor }}</span></span>
    <span class="sr-only">{{ fullText }}</span>
  </span>
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

.tw__cursor {
  display: inline-block;
  margin-left: 1px;
  font-weight: 400;
  opacity: 0.9;
  animation: tw-blink 1.05s steps(1) infinite;
}
@keyframes tw-blink {
  50% {
    opacity: 0;
  }
}
</style>
