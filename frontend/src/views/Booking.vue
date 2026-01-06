<script setup>
import { ref, onMounted } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const room = ref('Raum 101')
const date = ref('')
const start = ref('08:00')
const end = ref('09:00')
const person = ref('')

const bookings = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')

async function loadBookings() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/bookings`)
    if (!res.ok) throw new Error('Fehler beim Laden der Buchungen')
    bookings.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function validate() {
  if (!room.value || !date.value || !start.value || !end.value || !person.value) return 'Bitte alle Felder ausfüllen.'
  if (end.value <= start.value) return 'Endzeit muss nach der Startzeit liegen.'
  return ''
}

async function submit() {
  error.value = ''
  success.value = ''
  const msg = validate()
  if (msg) { error.value = msg; return }

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: room.value,
        date: date.value,
        start_time: start.value,
        end_time: end.value,
        person: person.value,
      })
    })
    if (res.status === 409) {
      const data = await res.json()
      throw new Error(data.error || 'Zeitfenster belegt')
    }
    if (!res.ok) throw new Error('Fehler beim Speichern')

    success.value = 'Buchung gespeichert.'
    // reset name only, keep other context
    person.value = ''
    await loadBookings()
  } catch (e) {
    error.value = e.message
  }
}

onMounted(loadBookings)
</script>

<template>
  <section class="booking">
    <h1>Raumbuchung</h1>
    <form class="card" @submit.prevent="submit">
      <div class="grid">
        <label>
          Raum
          <input v-model="room" list="rooms" />
          <datalist id="rooms">
            <option>Raum 101</option>
            <option>Raum 201</option>
            <option>Konferenz A</option>
            <option>Konferenz B</option>
          </datalist>
        </label>
        <label>
          Datum
          <input v-model="date" type="date" />
        </label>
        <label>
          Start
          <input v-model="start" type="time" />
        </label>
        <label>
          Ende
          <input v-model="end" type="time" />
        </label>
        <label class="full">
          Person
          <input v-model="person" type="text" placeholder="Name" />
        </label>
      </div>
      <button type="submit" class="btn primary">Buchen</button>
      <p v-if="error" class="msg error">{{ error }}</p>
      <p v-if="success" class="msg success">{{ success }}</p>
    </form>

    <div class="list">
      <h2>Bestehende Buchungen</h2>
      <p v-if="loading">Lade Daten…</p>
      <table v-else>
        <thead>
          <tr>
            <th>Raum</th>
            <th>Datum</th>
            <th>Start</th>
            <th>Ende</th>
            <th>Person</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in bookings" :key="b.id">
            <td>{{ b.room }}</td>
            <td>{{ b.date }}</td>
            <td>{{ b.start_time }}</td>
            <td>{{ b.end_time }}</td>
            <td>{{ b.person }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <RouterLink to="/" class="back">Zurück zur Startseite</RouterLink>
  </section>
</template>

<style scoped>
.booking { min-height: 70vh; color: #e5e7eb; background: #0f172a; padding: 2rem 1rem; display: grid; gap: 1.5rem; }
.card { background: #111827; border: 1px solid #1f2937; border-radius: 0.75rem; padding: 1rem; display: grid; gap: 1rem; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 0.75rem; }
label { display: grid; gap: 0.35rem; font-size: 0.9rem; }
label.full { grid-column: 1 / -1; }
input { background: #0b1222; border: 1px solid #243146; color: #e5e7eb; padding: 0.6rem 0.7rem; border-radius: 0.5rem; }
.btn.primary { background: #42b883; color: #0a0f1e; border: none; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 600; width: fit-content; }
.msg { margin: 0; font-size: 0.9rem; }
.msg.error { color: #fca5a5; }
.msg.success { color: #86efac; }
.list { background: #111827; border: 1px solid #1f2937; border-radius: 0.75rem; padding: 1rem; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #1f2937; }
.back { color: #94a3b8; }
</style>
