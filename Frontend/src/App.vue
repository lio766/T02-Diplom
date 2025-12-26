<script setup>
// App shell: global navigation & routed content
</script>

<template>
  <div class="shell">
    <nav class="nav">
      <a class="brand" href="/">Raumbuchung</a>
      <div class="links">
        <RouterLink to="/" class="link">Start</RouterLink>
        <RouterLink to="/login" class="link">Login</RouterLink>
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
