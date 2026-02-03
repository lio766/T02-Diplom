<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useKeycloak } from '@josempgon/vue-keycloak';
const { isPending, isAuthenticated, error, username, userId, keycloak, roles, hasRoles } = useKeycloak();

</script>

<template>
  <div class="shell">
    <nav class="nav">
      <a class="brand" href="/">Raumbuchung</a>
      <div class="links">
        <RouterLink to="/" class="link">Start</RouterLink>
        <RouterLink v-if="!isAuthenticated" to="/login" class="link">Login</RouterLink>
        <RouterLink v-if="!isAuthenticated" to="/register" class="link">Registrieren</RouterLink>
        <RouterLink to="/booking" class="link">Buchen</RouterLink>
        <RouterLink to="/calendar" class="link">Kalender</RouterLink>
        <RouterLink v-if="hasRoles(['genehmiger'])"to="/admin" class="link">Admin</RouterLink>
        <p>{{ username }}</p>
              <button @click="keycloak.logout">Logout</button> 
      </div>
    </nav>
    <RouterView />
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; background: #0f172a; }
.nav { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #0b1222; border-bottom: 1px solid #1f2937; }
.brand { color: #e5e7eb; text-decoration: none; font-weight: 700; }
.links { display: flex; gap: 0.75rem; }
.link { color: #94a3b8; text-decoration: none; }
.link.router-link-active { color: #42b883; font-weight: 600; }
</style>
