<script setup>
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { getAuth, getToken } from '../lib/auth'

const props = defineProps({
  rooms: { type: Array, default: () => [] }
})

const emit = defineEmits(['booking-created', 'close'])

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const roomId = ref('')
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

watch(() => props.rooms, (list) => {
  if (list && list.length && !roomId.value) {
    roomId.value = String(list[0].id)
  }
}, { immediate: true })

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
    // Reset minimal fields
    selectedParticipants.value = []
    participantQuery.value = ''
    participantResults.value = []
    showParticipantDropdown.value = false
    
    emit('booking-created')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="booking-form-panel">
    <header class="panel-header">
      <h2>Neue Buchung</h2>
      <button class="close-btn" type="button" @click="emit('close')" aria-label="Schließen">✕</button>
    </header>

    <div class="panel-body">
      <div v-if="success" class="message is-success">
        {{ success }}
      </div>
      <div v-if="error" class="message is-error">
        {{ error }}
      </div>

      <template v-if="!isLoggedIn">
        <p>Bitte einloggen um zu buchen.</p>
        <RouterLink to="/login" class="btn btn-primary">Login</RouterLink>
      </template>
      
      <form v-else @submit.prevent="submit" class="booking-form">
        <div class="form-group">
          <label class="form-label">Raum</label>
          <div class="select-wrapper">
             <select v-model="roomId" class="form-input">
                <option v-for="r in rooms" :key="r.id" :value="String(r.id)">
                   {{ r.name || r.Bezeichnung || r.bezeichnung }}
                </option>
             </select>
             <span class="select-arrow">▼</span>
          </div>
        </div>

        <div class="form-group">
           <label class="form-label">Datum</label>
           <input v-model="date" class="form-input" type="date" required />
        </div>

        <div class="form-row">
           <div class="form-group">
              <label class="form-label">Von</label>
              <input v-model="start" class="form-input" type="time" required />
           </div>
           <div class="form-group">
              <label class="form-label">Bis</label>
              <input v-model="end" class="form-input" type="time" required />
           </div>
        </div>

        <!-- Participants Search -->
        <div class="participant-section">
           <label class="form-label">Teilnehmer hinzufügen</label>
           <div class="search-wrapper">
              <input 
                 v-model="participantQuery" 
                 class="form-input search-input" 
                 type="text" 
                 placeholder="Name suchen..." 
                 @focus="showParticipantDropdown = !!participantQuery"
              />
              <div v-if="participantLoading" class="spinner-sm"></div>
           </div>
           
           <!-- Search Dropdown -->
           <div v-if="showParticipantDropdown && participantResults.length && participantQuery" class="search-dropdown">
              <div 
                 v-for="u in participantResults" 
                 :key="u.id" 
                 class="dropdown-item"
                 @click="addParticipant(u)"
              >
                 <div class="avatar-sm">{{ (u.name?.[0] || u.email?.[0] || '?').toUpperCase() }}</div>
                 <div class="user-info">
                    <div class="user-name">{{ u.name || 'Unbekannt' }}</div>
                    <div class="user-email">{{ u.email }}</div>
                 </div>
                 <div v-if="isAlreadySelected(u)" class="already-badge">✓</div>
              </div>
           </div>
           <div v-else-if="showParticipantDropdown && participantQuery && !participantLoading" class="search-dropdown empty">
              Keine Ergebnisse
           </div>
        </div>

        <!-- Selected Participants -->
        <div v-if="selectedParticipants.length" class="selected-list">
           <label class="form-label mb-2">Ausgewählt:</label>
           <div v-for="p in selectedParticipants" :key="p.id" class="chip">
              <span class="chip-label">{{ p.name || p.email }}</span>
              <button type="button" class="chip-remove" @click="removeParticipant(p.id)">✕</button>
           </div>
        </div>

        <div class="form-actions">
           <button type="submit" class="btn btn-primary full-width">Buchen</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.booking-form-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: white;
  border-left: 1px solid var(--color-border);
}

.panel-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  font-size: 1.25rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-secondary);
}
.close-btn:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-danger);
}

.panel-body {
  padding: var(--space-4);
  flex: 1;
  overflow-y: auto;
}

.booking-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
}
.form-label {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: var(--space-2);
  color: var(--color-text-secondary);
}
.form-input {
  padding: 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: inherit;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.select-wrapper {
  position: relative;
}
.select-wrapper select {
  width: 100%;
  appearance: none;
  background-color: white;
  cursor: pointer;
}
.select-arrow {
  position: absolute;
  right: 10px; top: 50%; transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.7rem; color: var(--color-text-secondary);
}

.search-wrapper {
  position: relative;
}
.search-dropdown {
  position: absolute;
  top: 100%; left: 0; right: 0;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  z-index: 50;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
}
.dropdown-item {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-bg-secondary);
}
.dropdown-item:last-child { border-bottom: none; }
.dropdown-item:hover { background-color: var(--color-bg-accent); }
.empty { padding: 12px; color: var(--color-text-muted); font-size: 0.9rem; text-align: center; }

.avatar-sm {
  width: 32px; height: 32px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.8rem;
}
.user-info { flex: 1; min-width: 0; }
.user-name { font-weight: 500; font-size: 0.9rem; }
.user-email { font-size: 0.8rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.already-badge { color: var(--color-success); font-weight: bold; }

.selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  background: var(--color-bg-accent);
  padding: 4px 8px;
  border-radius: 16px;
  display: flex; align-items: center; gap: 6px;
  font-size: 0.85rem;
}
.chip-remove {
  background: none; border: none; cursor: pointer;
  color: var(--color-text-muted); font-size: 1rem;
  padding: 0; line-height: 1;
}
.chip-remove:hover { color: var(--color-danger); }

.full-width { width: 100%; padding: 0.8rem; }
.spinner-sm {
  position: absolute; right: 10px; top: 10px;
  width: 16px; height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.message {
  padding: 12px;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: 0.9rem;
}
.is-success { background-color: #dcfce7; color: #166534; }
.is-error { background-color: #fee2e2; color: #991b1b; }
.mb-2 { margin-bottom: 0.5rem; }
</style>
