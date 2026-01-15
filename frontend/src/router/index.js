import { createRouter, createWebHistory } from 'vue-router'

import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Booking from '../views/Booking.vue'
import RoomCalendar from '../views/RoomCalendar.vue'
import Admin from '../views/Admin.vue'

import { clearAuth, getAuth, getToken, setAuth } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function refreshMe() {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (res.status === 401) {
      clearAuth()
      return null
    }
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (!data) return null

    const existing = getAuth() || {}
    setAuth({
      ...existing,
      token: existing.token || token,
      user: {
        ...(existing.user || {}),
        id: data.benutzer_id,
        email: data.email,
        rollen_id: data.rollen_id,
        rollen_name: data.rollen_name,
        prioritaet: data.prioritaet,
        is_admin: data.is_admin,
      },
    })
    return data
  } catch {
    return null
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/login', name: 'login', component: Login },
    { path: '/register', name: 'register', component: Register },
    { path: '/booking', name: 'booking', component: Booking },
    { path: '/calendar', name: 'calendar', component: RoomCalendar },
    { path: '/admin', name: 'admin', component: Admin, meta: { requiresAuth: true, requiresAdmin: true } }
  ]
})

router.beforeEach(async (to) => {
  const needsAuth = to.matched.some((r) => r.meta?.requiresAuth)
  const needsAdmin = to.matched.some((r) => r.meta?.requiresAdmin)
  if (!needsAuth && !needsAdmin) return true

  const token = getToken()
  if (!token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (needsAdmin) {
    const auth = getAuth()
    let isAdmin = Boolean(auth?.user?.is_admin)
      || String(auth?.user?.rollen_name || '').toLowerCase() === 'admin'
      || Number(auth?.user?.rollen_id) === 1

    if (!isAdmin) {
      const me = await refreshMe()
      isAdmin = Boolean(me?.is_admin)
        || String(me?.rollen_name || '').toLowerCase() === 'admin'
        || Number(me?.rollen_id) === 1
    }

    if (!isAdmin) {
      return { name: 'booking' }
    }
  }

  return true
})

export default router
