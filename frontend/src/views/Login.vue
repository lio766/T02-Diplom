<script setup>
import { ref } from 'vue'

const email = ref('')
const password = ref('') // optional, wird aktuell nicht gespeichert
const vorname = ref('')
const nachname = ref('')
const abteilungId = ref('')

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const msg = ref('')
const err = ref('')

async function submit() {
  msg.value = ''
  err.value = ''
  if (!email.value) { err.value = 'Bitte E-Mail angeben.'; return }
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        vorname: vorname.value,
        nachname: nachname.value,
        abteilung_id: abteilungId.value ? Number(abteilungId.value) : null,
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login fehlgeschlagen')
    msg.value = data.newUser ? 'Benutzer angelegt (Rolle: Mitarbeiter).' : 'Login erfolgreich.'
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <section class="auth">
    <h1>Anmelden</h1>
    <form @submit.prevent="submit" class="card">
      <label>
        E-Mail
        <input v-model="email" type="email" placeholder="you@example.com" required />
      </label>
      <label>
        Vorname
        <input v-model="vorname" type="text" placeholder="Max" />
      </label>
      <label>
        Nachname
        <input v-model="nachname" type="text" placeholder="Mustermann" />
      </label>
      <label>
        Abteilung_Id
        <input v-model="abteilungId" type="number" placeholder="optional" />
      </label>
      <button type="submit" class="btn primary">Login</button>
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
label { display: grid; gap: 0.35rem; font-size: 0.9rem; }
input { background: #0b1222; border: 1px solid #243146; color: #e5e7eb; padding: 0.6rem 0.7rem; border-radius: 0.5rem; }
.btn.primary { background: #42b883; color: #0a0f1e; border: none; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 600; }
.back { margin-top: 0.75rem; display: inline-block; color: #94a3b8; }
.msg { margin: 0; font-size: 0.9rem; }
.msg.success { color: #86efac; }
.msg.error { color: #fca5a5; }
</style>
