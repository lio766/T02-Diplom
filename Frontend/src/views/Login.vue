<script setup>
import { ref } from 'vue'

const email = ref('')
const password = ref('')

function submit() {
  // Placeholder: später API-Login integrieren
  alert(`Login versucht für ${email.value}`)
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
        Passwort
        <input v-model="password" type="password" placeholder="••••••••" required />
      </label>
      <button type="submit" class="btn primary">Anmelden</button>
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
</style>
