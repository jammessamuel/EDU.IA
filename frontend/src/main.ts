import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// De propósito eu NÃO registro o naive-ui globalmente (app.use(naive)):
// isso puxava a biblioteca INTEIRA pro bundle de entrada (~1.4 MB). Cada
// componente já é importado localmente onde é usado (tree-shaking), então
// agora o naive-ui entra só nos chunks das telas que realmente o usam.
const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
