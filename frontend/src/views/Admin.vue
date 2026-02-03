<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'


onMounted(() => {
  window.addEventListener('auth-changed', syncSession)
})

onUnmounted(() => {
  window.removeEventListener('auth-changed', syncSession)
})

const isLoggedIn = computed(() => Boolean(getToken()))
const isAdmin = computed(() => {
  const u = session.value?.user
  return Boolean(u?.is_admin)
    || String(u?.rollen_name || '').toLowerCase() === 'admin'
    || Number(u?.rollen_id) === 1
})

const bezeichnung = ref('')
const standort = ref('')
const kapazitaet = ref('')

const loading = ref(false)
const msg = ref('')
const err = ref('')

function validate() {
  if (!isAdmin.value) return 'Keine Admin-Berechtigung.'
  if (!bezeichnung.value.trim()) return 'Bezeichnung ist erforderlich.'
  if (!standort.value.trim()) return 'Standort ist erforderlich.'
  const k = Number(kapazitaet.value)
  if (!Number.isFinite(k) || k <= 0) return 'Kapazität muss > 0 sein.'
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
    if (res.status === 401) throw new Error(data.error || 'Bitte zuerst einloggen')
    if (res.status === 403) throw new Error(data.error || 'Keine Admin-Berechtigung')
    if (!res.ok) throw new Error(data.error || 'Raum konnte nicht angelegt werden')

    msg.value = `Raum erfolgreich angelegt (ID: ${data.id}).`
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
      <h1 class="page-title">Admin Dashboard</h1>
      <p class="page-subtitle">Verwaltung von Räumen und Ressourcen</p>
    </header>

    <!-- Error State: Not Logged In -->
    <div v-if="!isLoggedIn" class="card error-state">
      <div class="error-content">
        <div class="error-icon">🔒</div>
        <h2>Zugriff beschränkt</h2>
        <p>Du musst eingeloggt sein, um Räume zu verwalten.</p>
        <RouterLink class="btn btn-primary" to="/login">Zum Login</RouterLink>
      </div>
    </div>

    <!-- Error State: No Admin Rights -->
    <div v-else-if="!isAdmin" class="card error-state">
      <div class="error-content">
        <div class="error-icon">🛡️</div>
        <h2>Keine Berechtigung</h2>
        <p>Dieser Bereich ist nur für Administratoren zugänglich.</p>
        <RouterLink class="btn btn-secondary" to="/booking">Zur Buchung</RouterLink>
      </div>
    </div>

    <!-- Admin Form -->
    <div v-else class="admin-content">
      <div class="card admin-form-card">
        <div class="card-header">
          <h2>Neuen Raum hinzufügen</h2>
          <p>Erfasse die Details für einen neuen Raum.</p>
        </div>

        <form @submit.prevent="submit" class="admin-form">
          <!-- Bezeichnung Field -->
          <div class="form-group">
            <label for="bez" class="form-label">Bezeichnung <span class="required">*</span></label>
            <input 
              id="bez" 
              v-model="bezeichnung" 
              type="text" 
              placeholder="z.B. Meetingraum A"
              class="form-input"
              required
            />
          </div>

          <div class="form-row">
            <!-- Location Field -->
            <div class="form-group">
              <label for="loc" class="form-label">Standort <span class="required">*</span></label>
              <input 
                id="loc" 
                v-model="standort" 
                type="text" 
                placeholder="z.B. 1. Stock"
                class="form-input"
                required
              />
            </div>

            <!-- Capacity Field -->
            <div class="form-group">
              <label for="cap" class="form-label">Kapazität <span class="required">*</span></label>
              <input 
                id="cap" 
                v-model="kapazitaet" 
                type="number" 
                placeholder="z.B. 8"
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
              {{ loading ? 'Wird gespeichert...' : 'Raum anlegen' }}
            </button>
            <button type="button" class="btn btn-secondary" @click="() => { bezeichnung=''; standort=''; kapazitaet=''; msg=''; err=''; }">
              Zurücksetzen
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




