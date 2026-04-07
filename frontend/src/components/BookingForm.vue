<script setup>
import { computed, ref, onMounted, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n'
import { getToken, useKeycloak } from '@josempgon/vue-keycloak';
import api from '../lib/api.js';
const { isPending, isAuthenticated, username, userId, keycloak, roles, hasRoles } = useKeycloak();
const { t } = useI18n()
const props = defineProps({
  rooms: { type: Array, default: () => [] }
})

const emit = defineEmits(['booking-created', 'close'])

const getTodayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const roomId = ref('')
const date = ref(getTodayIso())
const start = ref('08:00')
const end = ref('09:00')
const meetingName = ref('')
const beschreibung = ref('')
const participantQuery = ref('')
const participantResults = ref([])
const participantLoading = ref(false)
const participantError = ref('')
const selectedParticipants = ref([])
const showParticipantDropdown = ref(false)

const showRoomDropdown = ref(false)

const currentRoomName = computed(() => {
  const r = props.rooms.find(r => String(r.id) === String(roomId.value))
  return r ? r.name : t('bookingForm.selectRoom')
})

function selectRoom(id) {
  roomId.value = String(id)
  showRoomDropdown.value = false
}

function closeRoomDropdown(e) {
  if (!e.target.closest('.room-dropdown-wrapper')) {
    showRoomDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeRoomDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeRoomDropdown)
  if (searchTimer) clearTimeout(searchTimer)
  if (currentAbort) currentAbort.abort()
})

