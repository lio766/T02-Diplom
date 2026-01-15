<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { setAuth } from '../lib/auth'

const router = useRouter()

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const vorname = ref('')
const nachname = ref('')
const email = ref('')
const password = ref('')
const password2 = ref('')
const abteilungId = ref('')

const loading = ref(false)
const msg = ref('')
const err = ref('')

function validate() {
  if (!vorname.value || !nachname.value) return 'Vorname und Nachname sind erforderlich.'
  if (!email.value) return 'E-Mail ist erforderlich.'
  if (!password.value) return 'Passwort ist erforderlich.'
  if (password.value.length < 6) return 'Passwort muss mindestens 6 Zeichen lang sein.'
  if (password.value !== password2.value) return 'Passwörter stimmen nicht überein.'
  return ''
}

async function submit() {
  msg.value = ''
  err.value = ''
  const v = validate()
  if (v) { err.value = v; return }

  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
        vorname: vorname.value,
        nachname: nachname.value,
        abteilung_id: abteilungId.value ? Number(abteilungId.value) : null,
      })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Registrierung fehlgeschlagen')

    // Auto-login after registration
    setAuth({
      token: data.token,
      user: {
        id: data.benutzer_id,
        email: data.email,
        vorname: vorname.value,
        nachname: nachname.value,
        rollen_id: data.rollen_id,
        rollen_name: data.rollen_name,
        prioritaet: data.prioritaet,
        is_admin: data.is_admin,
      },
    })

    msg.value = 'Registrierung erfolgreich. Du bist jetzt als Mitarbeiter eingeloggt.'
    setTimeout(() => router.push('/booking'), 300)
  } catch (e) {
    err.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="auth">
    <h1>Registrieren</h1>

    <form @submit.prevent="submit" class="card">
      <label>
        Vorname
        <input v-model="vorname" type="text" placeholder="Max" required />
      </label>
      <label>
        Nachname
        <input v-model="nachname" type="text" placeholder="Mustermann" required />
      </label>
      <label>
        E-Mail
        <input v-model="email" type="email" placeholder="you@example.com" required />
      </label>
      <label>
        Passwort
        <input v-model="password" type="password" placeholder="Passwort" required />
      </label>
      <label>
        Passwort wiederholen
        <input v-model="password2" type="password" placeholder="Passwort wiederholen" required />
      </label>
      <label>
        Abteilung_Id (optional)
        <input v-model="abteilungId" type="number" placeholder="optional" />
      </label>

      <div class="actions">
        <button type="submit" class="btn primary" :disabled="loading">{{ loading ? 'Registriere…' : 'Registrieren' }}</button>
        <RouterLink class="btn ghost" to="/login">Zum Login</RouterLink>
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
.card { background: #111827; border: 1px solid #1f2937; border-radius: 0.75rem; padding: 1rem; display: grid; gap: 0.75rem; min-width: 320px; }
label { display: grid; gap: 0.35rem; font-size: 0.9rem; }
input { background: #0b1222; border: 1px solid #243146; color: #e5e7eb; padding: 0.6rem 0.7rem; border-radius: 0.5rem; }
.actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.btn.primary { background: #42b883; color: #0a0f1e; border: none; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 700; cursor: pointer; }
.btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn.ghost { background: transparent; color: #e5e7eb; border: 1px solid #334155; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 600; text-decoration: none; display: inline-grid; place-items: center; }
.back { margin-top: 0.75rem; display: inline-block; color: #94a3b8; }
.msg { margin: 0; font-size: 0.9rem; }
.msg.success { color: #86efac; }
.msg.error { color: #fca5a5; }
</style>
