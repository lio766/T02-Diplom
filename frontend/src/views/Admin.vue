<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getAuth, getToken } from '../lib/auth'

const { t } = useI18n()

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const session = ref(getAuth())

function syncSession() {
  session.value = getAuth()
}

onMounted(() => {
  window.addEventListener('auth-changed', syncSession)
})

onUnmounted(() => {
  window.removeEventListener('auth-changed', syncSession)
})

const isLoggedIn = computed(() => Boolean(getToken()))
const isAdmin = computed(() => {
  const u = session.value?.user
  return Number(u?.rollen_id) === 2
})

const bezeichnung = ref('')
const standort = ref('')
const kapazitaet = ref('')

const loading = ref(false)
const msg = ref('')
const err = ref('')

function validate() {
  if (!isLoggedIn.value) return t('admin.error.noAdmin') // Technically login required first but re-using or new key
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
  syncSession()

  const v = validate()
  if (v) { err.value = v; return }

  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/admin/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        bezeichnung: bezeichnung.value,
        standort: standort.value,
        kapazitaet: Number(kapazitaet.value),
      })
    })

    const data = await res.json().catch(() => ({}))
    if (res.status === 401) throw new Error(data.error || t('calendar.messages.loginRequired'))
    if (res.status === 403) throw new Error(data.error || t('admin.error.noAdmin'))
    if (!res.ok) throw new Error(data.error || t('common.error'))

    msg.value = `${t('admin.success')} (ID: ${data.id}).`
    bezeichnung.value = ''
    standort.value = ''
    kapazitaet.value = ''
  } catch (e) {
    err.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <h1 class="page-title">{{ $t('admin.title') }}</h1>
      <p class="page-subtitle">{{ $t('admin.subtitle') }}</p>
    </header>

    <!-- Error State: Not Logged In -->
    <div v-if="!isLoggedIn" class="card error-state">
      <div class="error-content">
        <div class="error-icon">🔒</div>
        <h2>{{ $t('admin.accessRestricted') }}</h2>
        <p>{{ $t('admin.loginRequiredText') }}</p>
        <RouterLink class="btn btn-primary" to="/login">{{ $t('admin.toLogin') }}</RouterLink>
      </div>
    </div>

    <!-- Error State: No Admin Rights -->
    <div v-else-if="!isAdmin" class="card error-state">
      <div class="error-content">
        <div class="error-icon">🛡️</div>
        <h2>{{ $t('admin.noPermission') }}</h2>
        <p>{{ $t('admin.adminOnly') }}</p>
        <RouterLink class="btn btn-secondary" to="/booking">{{ $t('login.toBooking') }}</RouterLink>
      </div>
    </div>

    <!-- Admin Form -->
    <div v-else class="admin-content">
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
    </div>
  </div>
</template>

<style scoped>
.page-header {
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
  color: #166534;
  border: 1px solid #bbf7d0;
}

.form-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
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




