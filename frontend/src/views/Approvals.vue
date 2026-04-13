<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKeycloak } from '@josempgon/vue-keycloak'
import api from '../lib/api.js'

const { t } = useI18n()
const { isAuthenticated, hasRoles } = useKeycloak()

const loading = ref(false)
const decidingId = ref(null)
const error = ref('')
const message = ref('')
const approvals = ref([])

const selectedRoomFilter = ref('')
const selectedDateFilter = ref('')
const showRoomDropdown = ref(false)

const showDetails = ref(false)
const selectedApproval = ref(null)

const isLoggedIn = computed(() => Boolean(isAuthenticated.value))
const isApprover = computed(() => hasRoles(['genehmiger']))

const roomFilterOptions = computed(() => {
  const byId = new Map()
  for (const item of approvals.value) {
    const id = String(item?.room_id || '')
    if (!id) continue
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name: String(item?.room || '').trim() || `${t('approvals.room')} ${id}`,
      })
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'))
})

const currentRoomName = computed(() => {
  if (!selectedRoomFilter.value) return t('approvals.filters.allRooms')
  const r = roomFilterOptions.value.find(r => String(r.id) === selectedRoomFilter.value)
  return r ? r.name : t('approvals.filters.allRooms')
})

function selectRoomFilter(id) {
  selectedRoomFilter.value = String(id)
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

const filteredApprovals = computed(() => {
  return approvals.value.filter((item) => {
    if (selectedRoomFilter.value && String(item?.room_id || '') !== selectedRoomFilter.value) {
      return false
    }
    if (selectedDateFilter.value && String(item?.date || '') !== selectedDateFilter.value) {
      return false
    }
    return true
  })
})

function participantLabel(p) {
  const name = String(p?.name || '').trim()
  const email = String(p?.email || '').trim()
  if (name && email) return `${name} (${email})`
  return name || email || ''
}

function formatGermanDate(isoString) {
  if (!isoString) return ''
  const parts = isoString.split('-')
  if (parts.length !== 3) return isoString
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function requesterLabel(item) {
  const name = String(item?.requester_name || '').trim()
  const email = String(item?.requester_email || '').trim()
  if (name && email) return `${name} (${email})`
  return name || email || item?.requester_display || '-'
}

function getErrorMessage(e, fallback) {
  return e?.response?.data?.error || e?.message || fallback
}

function isDeciding(itemId) {
  return Number(decidingId.value) === Number(itemId)
}

function openDetails(item) {
  selectedApproval.value = item
  showDetails.value = true
}

function closeDetails() {
  showDetails.value = false
  selectedApproval.value = null
}

function clearFilters() {
  selectedRoomFilter.value = ''
  selectedDateFilter.value = ''
}

async function loadApprovals() {
  if (!isApprover.value) return
  loading.value = true
  error.value = ''

  try {
    const { data } = await api.get('/approvals')
    approvals.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = getErrorMessage(e, t('approvals.error.load'))
  } finally {
    loading.value = false
  }
}

async function decideApproval(item, decision) {
  const id = Number(item?.id)
  if (!Number.isFinite(id)) return

  decidingId.value = id
  message.value = ''
  error.value = ''

  try {
    await api.put(`/approvals/${id}`, { decision })
    message.value = decision === 'approve' ? t('approvals.success.approved') : t('approvals.success.rejected')
    if (selectedApproval.value && Number(selectedApproval.value.id) === id) {
      closeDetails()
    }
    await loadApprovals()
  } catch (e) {
    error.value = getErrorMessage(e, t('approvals.error.decide'))
  } finally {
    decidingId.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', closeRoomDropdown)
  loadApprovals()
})
</script>

<template>
  <section class="approvals-page">
    <header class="page-header">
      <h1 class="page-title">{{ $t('approvals.title') }}</h1>
      <p class="page-subtitle">{{ $t('approvals.subtitle') }}</p>
    </header>

    <div v-if="!isLoggedIn || !isApprover" class="card error-state">
      <h2>{{ $t('approvals.noPermission') }}</h2>
      <p>{{ $t('approvals.approverOnly') }}</p>
    </div>

    <div v-else class="approvals-content">
      <div class="filters-card card">
        <div class="filters-grid">
          <div class="filter-group">
            <label class="form-label">{{ $t('approvals.filters.room') }}</label>
            <div class="room-dropdown-wrapper">
              <button class="room-toggle-btn" type="button" @click="showRoomDropdown = !showRoomDropdown">
                <span>{{ currentRoomName }}</span>
                <span class="dropdown-arrow">▼</span>
              </button>
              <Transition name="slide-fade">
                <div v-show="showRoomDropdown" class="user-dropdown room-menu-dropdown">
                  <button 
                    type="button"
                    @click="selectRoomFilter('')" 
                    class="dropdown-item room-item"
                    :class="{ 'is-active': selectedRoomFilter === '' }"
                  >
                    {{ $t('approvals.filters.allRooms') }}
                  </button>
                  <button 
                    v-for="room in roomFilterOptions" 
                    :key="room.id" 
                    type="button"
                    @click="selectRoomFilter(room.id)" 
                    class="dropdown-item room-item"
                    :class="{ 'is-active': String(room.id) === selectedRoomFilter }"
                  >
                    {{ room.name }}
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <div class="filter-group">
            <label for="approval-date-filter" class="form-label">{{ $t('approvals.filters.date') }}</label>
            <input id="approval-date-filter" v-model="selectedDateFilter" class="form-input" type="date" />
          </div>

          <div class="filter-actions">
            <button class="btn btn-secondary" type="button" @click="clearFilters">
              {{ $t('approvals.filters.clear') }}
            </button>
            <button class="btn btn-secondary" type="button" :disabled="loading" @click="loadApprovals">
              {{ loading ? $t('approvals.loading') : $t('approvals.refresh') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="message" class="message is-success">{{ message }}</div>
      <div v-if="error" class="message is-error">{{ error }}</div>

      <div class="card table-card">
        <div class="table-scroll">
          <table class="approval-table">
            <thead>
              <tr>
                <th>{{ $t('approvals.room') }}</th>
                <th>{{ $t('approvals.bookingName') }}</th>
                <th>{{ $t('approvals.requester') }}</th>
                <th>{{ $t('approvals.date') }}</th>
                <th class="actions-col">{{ $t('approvals.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredApprovals" :key="item.id">
                <td>{{ item.room || '-' }}</td>
                <td>
                  <button class="name-link" type="button" @click="openDetails(item)">
                    {{ item.name || $t('approvals.untitled') }}
                  </button>
                </td>
                <td>{{ requesterLabel(item) }}</td>
                <td>
                  {{ formatGermanDate(item.date) }}
                  <div class="time-subline">{{ item.start_time }} - {{ item.end_time }}</div>
                </td>
                <td class="actions-cell">
                  <div class="action-buttons-inline">
                    <button
                      class="btn btn-danger btn-sm"
                      type="button"
                      :disabled="isDeciding(item.id)"
                      @click="decideApproval(item, 'reject')"
                    >
                      <i class="pi pi-times"></i>&nbsp;{{ $t('approvals.reject') }}
                    </button>
                    <button
                      class="btn btn-success btn-sm"
                      type="button"
                      :disabled="isDeciding(item.id)"
                      @click="decideApproval(item, 'approve')"
                    >
                      <i class="pi pi-check"></i>&nbsp;{{ $t('approvals.approve') }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && filteredApprovals.length === 0">
                <td colspan="5" class="empty-state">{{ $t('approvals.empty') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showDetails && selectedApproval" class="modal-backdrop" @click.self="closeDetails">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal-header">
            <h2 class="modal-title">{{ selectedApproval.name || $t('approvals.untitled') }}</h2>
            <button class="close-btn" type="button" @click="closeDetails" :aria-label="$t('approvals.close')"><i class="pi pi-times"></i></button>
          </header>

          <div class="modal-body">
            <div class="detail-list">
              <div class="detail-item">
                <span class="label">{{ $t('approvals.room') }}</span>
                <span class="value">{{ selectedApproval.room || '-' }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ $t('approvals.requester') }}</span>
                <span class="value">{{ requesterLabel(selectedApproval) }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ $t('approvals.time') }}</span>
                <span class="value">{{ formatGermanDate(selectedApproval.date) }} <br> {{ selectedApproval.start_time }} - {{ selectedApproval.end_time }}</span>
              </div>
              <div class="detail-item">
                <span class="label">{{ $t('approvals.statusLabel') }}</span>
                <span class="status status-planned">{{ $t('approvals.status.pending') }}</span>
              </div>
              <div class="detail-item" v-if="selectedApproval.beschreibung">
                <span class="label">{{ $t('approvals.description') }}</span>
                <span class="value">{{ selectedApproval.beschreibung }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h3>{{ $t('approvals.participants') }}</h3>
              <ul v-if="Array.isArray(selectedApproval.participants) && selectedApproval.participants.length" class="participant-list">
                <li v-for="p in selectedApproval.participants" :key="`${selectedApproval.id}-${p.id}`">
                  <div class="participant-avatar">{{ (p.name?.[0] || p.email?.[0] || '?').toUpperCase() }}</div>
                  <span class="participant-name">{{ p.name || p.email }}</span>
                </li>
              </ul>
              <p v-else class="text-muted">{{ $t('approvals.noParticipants') }}</p>
            </div>

            <div class="modal-actions">
              <button
                class="btn btn-danger"
                type="button"
                :disabled="isDeciding(selectedApproval.id)"
                @click="decideApproval(selectedApproval, 'reject')"
              >
                <i class="pi pi-times"></i>&nbsp;{{ $t('approvals.reject') }}
              </button>
              <button
                class="btn btn-success"
                type="button"
                :disabled="isDeciding(selectedApproval.id)"
                @click="decideApproval(selectedApproval, 'approve')"
              >
                <i class="pi pi-check"></i>&nbsp;{{ $t('approvals.approve') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.approvals-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6);
}

.page-header {
  margin-top: 24px;
  margin-bottom: var(--space-6);
}

.page-title {
  margin-bottom: var(--space-2);
}

.page-subtitle {
  color: var(--color-text-secondary);
}

.error-state,
.empty-state {
  padding: var(--space-6);
  text-align: center;
}

.filters-card {
  margin-bottom: var(--space-4);
  padding: var(--space-4);
}

.filters-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--space-3);
  align-items: end;
}

.filter-group {
  min-width: 0;
}

.filter-actions {
  display: flex;
  gap: var(--space-2);
}

.form-label {
  display: block;
  margin-bottom: var(--space-2);
  font-weight: 600;
}

.form-input {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.table-card {
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.approval-table {
  width: 100%;
  border-collapse: collapse;
}

.approval-table th,
.approval-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

.approval-table th {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.actions-col,
.actions-cell {
  text-align: right !important;
}

.name-link {
  border: none;
  background: none;
  padding: 0;
  color: var(--color-primary);
  font-weight: 700;
  cursor: pointer;
  text-align: left;
}

.name-link:hover {
  text-decoration: underline;
}

.time-subline {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-top: 0.1rem;
}

.action-buttons-inline {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-weight: 700;
  color: #fff;
  margin-left: 0.4rem;
}

.icon-btn.reject {
  background: var(--color-danger);
}

.icon-btn.reject:hover {
  background: #b91c1c;
}

.icon-btn.approve {
  background: var(--color-success);
}

.icon-btn.approve:hover {
  background: #14532d;
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
  z-index: 2000;
  padding: var(--space-4);
  animation: fadeIn 0.2s ease-out;
}

.modal {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  padding: var(--space-6);
  border-bottom: 1px solid rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0;
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

.modal-body {
  padding: var(--space-6);
  overflow-y: auto;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.detail-item {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-3);
  align-items: center;
}

.detail-item .label {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.detail-item .value {
  font-weight: 600;
  text-align: right;
}

.status {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  font-weight: 700;
}

.status-planned {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.detail-section {
  margin-top: var(--space-6);
}

.detail-section h3 {
  font-size: 1rem;
  margin-bottom: var(--space-3);
  color: var(--color-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.participant-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.participant-list li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  background: var(--color-bg-accent);
  border-radius: var(--radius-lg);
}

.participant-avatar {
  width: 28px;
  height: 28px;
  background-color: var(--color-bg-primary);
  color: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.participant-name {
  font-weight: 500;
  font-size: 0.95rem;
}

.modal-actions {
  margin-top: var(--space-8);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-muted {
  color: var(--color-text-secondary);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.message {
  margin-bottom: var(--space-4);
}

@media (max-width: 900px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 700px) {
  .approvals-page {
    padding: var(--space-4);
  }

  .approval-table th,
  .approval-table td {
    padding: 0.7rem;
    font-size: 0.92rem;
  }

  .modal-actions {
    flex-direction: column;
  }

  .modal-actions .btn {
    width: 100%;
  }
}
</style>
