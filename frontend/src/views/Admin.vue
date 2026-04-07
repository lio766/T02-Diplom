<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import api from '../lib/api.js'
import { useKeycloak } from '@josempgon/vue-keycloak'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isAuthenticated, hasRoles } = useKeycloak()

const bezeichnung = ref('')
const standort = ref('')
const kapazitaet = ref('')

const loading = ref(false)
const msg = ref('')
const err = ref('')

const assigning = ref(false)
const assignMsg = ref('')
const assignErr = ref('')

const rooms = ref([])
const approvers = ref([])
const selectedRoomId = ref('')
const selectedApproverIds = ref([])
const showRoomDropdown = ref(false)

const isLoggedIn = computed(() => isAuthenticated.value)
const isAdmin = computed(() => hasRoles(['administrator']))

const currentRoomName = computed(() => {
  if (!selectedRoomId.value) return t('admin.placeholder.selectRoom')
  const r = rooms.value.find(r => String(r.id) === selectedRoomId.value)
  return r ? `${r.name} (${r.Standort})` : t('admin.placeholder.selectRoom')
})

function selectRoom(id) {
  selectedRoomId.value = String(id)
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
})

function getErrorMessage(e, fallback) {
  return e?.response?.data?.error || e?.message || fallback
}

function validate() {
  if (!isLoggedIn.value) return t('admin.error.noAdmin')
  if (!isAdmin.value) return t('admin.error.noAdmin')
  if (!bezeichnung.value.trim()) return t('admin.error.required')
  if (!standort.value.trim()) return t('admin.error.locationRequired')
  const k = Number(kapazitaet.value)
  if (!Number.isFinite(k) || k <= 0) return t('admin.error.capacity')
  return ''
}

async function submit() {
  msg.value = ''
  err.value = ''

  const v = validate()
  if (v) {
    err.value = v
    return
  }

  loading.value = true
  try {
    const { data } = await api.post('/admin/rooms', {
      bezeichnung: bezeichnung.value,
      standort: standort.value,
      kapazitaet: Number(kapazitaet.value),
    })

    msg.value = `${t('admin.success')} (ID: ${data.id}).`
    bezeichnung.value = ''
    standort.value = ''
    kapazitaet.value = ''
    await loadRooms()
  } catch (e) {
    err.value = getErrorMessage(e, t('admin.error.saveRoom'))
  } finally {
    loading.value = false
  }
}

async function loadRooms() {
  try {
    const { data } = await api.get('/rooms')
    rooms.value = Array.isArray(data) ? data : []

    if (!rooms.value.length) {
      selectedRoomId.value = ''
      selectedApproverIds.value = []
      return
    }

    const currentId = Number(selectedRoomId.value)
    if (!Number.isFinite(currentId) || !rooms.value.some((r) => Number(r.id) === currentId)) {
      selectedRoomId.value = String(rooms.value[0].id)
    }
  } catch (e) {
    assignErr.value = getErrorMessage(e, t('admin.error.loadRooms'))
  }
}

async function loadApprovers() {
  try {
    const { data } = await api.get('/admin/approvers')
    approvers.value = Array.isArray(data) ? data : []
  } catch (e) {
    assignErr.value = getErrorMessage(e, t('admin.error.loadApprovers'))
  }
}

async function loadRoomAssignments(roomId) {
  const id = Number(roomId)
  if (!Number.isFinite(id)) {
    selectedApproverIds.value = []
    return
  }

  assigning.value = true
  assignErr.value = ''
  assignMsg.value = ''
  try {
    const { data } = await api.get(`/admin/rooms/${id}/approvers`)
    const ids = Array.isArray(data?.approvers)
      ? data.approvers.map((u) => Number(u.id)).filter((x) => Number.isFinite(x))
      : []
    selectedApproverIds.value = ids
  } catch (e) {
    selectedApproverIds.value = []
    assignErr.value = getErrorMessage(e, t('admin.error.loadAssignments'))
  } finally {
    assigning.value = false
  }
}

async function saveAssignments() {
  assignErr.value = ''
  assignMsg.value = ''

  const roomId = Number(selectedRoomId.value)
  if (!Number.isFinite(roomId)) {
    assignErr.value = t('admin.error.selectRoom')
    return
  }

  assigning.value = true
  try {
    await api.put(`/admin/rooms/${roomId}/approvers`, {
      approver_ids: selectedApproverIds.value,
    })
    assignMsg.value = t('admin.assignSuccess')
  } catch (e) {
    assignErr.value = getErrorMessage(e, t('admin.error.saveAssignments'))
  } finally {
    assigning.value = false
  }
}

watch(selectedRoomId, (value) => {
  loadRoomAssignments(value)
})

