import { createRouter, createWebHistory } from 'vue-router'
import { useKeycloak } from '@josempgon/vue-keycloak';

const { isPending, isAuthenticated, error, username, userId, keycloak, roles, hasRoles } = useKeycloak();
// Home and Booking components removed
import RoomCalendar from '../views/RoomCalendar.vue'
import Wiki from '../views/Wiki.vue'
import Admin from '../views/Admin.vue'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const routes = [
    {
        path: '/',
        redirect: '/calendar'
    },
    {
        path: '/calendar', name: 'calendar', component: RoomCalendar,
        meta: {
            requiresAuth: true,
        }
    },
    {
        path: '/wiki', name: 'wiki', component: Wiki,
        meta: {
            requiresAuth: true,
        }
    },
    {
        path: '/admin', name: 'admin', component: Admin,
        meta: {
            requiresAuth: true,
            roles: ['administrator']
        }
    }]

const initRouter = () => {
    const router = createRouter({
        history: createWebHistory(import.meta.env.BASE_URL),
        routes
    })

    router.beforeEach(async (to) => {
        const { isPending, hasRoles, keycloak } = useKeycloak()

        while (isPending.value) {
            await new Promise(resolve => setTimeout(resolve, 50))
        }

        if (to.meta.roles && !hasRoles(to.meta.roles)) {
            return { path: '/' }
        }
    })

    return router
}

export { initRouter }
