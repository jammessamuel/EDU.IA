<script setup lang="ts">
import { NConfigProvider, NGlobalStyle } from 'naive-ui'
import { RouterView } from 'vue-router'

const themeOverrides = {
  common: {
    primaryColor: '#25D366',
    primaryColorHover: '#128C7E',
    primaryColorPressed: '#075E54',
    primaryColorSuppl: '#25D366',
    borderRadius: '8px',
    borderColor: '#DDE7E4',
    textColorBase: '#10201C',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
  },
  Input: {
    borderHover: '1px solid #128C7E',
    borderFocus: '1px solid #128C7E',
    boxShadowFocus: '0 0 0 3px rgba(37, 211, 102, 0.18)',
  },
  Button: {
    borderRadiusMedium: '8px',
    fontWeight: '700',
  },
}
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <RouterView />
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
</style>
