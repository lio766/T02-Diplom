import axios from 'axios'
import { getToken, useKeycloak } from '@josempgon/vue-keycloak';

// Create an instance of axios with the base URL read from the environment
const baseURL = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({ baseURL })

async function waitForKeycloak() {
  const { isPending } = useKeycloak()

  return new Promise((resolve) => {
    const check = () => {
      if (!isPending.value) {
        resolve()
      } else {
        setTimeout(check, 50)
      }
    }
    check()
  })
}


// Request interceptor for API calls
api.interceptors.request.use(
    async config => {
        await waitForKeycloak();
        const token = await getToken();
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
    },
    error => {
        Promise.reject(error)
    },
)

export default api



