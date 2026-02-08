<script setup>
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAuth, getToken } from '../lib/auth'

const { t } = useI18n()

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
    if (res.status === 401) throw new Error(t('calendar.messages.loginRequired'))
    if (!res.ok) throw new Error(t('booking.noResults')) // or generic loading error
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
      throw new Error(data.error || t('calendar.messages.loginRequired'))
    }
    if (res.status === 409) {
      const data = await res.json()
      throw new Error(data.error || t('booking.occupied'))
    }
    if (!res.ok) throw new Error(t('booking.saveError'))

    success.value = t('booking.success')
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
  <div class="booking-page">
    <div class="container-narrow">
      <header class="page-header">
        <h1>{{ $t('booking.title') }}</h1>
        <p>{{ $t('booking.subtitle') }}</p>
      </header>

      <!-- Not logged in -->
      <div v-if="!isLoggedIn" class="card error-state">
        <div class="error-content">
          <p class="error-text">{{ $t('booking.loginRequired') }}</p>
          <RouterLink to="/login" class="btn btn-primary">{{ $t('booking.loginBtn') }}</RouterLink>
        </div>
      </div>

      <!-- Logged in info -->
      <div v-else class="card info-card">
        <div class="info-content">
          <span>{{ $t('booking.loggedInAs') }} <strong>{{ session?.user?.email || $t('nav.user') }}</strong></span>
          <RouterLink to="/calendar" class="text-link">{{ $t('booking.viewCalendar') }}</RouterLink>
        </div>
      </div>

      <!-- Booking form -->
      <form v-if="isLoggedIn" @submit.prevent="submit" class="card booking-form">
        <div class="form-section">
          <h2>{{ $t('booking.details') }}</h2>

          <div class="form-grid">
            <div class="form-group span-full">
              <label for="room" class="form-label">{{ $t('booking.room') }} <span class="required">*</span></label>
              <select id="room" v-model="roomId" class="form-input" required>
                <option value="">{{ $t('booking.selectRoom') }}</option>
                <option v-for="r in rooms" :key="r.id" :value="String(r.id)">
                  {{ r.name || r.Bezeichnung || r.bezeichnung }}
                </option>
              </select>
            </div>

            <div class="form-group span-full">
              <label for="date" class="form-label">{{ $t('booking.date') }} <span class="required">*</span></label>
              <input id="date" v-model="date" type="date" class="form-input" required />
            </div>

            <div class="form-group">
              <label for="start" class="form-label">{{ $t('booking.startTime') }} <span class="required">*</span></label>
              <input id="start" v-model="start" type="time" class="form-input" required />
            </div>

            <div class="form-group">
              <label for="end" class="form-label">{{ $t('booking.endTime') }} <span class="required">*</span></label>
              <input id="end" v-model="end" type="time" class="form-input" required />
            </div>
          </div>
        </div>

        <div class="form-separator"></div>

        <div class="form-section">
          <h2>{{ $t('booking.participantsTitle') }}</h2>
          <div class="form-group">
            <label for="participant" class="form-label">{{ $t('booking.addParticipant') }}</label>
            <div class="participant-input-wrapper">
              <input
                id="participant"
                v-model="participantQuery"
                type="text"
                class="form-input"
                :placeholder="$t('booking.searchPlaceholder')"
                autocomplete="off"
                @focus="showParticipantDropdown = Boolean(participantQuery.trim())"
                @keydown.esc.prevent="showParticipantDropdown = false"
              />
              
              <div v-if="showParticipantDropdown" class="participant-dropdown">
                <div v-if="participantLoading" class="dropdown-item loading">
                  {{ $t('booking.searching') }}
                </div>
                <div v-else-if="participantError" class="dropdown-item error">
                  {{ participantError }}
                </div>
                <button
                  v-for="u in participantResults"
                  v-else
                  :key="u.id"
                  type="button"
                  class="dropdown-item"
                  :disabled="isAlreadySelected(u)"
                  @click="addParticipant(u)"
                >
                  <span class="participant-name">{{ labelForUser(u) }}</span>
                  <span v-if="isAlreadySelected(u)" class="badge-added">{{ $t('booking.alreadyAdded') }}</span>
                </button>
                <div v-if="!participantLoading && !participantError && participantResults.length === 0" class="dropdown-item empty">
                  {{ $t('booking.noResults') }}
                </div>
              </div>
            </div>

            <!-- Selected participants -->
            <div v-if="selectedParticipants.length" class="selected-participants">
              <div v-for="p in selectedParticipants" :key="p.id" class="participant-chip">
                <span>{{ labelForUser(p) }}</span>
                <button
                  type="button"
                  class="chip-remove"
                  @click.prevent="removeParticipant(p.id)"
                  :title="$t('booking.remove')"
                  :aria-label="$t('booking.removeParticipant')"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div v-if="error" class="message is-error">
          <p>{{ error }}</p>
        </div>
        <div v-if="success" class="message is-success">
          <p>{{ success }}</p>
        </div>

        <!-- Submit -->
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="!isLoggedIn">
            Jetzt buchen
          </button>
          <RouterLink to="/" class="btn btn-secondary">
            Abbrechen
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.container-narrow {
  max-width: 600px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.page-header h1 {
  margin-bottom: var(--space-2);
}

.page-header p {
  color: var(--color-text-secondary);
}

.card {
  margin-bottom: var(--space-6);
}

/* Info Card */
.info-card {
  padding: var(--space-4);
  background-color: var(--color-primary-light);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.info-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-link {
  color: var(--color-primary);
  text-decoration: underline;
}

/* Form */
.booking-form {
  padding: var(--space-8);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.span-full {
  grid-column: span 2;
}

.required {
  color: var(--color-danger);
}

.form-separator {
  height: 1px;
  background-color: var(--color-border);
  margin: var(--space-6) 0;
}

/* Participants */
.participant-input-wrapper {
  position: relative;
}

.participant-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  margin-top: var(--space-1);
}

.dropdown-item {
  width: 100%;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dropdown-item:hover {
  background-color: var(--color-bg-secondary);
}

.dropdown-item:disabled {
  opacity: 0.6;
  cursor: default;
}

.badge-added {
  font-size: 0.75rem;
  background-color: var(--color-success-bg);
  color: #166534;
  padding: 2px 6px;
  border-radius: 4px;
}

.selected-participants {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.participant-chip {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  padding: 4px 12px;
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.chip-remove {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}
.chip-remove:hover {
  background-color: #fee2e2;
  color: #b91c1c;
}

.form-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .span-full {
    grid-column: span 1;
  }
  .info-content {
    flex-direction: column;
    gap: var(--space-2);
    text-align: center;
  }
  .form-actions {
    flex-direction: column;
  }
}
</style>


