<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getToken, useKeycloak } from '@josempgon/vue-keycloak';
const { decodedToken, isPending, isAuthenticated, error, username, keycloak, hasRoles } = useKeycloak();
const router = useRouter()
const showDropdown = ref(false)

onMounted(async () => {
  if(isAuthenticated.value){
    console.log('User is authenticated');
    const token = await getToken();
    console.log('Initial token:', token);
  }
})

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
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

const isLoggedIn = computed(() => {
  return isAuthenticated.value
})

const userDisplay = computed(() => {
  return decodedToken.value?.name || username;
})

const userInitials = computed(() => {
    let name = String(userDisplay.value) || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
})

const userEmail = computed(() => {
    return decodedToken.value?.email || '';
})

const isAdmin = computed(() => {
    console.log('Is Admin:', hasRoles(['administrator']));
    return hasRoles(['administrator']);
})

const isGenehmiger = computed(() => {
    console.log('Is Genehmiger:', hasRoles(['genehmiger']));
    return hasRoles(['genehmiger']);
})

</script>

<template>
  <div class="app">
    <nav class="navbar">
      <div class="navbar-wrapper">
        <RouterLink to="/" class="navbar-brand">
          <div class="brand-logo">🏛️</div>
          <span class="brand-text">AGORA</span>
        </RouterLink>
        
        <!-- Private Navigation -->
        <div class="nav-wrapper-inner">
          <div class="main-nav" v-if="isLoggedIn">
             <RouterLink to="/" class="nav-link" active-class="is-active" exact>Dashboard</RouterLink>
             <RouterLink to="/booking" class="nav-link" active-class="is-active">Buchen</RouterLink>
             <RouterLink to="/calendar" class="nav-link" active-class="is-active">Kalender</RouterLink>
             <RouterLink v-if="isAdmin" to="/admin" class="nav-link admin-link" active-class="is-active">Admin</RouterLink>
          </div>
  
          <div class="auth-nav">
  
            <div class="user-menu" ref="userMenuRef">
              <button class="user-trigger" @click="toggleDropdown" aria-label="Benutzermenü öffnen" :aria-expanded="showDropdown">
                <div class="user-info-text">
                  <span class="user-name">{{ userDisplay }}</span>
                  <span class="user-role-label" v-if="isAdmin">Admin</span>
                  <span class="user-role-label" v-if="isGenehmiger">Genehmiger</span>
                </div>
                <div class="user-avatar">{{ userInitials }}</div>
              </button>
  
              <Transition name="slide-fade">
                <div v-show="showDropdown" class="user-dropdown">
                   <div class="dropdown-header">
                      <div class="dropdown-avatar-large">{{ userInitials }}</div>
                      <div class="dropdown-info">
                         <span class="dropdown-name">{{ userDisplay }}</span>
                         <span class="dropdown-email">{{ userEmail }}</span>
                      </div>
                   </div>
                   <div class="dropdown-divider"></div>
                   <button @click="keycloak.logout" class="dropdown-item text-danger">
                      <span>🚪</span> Abmelden
                   </button>
                </div>
              </Transition>
            </div>
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
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0,0,0,0.05);
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
  background-color: rgba(255,255,255,0.5);
}

.nav-link.is-active {
  color: var(--color-primary);
  background-color: white;
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
  background: white;
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
  background-color: white;
  border-radius: var(--radius-xl);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0,0,0,0.05);
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
  background: white;
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



