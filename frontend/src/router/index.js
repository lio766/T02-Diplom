import { createRouter, createWebHistory } from 'vue-router'
import { useKeycloak } from '@josempgon/vue-keycloak';

const { isPending, isAuthenticated, error, username, userId, keycloak, roles, hasRoles } = useKeycloak();
import Home from '../views/Home.vue'
import Booking from '../views/Booking.vue'
import RoomCalendar from '../views/RoomCalendar.vue'
import Admin from '../views/Admin.vue'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const routes = [
    {
        path: '/', name: 'home', component: Home,
        meta: {
            requiresAuth: true,
        }
    },
    {
        path: '/booking', name: 'booking', component: Booking,
        meta: {
            requiresAuth: true,
        }
    },
    {
        path: '/calendar', name: 'calendar', component: RoomCalendar,
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

    router.beforeEach((to) => {
        const { isAuthenticated, hasRoles, keycloak } = useKeycloak()

        if (to.meta.roles && !hasRoles(to.meta.roles)) {
            return { path: '/' }
        }
    })

    return router
}

export { initRouter }
