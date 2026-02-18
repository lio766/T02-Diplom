<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { setAuth } from '../lib/auth'

const { t } = useI18n()
const router = useRouter()

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const vorname = ref('')
const nachname = ref('')
const email = ref('')
const password = ref('')
const password2 = ref('')
const abteilungId = ref('')

const loading = ref(false)
const msg = ref('')
const err = ref('')

function validate() {
  if (!vorname.value || !nachname.value) return t('register.error.namesRequired')
  if (!email.value) return t('register.error.emailRequired')
  if (!password.value) return t('register.error.passwordRequired')
  if (password.value.length < 6) return t('register.error.passwordLength')
  if (password.value !== password2.value) return t('register.error.passwordMismatch')
  return ''
}

async function submit() {
  msg.value = ''
  err.value = ''
  const v = validate()
  if (v) { err.value = v; return }

  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
        vorname: vorname.value,
        nachname: nachname.value,
        abteilung_id: abteilungId.value ? Number(abteilungId.value) : null,
      })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || t('register.error.failed'))

    // Auto-login after registration
    setAuth({
      token: data.token,
      user: {
        id: data.benutzer_id,
        email: data.email,
        vorname: vorname.value,
        nachname: nachname.value,
        rollen_id: data.rollen_id,
        rollen_name: data.rollen_name,
        prioritaet: data.prioritaet,
        is_admin: data.is_admin,
      },
    })

    msg.value = t('register.success')
    setTimeout(() => router.push('/booking'), 300)
  } catch (e) {
    err.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">{{ $t('register.title') }}</h1>

        <form @submit.prevent="submit" class="form">
          <div class="form-group">
            <label for="vorname" class="form-label">{{ $t('register.firstname') }}</label>
            <input 
              id="vorname"
              v-model="vorname" 
              type="text" 
              placeholder="Max" 
              class="form-input"
              required 
            />
          </div>

          <div class="form-group">
            <label for="nachname" class="form-label">{{ $t('register.lastname') }}</label>
            <input 
              id="nachname"
              v-model="nachname" 
              type="text" 
              placeholder="Mustermann" 
              class="form-input"
              required 
            />
          </div>

          <div class="form-group">
            <label for="email" class="form-label">{{ $t('register.email') }}</label>
            <input 
              id="email"
              v-model="email" 
              type="email" 
              placeholder="ihre@example.com" 
              class="form-input"
              required 
            />
          </div>

          <div class="form-group">
            <label for="password" class="form-label">{{ $t('register.password') }}</label>
            <input 
              id="password"
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              class="form-input"
              required 
            />
          </div>

          <div class="form-group">
            <label for="password2" class="form-label">{{ $t('register.passwordRepeat') }}</label>
            <input 
              id="password2"
              v-model="password2" 
              type="password" 
              placeholder="••••••••" 
              class="form-input"
              required 
            />
          </div>

          <div class="form-group">
            <label for="abteilung" class="form-label">{{ $t('register.department') }}</label>
            <input 
              id="abteilung"
              v-model="abteilungId" 
              type="number" 
              placeholder="z.B. 1" 
              class="form-input"
            />
          </div>

          <div v-if="msg || err" class="message" :class="{ 'is-error': err, 'is-success': msg }">
            <span>{{ msg || err }}</span>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
              {{ loading ? $t('register.submitting') : $t('register.submit') }}
            </button>
            <RouterLink class="btn btn-secondary btn-block" to="/login">{{ $t('register.backToLogin') }}</RouterLink>
          </div>
        </form>

        <RouterLink to="/" class="back-link">{{ $t('login.backHome') }}</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: var(--space-8);
  padding-bottom: var(--space-8);
}

.auth-container {
  width: 100%;
  max-width: 500px; /* Slightly wider for registration form */
}

.auth-card {
  background-color: var(--color-bg-primary);
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}

.auth-title {
  text-align: center;
  margin-bottom: var(--space-6);
  color: var(--color-text-primary);
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.btn-block {
  width: 100%;
  justify-content: center;
}

.back-link {
  display: block;
  text-align: center;
  margin-top: var(--space-6);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-decoration: none;
}
.back-link:hover {
  color: var(--color-primary);
}
</style>


