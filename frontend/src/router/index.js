import { createRouter, createWebHistory } from 'vue-router'
import { useKeycloak } from '@josempgon/vue-keycloak';

const { isPending, isAuthenticated, hasRoles } = useKeycloak();
import RoomCalendar from '../views/RoomCalendar.vue'
import Wiki from '../views/Wiki.vue'
import Admin from '../views/Admin.vue'
import Approvals from '../views/Approvals.vue'

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
        path: '/approvals', name: 'approvals', component: Approvals,
        meta: {
            requiresAuth: true,
            roles: ['genehmiger']
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

        while (isPending.value) {
            await new Promise(resolve => setTimeout(resolve, 50))
        }

        if (to.meta.roles && !hasRoles(to.meta.roles)) {
            return { path: '/' }
        }
        if (to.meta.requiresAuth && !isAuthenticated.value) {
            return { path: '/' }
        }
    })

    return router
}

export { initRouter }
