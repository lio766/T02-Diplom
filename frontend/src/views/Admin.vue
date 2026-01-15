<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { getAuth, getToken } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const session = ref(getAuth())

function syncSession() {
  session.value = getAuth()
}

onMounted(() => {
  window.addEventListener('auth-changed', syncSession)
})

onUnmounted(() => {
  window.removeEventListener('auth-changed', syncSession)
})

const isLoggedIn = computed(() => Boolean(getToken()))
const isAdmin = computed(() => {
  const u = session.value?.user
  return Boolean(u?.is_admin)
    || String(u?.rollen_name || '').toLowerCase() === 'admin'
    || Number(u?.rollen_id) === 1
})

const bezeichnung = ref('')
const standort = ref('')
const kapazitaet = ref('')

const loading = ref(false)
const msg = ref('')
const err = ref('')

function validate() {
  if (!isLoggedIn.value) return 'Bitte zuerst einloggen.'
  if (!isAdmin.value) return 'Keine Admin-Berechtigung.'
  if (!bezeichnung.value.trim()) return 'Bezeichnung ist erforderlich.'
  if (!standort.value.trim()) return 'Standort ist erforderlich.'
  const k = Number(kapazitaet.value)
  if (!Number.isFinite(k) || k <= 0) return 'Kapazität muss > 0 sein.'
  return ''
}

async function submit() {
  msg.value = ''
  err.value = ''
  syncSession()

  const v = validate()
  if (v) { err.value = v; return }

  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/admin/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        bezeichnung: bezeichnung.value,
        standort: standort.value,
        kapazitaet: Number(kapazitaet.value),
      })
    })

    const data = await res.json().catch(() => ({}))
    if (res.status === 401) throw new Error(data.error || 'Bitte zuerst einloggen')
    if (res.status === 403) throw new Error(data.error || 'Keine Admin-Berechtigung')
    if (!res.ok) throw new Error(data.error || 'Raum konnte nicht angelegt werden')

    msg.value = `Raum angelegt (ID: ${data.id}).`
    bezeichnung.value = ''
    standort.value = ''
    kapazitaet.value = ''
  } catch (e) {
    err.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="admin">
    <h1>Admin</h1>

    <div class="card" v-if="!isLoggedIn">
      <p class="msg error">Du musst eingeloggt sein.</p>
      <RouterLink class="btn primary" to="/login">Zum Login</RouterLink>
    </div>

    <div class="card" v-else-if="!isAdmin">
      <p class="msg error">Du hast keine Admin-Rechte.</p>
      <RouterLink class="btn ghost" to="/booking">Zur Buchung</RouterLink>
    </div>

    <form v-else class="card" @submit.prevent="submit">
      <h2>Neuen Raum anlegen</h2>

      <label>
        Bezeichnung
        <input v-model="bezeichnung" type="text" placeholder="z.B. Konferenzraum A" />
      </label>

      <label>
        Standort
        <input v-model="standort" type="text" placeholder="z.B. Gebäude 1 / 2. OG" />
      </label>

      <label>
        Kapazität
        <input v-model="kapazitaet" type="number" min="1" step="1" placeholder="z.B. 12" />
      </label>

      <div class="actions">
        <button class="btn primary" type="submit" :disabled="loading">
          {{ loading ? 'Speichere…' : 'Raum hinzufügen' }}
        </button>
        <RouterLink class="btn ghost" to="/calendar">Zum Kalender</RouterLink>
      </div>

      <p v-if="msg" class="msg success">{{ msg }}</p>
      <p v-if="err" class="msg error">{{ err }}</p>
    </form>

    <RouterLink to="/" class="back">Zurück zur Startseite</RouterLink>
  </section>
</template>

<style scoped>
.admin { min-height: 70vh; display: grid; place-items: center; color: #e5e7eb; background: #0f172a; padding: 2rem 1rem; }
h1 { margin-bottom: 1rem; }
.card { background: #111827; border: 1px solid #1f2937; border-radius: 0.75rem; padding: 1rem; display: grid; gap: 0.75rem; min-width: 320px; }
h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
label { display: grid; gap: 0.35rem; font-size: 0.9rem; }
input { background: #0b1222; border: 1px solid #243146; color: #e5e7eb; padding: 0.6rem 0.7rem; border-radius: 0.5rem; }
.actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.btn.primary { background: #42b883; color: #0a0f1e; border: none; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 700; cursor: pointer; }
.btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn.ghost { background: transparent; color: #e5e7eb; border: 1px solid #334155; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 600; text-decoration: none; display: inline-grid; place-items: center; }
.msg { margin: 0; font-size: 0.9rem; }
.msg.success { color: #86efac; }
.msg.error { color: #fca5a5; }
.back { margin-top: 0.75rem; display: inline-block; color: #94a3b8; }
</style>
