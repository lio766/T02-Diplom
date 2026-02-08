<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { clearAuth, getAuth, setAuth } from '../lib/auth'

const { t } = useI18n()
const router = useRouter()

const email = ref('')
const password = ref('')

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const msg = ref('')
const err = ref('')

const session = ref(getAuth())

async function submit() {
  msg.value = ''
  err.value = ''
  if (!email.value) { err.value = t('login.error.email'); return }
  if (!password.value) { err.value = t('login.error.password'); return }
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value,
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || t('login.error.failed'))

    setAuth({
      token: data.token,
      user: {
        id: data.benutzer_id,
        email: data.email,
        vorname: '',
        nachname: '',
        rollen_id: data.rollen_id,
        rollen_name: data.rollen_name,
        prioritaet: data.prioritaet,
        is_admin: data.is_admin,
      },
    })
    session.value = getAuth()

    msg.value = t('login.success')
    // Take user to booking by default
    setTimeout(() => {
      router.push('/booking')
    }, 250)
  } catch (e) {
    err.value = e.message
  }
}

function logout() {
  clearAuth()
  session.value = null
  msg.value = t('login.loggedOut')
  err.value = ''
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-card">
        <h1 class="auth-title">{{ $t('login.title') }}</h1>

        <!-- Already logged in -->
        <div v-if="session" class="session-box">
          <p class="session-text">
            {{ $t('login.welcome') }} <strong>{{ session.user?.email }}</strong>
          </p>
          <div class="session-actions">
            <RouterLink class="btn btn-primary" to="/booking">{{ $t('login.toBooking') }}</RouterLink>
            <RouterLink class="btn btn-outline" to="/calendar">{{ $t('login.toCalendar') }}</RouterLink>
            <button class="btn btn-danger" type="button" @click="logout">{{ $t('login.logout') }}</button>
          </div>
        </div>

        <!-- Login form -->
        <form v-else @submit.prevent="submit" class="form">
          <div class="form-group">
            <label for="email" class="form-label">{{ $t('login.email') }}</label>
            <input 
              id="email"
              v-model="email" 
              type="email" 
              placeholder="their@example.com" 
              class="form-input"
              required 
            />
          </div>

          <div class="form-group">
            <label for="password" class="form-label">{{ $t('login.password') }}</label>
            <input 
              id="password"
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              class="form-input"
              required 
            />
          </div>

          <div v-if="msg || err" class="message" :class="{ 'is-error': err, 'is-success': msg }">
            <span>{{ msg || err }}</span>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary btn-block">{{ $t('login.submit') }}</button>
            <RouterLink class="btn btn-secondary btn-block" to="/register">{{ $t('login.register') }}</RouterLink>
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
  padding-top: var(--space-12);
}

.auth-container {
  width: 100%;
  max-width: 400px;
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

/* Session Box */
.session-box {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.session-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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


