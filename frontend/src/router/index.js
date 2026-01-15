import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Booking from '../views/Booking.vue'
import RoomCalendar from '../views/RoomCalendar.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/login', name: 'login', component: Login },
    { path: '/register', name: 'register', component: Register },
    { path: '/booking', name: 'booking', component: Booking },
    { path: '/calendar', name: 'calendar', component: RoomCalendar }
  ]
})

export default router
