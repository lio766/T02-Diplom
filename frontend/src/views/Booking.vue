<script setup>
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { getAuth, getToken } from '../lib/auth'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const roomId = ref('')
const rooms = ref([])
const date = ref('')
const start = ref('08:00')
const end = ref('09:00')
const participantQuery = ref('')
const participantResults = ref([])
const participantLoading = ref(false)
const participantError = ref('')
const selectedParticipants = ref([])
const showParticipantDropdown = ref(false)

const session = ref(getAuth())
const isLoggedIn = computed(() => Boolean(getToken()))

const error = ref('')
const success = ref('')

function parseParticipants(text) {
  return String(text || '')
    .split(/[,;\n\r\t]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function labelForUser(u) {
  const name = (u?.name || '').trim()
  const email = (u?.email || '').trim()
  if (name && email) return `${name} (${email})`
  return name || email || ''
}

function isAlreadySelected(user) {
  const id = Number(user?.id)
  if (!Number.isFinite(id)) return false
  return selectedParticipants.value.some((p) => Number(p.id) === id)
}

function addParticipant(user) {
  if (!user || !Number.isFinite(Number(user.id))) return
  if (isAlreadySelected(user)) return
  selectedParticipants.value.push({ id: user.id, email: user.email, name: user.name })
  participantQuery.value = ''
  participantResults.value = []
  showParticipantDropdown.value = false
}

function removeParticipant(id) {
  selectedParticipants.value = selectedParticipants.value.filter((p) => Number(p.id) !== Number(id))
}

let searchTimer = null
let currentAbort = null

async function searchUsers(q) {
  participantError.value = ''
  participantLoading.value = true
  if (currentAbort) currentAbort.abort()
  currentAbort = new AbortController()

  try {
    const url = new URL(`${API_BASE}/users`, window.location.origin)
    if (q) url.searchParams.set('q', q)
    url.searchParams.set('limit', '12')

    const res = await fetch(url.toString().replace(window.location.origin, ''), {
      headers: { 'Authorization': `Bearer ${getToken()}` },
      signal: currentAbort.signal,
    })
    if (res.status === 401) throw new Error('Bitte zuerst einloggen')
    if (!res.ok) throw new Error('Fehler beim Laden der Benutzer')
    const data = await res.json()
    participantResults.value = Array.isArray(data) ? data : []
  } catch (e) {
    if (e?.name === 'AbortError') return
    participantError.value = e.message
    participantResults.value = []
  } finally {
    participantLoading.value = false
  }
}

watch(participantQuery, (q) => {
  participantError.value = ''
  if (searchTimer) clearTimeout(searchTimer)
  const query = String(q || '').trim()
  if (!query) {
    participantResults.value = []
    showParticipantDropdown.value = false
    return
  }
  showParticipantDropdown.value = true
  searchTimer = setTimeout(() => {
    searchUsers(query)
  }, 250)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (currentAbort) currentAbort.abort()
})

async function loadRooms() {
  try {
    const res = await fetch(`${API_BASE}/rooms`)
    if (!res.ok) throw new Error('Fehler beim Laden der Räume')
    rooms.value = await res.json()
    if (rooms.value.length && !roomId.value) {
      roomId.value = String(rooms.value[0].id)
    }
  } catch (e) {
    // silently ignore for now
  }
}

function validate() {
  if (!isLoggedIn.value) return 'Bitte zuerst einloggen.'
  if (!roomId.value || !date.value || !start.value || !end.value) return 'Bitte alle Felder ausfüllen.'
  if (end.value <= start.value) return 'Endzeit muss nach der Startzeit liegen.'
  return ''
}

async function submit() {
  error.value = ''
  success.value = ''
  session.value = getAuth()
  const msg = validate()
  if (msg) { error.value = msg; return }

  const participants = selectedParticipants.value
    .map((p) => String(p.email || '').trim())
    .filter(Boolean)

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        room_id: Number(roomId.value),
        date: date.value,
        start_time: start.value,
        end_time: end.value,
        participant_emails: participants,
      })
    })
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Bitte zuerst einloggen')
    }
    if (res.status === 409) {
      const data = await res.json()
      throw new Error(data.error || 'Zeitfenster belegt')
    }
    if (!res.ok) throw new Error('Fehler beim Speichern')

    success.value = 'Buchung gespeichert.'
    selectedParticipants.value = []
    participantQuery.value = ''
    participantResults.value = []
    showParticipantDropdown.value = false
  } catch (e) {
    error.value = e.message
  }
}

onMounted(() => { loadRooms() })
</script>

