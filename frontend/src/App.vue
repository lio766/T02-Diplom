<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getAuth, getToken, clearAuth } from './lib/auth'

const router = useRouter()
const { t, locale } = useI18n()
const session = ref(getAuth())
const showDropdown = ref(false)
const isDark = ref(localStorage.getItem('theme') === 'dark')

function syncSession() {
  session.value = getAuth()
}

function toggleDarkMode() {
  isDark.value = !isDark.value
  updateTheme()
}

function updateTheme() {
  const html = document.documentElement
  if (isDark.value) {
    html.classList.add('dark-mode')
    localStorage.setItem('theme', 'dark')
  } else {
    html.classList.remove('dark-mode')
    localStorage.setItem('theme', 'light')
  }
}

function toggleLanguage() {
  const newLang = locale.value === 'de' ? 'en' : 'de'
  locale.value = newLang
  localStorage.setItem('lang', newLang)
}

onMounted(() => {
  window.addEventListener('auth-changed', syncSession)
  window.addEventListener('storage', syncSession)
  document.addEventListener('click', closeDropdown)
  updateTheme()
})

onUnmounted(() => {
  window.removeEventListener('auth-changed', syncSession)
  window.removeEventListener('storage', syncSession)
  document.removeEventListener('click', closeDropdown)
})

function closeDropdown(e) {
  if (!e.target.closest('.user-menu')) {
    showDropdown.value = false
  }
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function handleLogout() {
  clearAuth()
  showDropdown.value = false
  router.push('/login')
}

const isLoggedIn = computed(() => Boolean(session.value?.token))

const userDisplay = computed(() => {
  const u = session.value?.user
  if (!u) return t('nav.guest')
  if (u.vorname && u.nachname) return `${u.vorname} ${u.nachname}`
  return u.email || t('nav.user')
})

const userInitials = computed(() => {
  const u = session.value?.user
  if (!u) return 'G'
  if (u.vorname && u.nachname) {
    return (u.vorname[0] + u.nachname[0]).toUpperCase()
  }
  const email = u.email || ''
  return email.substring(0, 2).toUpperCase() || 'U'
})

const isAdmin = computed(() => {
  const u = session.value?.user
  return Number(u?.rollen_id) === 2
})

const roleLabel = computed(() => {
  const u = session.value?.user
  if (Number(u?.rollen_id) === 2) return 'admin'
  if (Number(u?.rollen_id) === 1) return 'Mitarbeiter'
  return ''
})
</script>

<template>
  <div class="app">
    <nav class="navbar">
      <div class="navbar-wrapper">
        <RouterLink to="/" class="navbar-brand">
          <div class="brand-logo">🏛️</div>
          <span class="brand-text">{{ $t('nav.brand') }}</span>
        </RouterLink>
        
        <!-- Private Navigation -->
        <div class="nav-wrapper-inner">
          <div class="main-nav" v-if="isLoggedIn">
             <RouterLink to="/" class="nav-link" active-class="is-active" exact>{{ $t('nav.dashboard') }}</RouterLink>
             <RouterLink to="/booking" class="nav-link" active-class="is-active">{{ $t('nav.booking') }}</RouterLink>
             <RouterLink to="/calendar" class="nav-link" active-class="is-active">{{ $t('nav.calendar') }}</RouterLink>
             <RouterLink v-if="isAdmin" to="/admin" class="nav-link admin-link" active-class="is-active">{{ $t('nav.admin') }}</RouterLink>
          </div>
  
          <!-- Right Side: Auth / Profile -->
          <div class="auth-nav">
            <template v-if="!isLoggedIn">
               <RouterLink to="/login" class="nav-btn-ghost">{{ $t('nav.login') }}</RouterLink>
               <RouterLink to="/register" class="nav-btn-primary">{{ $t('nav.register') }}</RouterLink>
            </template>
  
            <template v-else>
              <button class="theme-toggle-btn" @click="toggleLanguage" :title="$t('lang.toggle')">
                {{ locale === 'de' ? '🇩🇪' : '🇺🇸' }}
              </button>
              <button class="theme-toggle-btn" @click="toggleDarkMode" :title="isDark ? $t('theme.light') : $t('theme.dark')">
                {{ isDark ? '🌙' : '☀️' }}
              </button>
              <div class="user-menu" ref="userMenuRef">
                <button class="user-trigger" @click="toggleDropdown" :aria-label="$t('nav.openMenu')" :aria-expanded="showDropdown">
                  <div class="user-info-text">
                  <span class="user-name">{{ userDisplay }}</span>
                  <span class="user-role-label" v-if="roleLabel">{{ roleLabel }}</span>
                </div>
                <div class="user-avatar">{{ userInitials }}</div>
              </button>
  
              <Transition name="slide-fade">
                <div v-show="showDropdown" class="user-dropdown">
                   <div class="dropdown-header">
                      <div class="dropdown-avatar-large">{{ userInitials }}</div>
                      <div class="dropdown-info">
                         <span class="dropdown-name">{{ userDisplay }}</span>
                         <span class="dropdown-email" v-if="session?.user?.email">{{ session.user.email }}</span>
                      </div>
                   </div>
                   <div class="dropdown-divider"></div>
                   <button @click="handleLogout" class="dropdown-item text-danger">
                      <span>🚪</span> {{ $t('nav.logout') }}
                   </button>
                </div>
              </Transition>
            </div>
            </template>
          </div>
        </div>
      </div>
    </nav>

    <div class="app-content">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-secondary);
  font-family: var(--font-family-base);
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  background-color: var(--navbar-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  transition: all 0.3s ease;
}