if (isAdmin.value) {
  loadRooms()
  loadApprovers()
}
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <h1 class="page-title">{{ $t('admin.title') }}</h1>
      <p class="page-subtitle">{{ $t('admin.subtitle') }}</p>
    </header>

    <!-- Error State: No Admin Rights -->
    <div v-if="isAdmin == false" class="card error-state">
      <div class="error-content">
        <div class="error-icon">🛡️</div>
        <h2>{{ $t('admin.noPermission') }}</h2>
        <p>{{ $t('admin.adminOnly') }}</p>
        <RouterLink class="btn btn-secondary" to="/booking">{{ $t('login.toBooking') }}</RouterLink>
      </div>
    </div>

    <!-- Admin Form -->
    <div class="admin-content">
      <div class="card admin-form-card">
        <div class="card-header">
          <h2>{{ $t('admin.createRoom') }}</h2>
          <p>{{ $t('admin.createRoomDesc') }}</p>
        </div>

        <form @submit.prevent="submit" class="admin-form">
          <!-- Bezeichnung Field -->
          <div class="form-group">
            <label for="bez" class="form-label">{{ $t('admin.roomName') }} <span class="required">*</span></label>
            <input 
              id="bez" 
              v-model="bezeichnung" 
              type="text" 
              :placeholder="$t('admin.placeholder.roomName')"
              class="form-input"
              required
            />
          </div>

          <div class="form-row">
            <!-- Location Field -->
            <div class="form-group">
              <label for="loc" class="form-label">{{ $t('admin.location') }} <span class="required">*</span></label>
              <input 
                id="loc" 
                v-model="standort" 
                type="text" 
                :placeholder="$t('admin.placeholder.location')"
                class="form-input"
                required
              />
            </div>

            <!-- Capacity Field -->
            <div class="form-group">
              <label for="cap" class="form-label">{{ $t('admin.capacity') }} <span class="required">*</span></label>
              <input 
                id="cap" 
                v-model="kapazitaet" 
                type="number" 
                :placeholder="$t('admin.placeholder.capacity')"
                class="form-input"
                min="1"
                required
              />
            </div>
          </div>

          <!-- Feedback Messages -->
          <div v-if="msg || err" class="message" :class="{ 'is-error': err, 'is-success': msg }">
            {{ msg || err }}
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="loading">
              {{ loading ? $t('admin.submitting') : $t('admin.submit') }}
            </button>
            <button type="button" class="btn btn-secondary" @click="() => { bezeichnung=''; standort=''; kapazitaet=''; msg=''; err=''; }">
              {{ $t('admin.reset') }}
            </button>
          </div>
        </form>
      </div>

      <div class="card admin-form-card">
        <div class="card-header">
          <h2>{{ $t('admin.assignApproversTitle') }}</h2>
          <p>{{ $t('admin.assignApproversDesc') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('admin.selectRoom') }}</label>
          <div class="room-dropdown-wrapper">
              <button class="room-toggle-btn" type="button" @click="showRoomDropdown = !showRoomDropdown">
                <span>{{ currentRoomName }}</span>
                <span class="dropdown-arrow">▼</span>
              </button>
              <Transition name="slide-fade">
                <div v-show="showRoomDropdown" class="user-dropdown room-menu-dropdown">
                  <button 
                    type="button"
                    @click="selectRoom('')" 
                    class="dropdown-item room-item"
                    :class="{ 'is-active': selectedRoomId === '' }"
                  >
                     {{ $t('admin.placeholder.selectRoom') }}
                  </button>
                  <button 
                    v-for="room in rooms" 
                    :key="room.id" 
                    type="button"
                    @click="selectRoom(room.id)" 
                    class="dropdown-item room-item"
                    :class="{ 'is-active': String(room.id) === selectedRoomId }"
                  >
                     {{ room.name }} ({{ room.Standort }})
                  </button>
                </div>
              </Transition>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ $t('admin.approverUsers') }}</label>

          <p v-if="!approvers.length" class="hint">{{ $t('admin.noApproversFound') }}</p>

          <div v-else class="approver-grid">
            <label
              v-for="approver in approvers"
              :key="approver.id"
              class="approver-item"
            >
              <input
                v-model="selectedApproverIds"
                type="checkbox"
                :value="Number(approver.id)"
                :disabled="assigning || !selectedRoomId"
              />
              <span>
                {{ approver.name || approver.email }}
                <small>{{ approver.email }}</small>
              </span>
            </label>
          </div>
        </div>

        <div v-if="assignMsg || assignErr" class="message" :class="{ 'is-error': assignErr, 'is-success': assignMsg }">
          {{ assignMsg || assignErr }}
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="assigning || !selectedRoomId"
            @click="saveAssignments"
          >
            {{ assigning ? $t('admin.savingAssignments') : $t('admin.saveAssignments') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-top: 50px;
  margin-bottom: var(--space-8);
  text-align: center;
}

.page-title {
  margin-bottom: var(--space-2);
}

.page-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-lg);
}

/* Error States */
.error-state {
  text-align: center;
  padding: var(--space-8);
  max-width: 500px;
  margin: 0 auto;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

/* Admin Form */
.admin-content {
  max-width: 800px;
  margin: 0 auto;
}

.admin-form-card {
  padding: var(--space-8);
}

.card-header {
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-4);
}

.card-header h2 {
  margin-bottom: var(--space-2);
}

.card-header p {
  color: var(--color-text-secondary);
  margin-bottom: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.required {
  color: var(--color-danger);
}

.message {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  text-align: center;
}

.is-error {
  background-color: var(--color-danger-bg);
  color: #991b1b;
  border: 1px solid #fecaca;
}

.is-success {
  background-color: var(--color-success-bg);
  /*color: #166534;*/
  color: #166534;
  border: 1px solid #bbf7d0;
}

.form-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
}

.approver-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
}

.approver-item {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.approver-item small {
  display: block;
  color: var(--color-text-secondary);
}

.hint {
  color: var(--color-text-secondary);
  margin: 0;
}

@media (max-width: 600px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>




