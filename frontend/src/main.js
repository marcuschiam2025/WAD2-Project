import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from '@core/router'
import { vEnter, vStagger } from './motion'
import { useThemeStore } from '@core/stores/theme'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router).directive('enter', vEnter).directive('stagger', vStagger)
useThemeStore(pinia)
app.mount('#app')