.navbar-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 var(--space-6);
  height: 72px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-wrapper-inner {
  display: flex;
  align-items: center;
  flex: 1;
  justify-content: space-between;
  margin-left: var(--space-12);
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  color: var(--color-text-primary);
  font-weight: 800;
  font-size: 1.35rem;
  letter-spacing: -0.03em;
  transition: opacity 0.2s;
}
.navbar-brand:hover {
  opacity: 0.8;
}

.brand-logo {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark, #1e40af));
  color: white;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
}

.main-nav {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background-color: rgba(0,0,0,0.03);
  padding: 4px;
  border-radius: var(--radius-full);
}

.nav-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-full);
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-accent);
}

.nav-link.is-active {
  color: var(--color-primary);
  background-color: var(--color-bg-surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.admin-link.is-active {
  color: var(--color-danger);
}

.auth-nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-left: auto;
}

.theme-toggle-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-size: 1.2rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  margin-right: 0.5rem;
}

.theme-toggle-btn:hover {
  background-color: var(--color-bg-accent);
  transform: scale(1.1);
}

/* Auth Buttons */
.nav-btn-ghost {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-weight: 600;
  padding: 0.5rem 1rem;
  transition: color 0.2s;
  font-size: 0.95rem;
}
.nav-btn-ghost:hover {
  color: var(--color-text-primary);
}

.nav-btn-primary {
  background-color: var(--color-primary);
  color: white;
  text-decoration: none;
  font-weight: 600;
  padding: 0.6rem 1.5rem;
  border-radius: var(--radius-full);
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
  font-size: 0.95rem;
}
.nav-btn-primary:hover {
  background-color: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
}

/* User Menu */
.user-menu {
  position: relative;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  padding: 4px 4px 4px 16px;
  border-radius: var(--radius-full);
  transition: all 0.2s;
}

.user-trigger:hover, .user-trigger[aria-expanded="true"] {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-primary);
}

.user-info-text {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}

.user-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.user-role-label {
  font-size: 0.7rem;
  color: var(--color-primary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.user-avatar {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, var(--color-text-primary), #4a5568);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Dropdown */
.user-dropdown {
  position: absolute;
  top: 120%;
  right: 0;
  width: 260px;
  background-color: var(--color-bg-surface);
  border-radius: var(--radius-xl);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--color-border);
  padding: var(--space-2);
  z-index: 2000;
  transform-origin: top right;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease-out;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px) scale(0.95);
  opacity: 0;
}

.dropdown-header {
  padding: var(--space-4);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.dropdown-avatar-large {
  width: 48px;
  height: 48px;
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  box-shadow: var(--shadow-sm);
}

.dropdown-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropdown-name {
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap; 
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-email {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  white-space: nowrap; 
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-divider {
  height: 1px;
  background-color: var(--color-border);
  margin: var(--space-2) 0;
  opacity: 0.5;
}

.dropdown-item {
  width: 100%;
  text-align: left;
  padding: var(--space-3);
  background: none;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-secondary);
}

.dropdown-item:hover {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

.text-danger {
  color: var(--color-danger);
}

.app-content {
  flex: 1;
  width: 100%;
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .navbar-wrapper {
    height: auto;
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-4);
  }
  .nav-wrapper-inner {
    margin-left: 0;
    width: 100%;
    margin-top: var(--space-3);
    order: 2;
    overflow-x: auto;
    padding-bottom: 5px;
  }
  .main-nav {
     flex: 1;
     justify-content: space-between; 
  }
  .user-info-text {
     display: none;
  }
  .user-trigger {
     padding: 2px;
     border: none;
  }
}
</style>



