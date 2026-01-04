<script setup>
// Landing page view
</script>

<template>
  <main class="landing">
    <header class="header">
      <img src="../assets/vue.svg" alt="Logo" class="brand" />
      <h1 class="title">Raumbuchungssoftware</h1>
      <p class="subtitle">Einfach Räume planen, buchen und verwalten.</p>
      <div class="cta">
        <RouterLink class="btn primary" to="/login">Jetzt starten</RouterLink>
        <a class="btn ghost" href="#features">Mehr erfahren</a>
      </div>
    </header>

    <section id="features" class="features">
      <article class="feature">
        <h3>Schnelle Buchung</h3>
        <p>Buchen Sie Räume in Sekunden mit einer klaren, intuitiven Oberfläche.</p>
      </article>
      <article class="feature">
        <h3>Kalender & Übersicht</h3>
        <p>Behalten Sie Belegungen im Kalender-Layout jederzeit im Blick.</p>
      </article>
      <article class="feature">
        <h3>Rollen & Rechte</h3>
        <p>Administratoren steuern Zugriffe und verwalten Ressourcen zentral.</p>
      </article>
      <article class="feature">
        <h3>Benachrichtigungen</h3>
        <p>E-Mail-Erinnerungen und Bestätigungen halten alle auf dem Laufenden.</p>
      </article>
    </section>

    <section id="start" class="secondary">
      <h2>Bereit? Legen wir los.</h2>
      <p>
        Dies ist die Landing Page Ihrer Raumbuchungs-App. Als Nächstes können
        wir die Anmeldung und die eigentliche Buchungsansicht einrichten.
      </p>
      <RouterLink class="btn primary" to="/login">Anmelden</RouterLink>
    </section>
  </main>
</template>

<style scoped>
:root {
  --bg: #0f172a;
  --card: #111827;
  --text: #e5e7eb;
  --muted: #94a3b8;
  --primary: #42b883;
  --primary-contrast: #0a0f1e;
}

.landing { min-height: 100vh; background: radial-gradient(1200px 500px at 10% 0%, #1e293b 0%, var(--bg) 60%); color: var(--text); display: grid; grid-template-rows: auto auto 1fr; gap: 3rem; padding: 4rem 1.5rem 6rem; }
.header { text-align: center; max-width: 980px; margin: 0 auto; }
.brand { width: 64px; height: 64px; opacity: 0.9; filter: drop-shadow(0 0 1.5rem rgba(66, 184, 131, 0.35)); }
.title { font-size: clamp(2rem, 5vw, 3.5rem); margin: 0.75rem 0 0.5rem; }
.subtitle { font-size: clamp(1rem, 2.5vw, 1.25rem); color: var(--muted); }
.cta { margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center; }
.btn { display: inline-block; padding: 0.8rem 1.15rem; border-radius: 0.6rem; text-decoration: none; font-weight: 600; }
.btn.primary { background: var(--primary); color: var(--primary-contrast); }
.btn.ghost { outline: 1px solid #334155; color: var(--text); }
.btn:hover { opacity: 0.95; }
.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; max-width: 1100px; margin: 0 auto; }
.feature { background: var(--card); border: 1px solid #1f2937; border-radius: 0.75rem; padding: 1rem 1rem 1.25rem; }
.secondary { text-align: center; max-width: 980px; margin: 0 auto; }
</style>