<template>
  <section class="booking">
    <h1>Raumbuchung</h1>

    <div v-if="!isLoggedIn" class="card gate">
      <p class="msg error">Zum Buchen musst du eingeloggt sein.</p>
      <RouterLink to="/login" class="btn primary">Zum Login</RouterLink>
    </div>

    <div v-else class="card gate">
      <p class="msg">Eingeloggt als <strong>{{ session?.user?.email || 'Benutzer' }}</strong></p>
      <RouterLink to="/calendar" class="btn ghost">Zum Kalender</RouterLink>
    </div>

    <form class="card" @submit.prevent="submit">
      <div class="grid">
        <label>
          Raum
          <select v-model="roomId">
            <option v-for="r in rooms" :key="r.id" :value="String(r.id)">{{ r.name || r.Bezeichnung || r.bezeichnung }}</option>
          </select>
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
          Teilnehmer hinzufügen
          <div class="combo">
            <input
              v-model="participantQuery"
              type="text"
              autocomplete="off"
              placeholder="Name oder E-Mail suchen…"
              @focus="showParticipantDropdown = Boolean(participantQuery.trim())"
              @keydown.esc.prevent="showParticipantDropdown = false"
            />

            <div v-if="showParticipantDropdown" class="dropdown">
              <div class="ddRow" v-if="participantLoading">Suche…</div>
              <div class="ddRow error" v-else-if="participantError">{{ participantError }}</div>
              <button
                v-for="u in participantResults"
                :key="u.id"
                class="ddItem"
                type="button"
                :disabled="isAlreadySelected(u)"
                @click="addParticipant(u)"
              >
                <span class="ddMain">{{ labelForUser(u) }}</span>
                <span class="ddHint" v-if="isAlreadySelected(u)">bereits hinzugefügt</span>
              </button>
              <div class="ddRow" v-if="!participantLoading && !participantError && participantResults.length === 0">Keine Treffer</div>
            </div>
          </div>

          <div v-if="selectedParticipants.length" class="chips">
            <div v-for="p in selectedParticipants" :key="p.id" class="chip">
              <span>{{ labelForUser(p) }}</span>
              <button type="button" class="chipX" @click="removeParticipant(p.id)">×</button>
            </div>
          </div>
        </label>
      </div>
      <button type="submit" class="btn primary" :disabled="!isLoggedIn">Buchen</button>
      <p v-if="error" class="msg error">{{ error }}</p>
      <p v-if="success" class="msg success">{{ success }}</p>
    </form>

    <RouterLink to="/" class="back">Zurück zur Startseite</RouterLink>
  </section>
</template>

<style scoped>
.booking { min-height: 70vh; color: #e5e7eb; background: #0f172a; padding: 2rem 1rem; display: grid; gap: 1.5rem; }
.card { background: #111827; border: 1px solid #1f2937; border-radius: 0.75rem; padding: 1rem; display: grid; gap: 1rem; }
.card.gate { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 0.75rem; }
label { display: grid; gap: 0.35rem; font-size: 0.9rem; }
label.full { grid-column: 1 / -1; }
input { background: #0b1222; border: 1px solid #243146; color: #e5e7eb; padding: 0.6rem 0.7rem; border-radius: 0.5rem; }
.combo { position: relative; }
.dropdown { position: absolute; left: 0; right: 0; top: calc(100% + 6px); background: #0b1222; border: 1px solid #243146; border-radius: 0.6rem; overflow: hidden; z-index: 10; max-height: 260px; overflow-y: auto; }
.ddRow { padding: 0.6rem 0.7rem; color: #94a3b8; font-size: 0.9rem; }
.ddRow.error { color: #fca5a5; }
.ddItem { width: 100%; text-align: left; padding: 0.6rem 0.7rem; background: transparent; border: none; border-bottom: 1px solid rgba(36, 49, 70, 0.7); color: #e5e7eb; cursor: pointer; display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; }
.ddItem:last-child { border-bottom: none; }
.ddItem:hover { background: rgba(148, 163, 184, 0.08); }
.ddItem:disabled { opacity: 0.5; cursor: not-allowed; }
.ddMain { font-weight: 600; }
.ddHint { color: #94a3b8; font-size: 0.85rem; }
.chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
.chip { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(66, 184, 131, 0.12); border: 1px solid rgba(66, 184, 131, 0.35); color: #e5e7eb; padding: 0.35rem 0.55rem; border-radius: 999px; font-size: 0.9rem; }
.chipX { background: transparent; border: none; color: #e5e7eb; font-size: 1.05rem; line-height: 1; cursor: pointer; padding: 0 0.15rem; }
.btn.ghost { outline: 1px solid #334155; color: #e5e7eb; background: transparent; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 600; text-decoration: none; width: fit-content; display: inline-grid; place-items: center; }
.btn.primary { background: #42b883; color: #0a0f1e; border: none; padding: 0.7rem 1rem; border-radius: 0.6rem; font-weight: 600; width: fit-content; }
.btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }
.msg { margin: 0; font-size: 0.9rem; }
.msg.error { color: #fca5a5; }
.msg.success { color: #86efac; }
.back { color: #94a3b8; }
</style>
