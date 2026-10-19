import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from '@core/router'
import { vEnter, vStagger } from './motion'

createApp(App).use(createPinia()).use(router).directive('enter', vEnter).directive('stagger', vStagger).mount('#app')
