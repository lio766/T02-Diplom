<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { clearAuth, getAuth, setAuth } from '../lib/auth'

const router = useRouter()

const email = ref('')
const password = ref('')

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const msg = ref('')
const err = ref('')

const session = ref(getAuth())

async function submit() {
  msg.value = ''
  err.value = ''
  if (!email.value) { err.value = 'Bitte E-Mail angeben.'; return }
  if (!password.value) { err.value = 'Bitte Passwort angeben.'; return }
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login fehlgeschlagen')

    setAuth({
      token: data.token,
      user: {
        id: data.benutzer_id,
        email: data.email,
        vorname: '',
        nachname: '',
        rollen_id: data.rollen_id,
        rollen_name: data.rollen_name,
        prioritaet: data.prioritaet,
        is_admin: data.is_admin,
      },
    })
    session.value = getAuth()

    msg.value = 'Login erfolgreich.'
    // Take user to booking by default
    setTimeout(() => {
      router.push('/booking')
    }, 250)
  } catch (e) {
    err.value = e.message
  }
}

function logout() {
  clearAuth()
  session.value = null
  msg.value = 'Abgemeldet.'
  err.value = ''
}
</script>

<template>
  <section class="auth">
    <h1>Anmelden</h1>

    <div v-if="session" class="card session">
      <p class="sessionLine">
        Eingeloggt als <strong>{{ session.user?.email }}</strong>
      </p>
      <div class="sessionActions">
        <RouterLink class="btn primary" to="/booking">Zur Buchung</RouterLink>
        <RouterLink class="btn ghost" to="/calendar">Zum Kalender</RouterLink>
        <button class="btn danger" type="button" @click="logout">Logout</button>
      </div>
    </div>

    <form @submit.prevent="submit" class="card">
      <label>
        E-Mail
        <input v-model="email" type="email" placeholder="you@example.com" required />
      </label>
      <label>
        Passwort
        <input v-model="password" type="password" placeholder="Passwort" required />
      </label>
      <div class="actions">
        <button type="submit" class="btn primary">Login</button>
        <RouterLink class="btn ghost" to="/register">Registrieren</RouterLink>
      </div>
      <p v-if="msg" class="msg success">{{ msg }}</p>
      <p v-if="err" class="msg error">{{ err }}</p>
    </form>
    <RouterLink to="/" class="back">Zurück zur Startseite</RouterLink>
  </section>
</template>

<style scoped>
.auth { min-height: 70vh; display: grid; place-items: center; color: #e5e7eb; background: #0f172a; padding: 2rem 1rem; }
h1 { margin-bottom: 1rem; }
.card { background: #111827; border: 1px solid #1f2937; border-radius: 0.75rem; padding: 1rem; display: grid; gap: 0.75rem; min-width: 280px; }
.card.session { min-width: 280px; max-width: 520px; }
label { display: grid; gap: 0.35rem; font-size: 0.9rem; }
input { background: #0b1222; border: 1px solid #243146; color: #e5e7eb; padding: 0.6rem 0.7rem; border-radius: 0.5rem; }
.btn.primary { background: #42b883; color: #0a0f1e; border: none; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 600; }
.btn.ghost { background: transparent; color: #e5e7eb; border: 1px solid #334155; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 600; text-decoration: none; display: inline-grid; place-items: center; }
.btn.danger { background: #ef4444; color: #0a0f1e; border: none; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 700; cursor: pointer; }
.actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.sessionLine { margin: 0; color: #e5e7eb; }
.sessionActions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.back { margin-top: 0.75rem; display: inline-block; color: #94a3b8; }
.msg { margin: 0; font-size: 0.9rem; }
.msg.success { color: #86efac; }
.msg.error { color: #fca5a5; }
</style>
