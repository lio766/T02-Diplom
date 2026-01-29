import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Booking from '../views/Booking.vue'
import RoomCalendar from '../views/RoomCalendar.vue'
import Admin from '../views/Admin.vue'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const routes = [
    { path: '/', name: 'home', component: Home },
    { path: '/login', name: 'login', component: Login },
    { path: '/register', name: 'register', component: Register },
    { path: '/booking', name: 'booking', component: Booking },
    { path: '/calendar', name: 'calendar', component: RoomCalendar },
    { path: '/admin', name: 'admin', component: Admin }]

const initRouter = () => {
    const history = createWebHistory(import.meta.env.BASE_URL)
    return createRouter({ history, routes })
}

export { initRouter }
