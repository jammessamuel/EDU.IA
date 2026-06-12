<script setup lang="ts">
import { computed } from 'vue'
import { darkTheme, NConfigProvider, NGlobalStyle } from 'naive-ui'
import { RouterView } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import AccessibilityMenu from '@/components/accessibility/AccessibilityMenu.vue'

const { isDark } = useTheme()

const themeOverrides = computed(() => ({
  common: {
    primaryColor: isDark.value ? '#34D399' : '#25D366',
    primaryColorHover: isDark.value ? '#4ADE80' : '#128C7E',
    primaryColorPressed: isDark.value ? '#0F766E' : '#075E54',
    primaryColorSuppl: isDark.value ? '#34D399' : '#25D366',
    borderRadius: '8px',
    borderColor: isDark.value ? '#28443D' : '#DDE7E4',
    textColorBase: isDark.value ? '#ECFDF7' : '#10201C',
    bodyColor: isDark.value ? '#08110F' : '#EEF3F1',
    cardColor: isDark.value ? '#101D1A' : '#FFFFFF',
    modalColor: isDark.value ? '#101D1A' : '#FFFFFF',
    popoverColor: isDark.value ? '#101D1A' : '#FFFFFF',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  },
  Input: {
    borderHover: `1px solid ${isDark.value ? '#34D399' : '#128C7E'}`,
    borderFocus: `1px solid ${isDark.value ? '#34D399' : '#128C7E'}`,
    boxShadowFocus: isDark.value
      ? '0 0 0 3px rgba(52, 211, 153, 0.2)'
      : '0 0 0 3px rgba(37, 211, 102, 0.18)',
  },
  Button: {
    borderRadiusMedium: '8px',
    fontWeight: '700',
  },
}))
</script>

<template>
  <NConfigProvider :theme="isDark ? darkTheme : null" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <a class="skip-link" href="#main-content">Pular para o conteúdo principal</a>
    <div id="main-content" class="app-frame" tabindex="-1">
      <RouterView />
    </div>
    <AccessibilityMenu />
  </NConfigProvider>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.app-frame {
  height: 100%;
  min-height: 0;
}

.app-frame:focus {
  outline: none;
}
</style>
