<script setup lang="ts">
import { NConfigProvider, NGlobalStyle } from 'naive-ui'
import { RouterView } from 'vue-router'

const themeOverrides = {
  common: {
    primaryColor: '#25D366',
    primaryColorHover: '#128C7E',
    primaryColorPressed: '#075E54',
    primaryColorSuppl: '#25D366',
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
