import { createApp } from 'vue'
import './style.css'
import 'primeicons/primeicons.css'
import App from './App.vue'
import {initRouter} from './router'
import i18n from './lib/i18n'
import { vueKeycloak } from '@josempgon/vue-keycloak'

const app = createApp(App)

app.use(vueKeycloak, {
          config: {
              url: 'http://localhost:8080/auth',
    realm: 'agora',
    clientId: 'agora-client',
  }
})

app.use(initRouter())
app.use(i18n)
app.mount('#app')