const isLoggedIn = computed(() => Boolean(isAuthenticated.value))

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
    const params = { limit: 12 }
    if (q) params.q = q

    const res = await api.get('/users', {
      params,
      signal: currentAbort.signal,
    })
    const data = res.data
    participantResults.value = Array.isArray(data) ? data : []
  } catch (e) {
    if (e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
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

watch(() => props.rooms, (list) => {
  if (list && list.length && !roomId.value) {
    roomId.value = String(list[0].id)
  }
}, { immediate: true })

function validate() {
  if (!isLoggedIn.value) return t('bookingForm.loginFirst')
  if (!roomId.value || !date.value || !start.value || !end.value || !meetingName.value) return t('bookingForm.fillAllFields')
  if (end.value <= start.value) return t('bookingForm.endTimeError')
  return ''
}

async function submit() {
  error.value = ''
  success.value = ''
  const msg = validate()
  if (msg) { error.value = msg; return }

  const participants = selectedParticipants.value
    .map((p) => String(p.email || '').trim())
    .filter(Boolean)

  try {
    await api.post(`/bookings`, {
        room_id: Number(roomId.value),
        date: date.value,
        start_time: start.value,
        end_time: end.value,
        name: meetingName.value,
        beschreibung: beschreibung.value,
        participant_emails: participants,
    })

    success.value = t('bookingForm.saved')
    // Reset minimal fields
    selectedParticipants.value = []
    participantQuery.value = ''
    participantResults.value = []
    showParticipantDropdown.value = false
    
    emit('booking-created')
  } catch (e) {
        const status = e?.response?.status
        const apiError = e?.response?.data?.error

        if (status === 401) {
          error.value = apiError || t('bookingForm.loginFirst')
        } else if (status === 409) {
          error.value = apiError || t('bookingForm.occupied')
        } else {
          error.value = apiError || e?.message || t('common.error')
        }
  }
}
</script>

<template>
  <div class="booking-form-panel">
    <header class="panel-header">
      <h2>{{ $t('bookingForm.newBooking') }}</h2>
      <button class="close-btn" type="button" @click="emit('close')" :aria-label="$t('bookingForm.close')">✕</button>
    </header>

    <div class="panel-body">
      <div v-if="success" class="message is-success">
        {{ success }}
      </div>

      <form v-if="!success" @submit.prevent="submit" class="booking-form">
        <div class="form-group">
          <label class="form-label">{{ $t('bookingForm.selectRoom') }}</label>
          <div class="room-dropdown-wrapper">
              <button class="room-toggle-btn" type="button" @click="showRoomDropdown = !showRoomDropdown">
                <span>{{ currentRoomName }}</span>
                <span class="dropdown-arrow">▼</span>
              </button>
              <Transition name="slide-fade">
                <div v-show="showRoomDropdown" class="user-dropdown room-menu-dropdown">
                  <button 
                    v-for="r in rooms" 
                    :key="r.id" 
                    type="button"
                    @click="selectRoom(r.id)" 
                    class="dropdown-item room-item"
                    :class="{ 'is-active': String(r.id) === roomId }"
                  >
                     {{ r.name }}
                  </button>
                </div>
              </Transition>
          </div>
        </div>

        <div class="form-group">
           <label for="date-input" class="form-label">{{ $t('bookingForm.date') }}</label>
           <input id="date-input" v-model="date" class="form-input" type="date" required />
        </div>

        <div class="form-group">
           <label for="name-input" class="form-label">{{ $t('bookingForm.nameTitle') }}</label>
           <input id="name-input" v-model="meetingName" class="form-input" type="text" :placeholder="$t('bookingForm.namePlaceholder')" required />
        </div>

        <div class="form-group">
           <label for="desc-input" class="form-label">{{ $t('bookingForm.description') }}</label>
           <textarea id="desc-input" v-model="beschreibung" class="form-input" rows="3" :placeholder="$t('bookingForm.descriptionPlaceholder')"></textarea>
        </div>

        <div class="form-row">
           <div class="form-group">
              <label for="start-input" class="form-label">{{ $t('bookingForm.from') }}</label>
              <input id="start-input" v-model="start" class="form-input" type="time" required />
           </div>
           <div class="form-group">
              <label for="end-input" class="form-label">{{ $t('bookingForm.to') }}</label>
              <input id="end-input" v-model="end" class="form-input" type="time" required />
           </div>
        </div>

        <!-- Participants Search -->
        <div class="participant-section">
           <label for="search-input" class="form-label">{{ $t('bookingForm.addParticipants') }}</label>
           <div class="search-wrapper">
              <input
                 id="search-input"
                 v-model="participantQuery"
                 class="form-input search-input"
                 type="text"
                 :placeholder="$t('bookingForm.searchPlaceholder')"
                 @focus="showParticipantDropdown = !!participantQuery"
              />
              <div v-if="participantLoading" class="spinner-sm"></div>
           </div>

           <!-- Search Dropdown -->
           <div v-if="showParticipantDropdown && participantResults.length && participantQuery" class="search-dropdown">
              <button
                 type="button"
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
              </button>
           </div>
           <div v-else-if="showParticipantDropdown && participantQuery && !participantLoading" class="search-dropdown empty">
              {{ $t('bookingForm.noResults') }}
           </div>
        </div>

        <!-- Selected Participants -->
        <div v-if="selectedParticipants.length" class="selected-list">
           <label class="form-label mb-2">{{ $t('bookingForm.selected') }}</label>
           <div v-for="p in selectedParticipants" :key="p.id" class="chip">
              <span class="chip-label">{{ p.name || p.email }}</span>
              <button type="button" class="chip-remove" @click="removeParticipant(p.id)" :aria-label="$t('bookingForm.removeParticipant')">✕</button>
           </div>
        </div>

        <div class="form-actions">
           <button type="submit" class="btn btn-primary full-width">{{ $t('bookingForm.book') }}</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Fehler-Modal -->
  <Teleport to="body">
    <div v-if="error" class="modal-backdrop" @click.self="error = ''">
      <div class="modal error-modal" role="dialog" aria-modal="true">
        <header class="modal-header">
          <h2 class="modal-title">{{ $t('common.error') || 'Fehler' }}</h2>
          <button class="close-btn" type="button" @click="error = ''" :aria-label="$t('calendar.modal.close') || 'Schließen'">✕</button>
        </header>

        <div class="modal-body">
          <div class="message is-error" style="text-align: center; font-weight: 500; font-size: 1.1rem; border: none; background: transparent; color: var(--color-danger);">
            {{ error }}
          </div>
        </div>

        <div class="modal-actions" style="display: flex; justify-content: flex-end; padding: var(--space-4); border-top: 1px solid var(--color-border); background: var(--color-bg-secondary); border-radius: 0 0 var(--radius-xl) var(--radius-xl);">
          <button class="btn btn-secondary" type="button" @click="error = ''">OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.error-modal {
  max-width: 400px;
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.modal-body {
  padding: var(--space-6);
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: var(--space-4);
  animation: fadeIn 0.2s ease-out;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.close-btn {
  background: var(--color-bg-secondary);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.close-btn:hover {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.booking-form-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-bg-surface);
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
  background-color: var(--color-bg-primary);
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

.participant-section {
  position: relative;
  min-width: 0;
}

.search-dropdown {
  position: absolute;
  top: 100%; left: 0; right: 0;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  z-index: 50;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 4px;
}
.dropdown-item {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: 0;
  font-family: inherit;
  color: inherit;
  font-size: 1rem;
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
