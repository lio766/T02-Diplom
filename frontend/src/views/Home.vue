<script setup>
import { computed } from 'vue';
import {getToken, useKeycloak } from '@josempgon/vue-keycloak';
import { useI18n } from 'vue-i18n'
const {decodedToken, isPending, isAuthenticated, error, username, keycloak, hasRoles } = useKeycloak();
const isLoggedIn = computed(() => isAuthenticated.value);
console.log(decodedToken.value);
const userName = computed(() => decodedToken.value.name);
console.log('Aktueller Benutzer:', username.value);
console.log('Decoded Token:', decodedToken);

</script>

<template>
  <div class="home-page">
    
    <!-- DASHBOARD VIEW (LOGGED IN) -->
    <template v-if="isLoggedIn">
      <div class="container">
       <section class="dashboard-header">
          <div class="welcome-text">
             <h1>{{ $t('home.dashboard.welcome') }} <span class="highlight">{{ userName }}</span>! 👋</h1>
             <p>{{ $t('home.dashboard.whatToDo') }}</p>
          </div>
       </section>

       <section class="dashboard-grid">
          <RouterLink to="/booking" class="dash-card primary-card">
             <div class="card-icon">📅</div>
             <div class="card-content">
                <h3>{{ $t('home.dashboard.bookRoom') }}</h3>
                <p>{{ $t('home.dashboard.bookRoomDesc') }}</p>
             </div>
             <div class="card-arrow">→</div>
          </RouterLink>

          <RouterLink to="/calendar" class="dash-card">
             <div class="card-icon">👀</div>
             <div class="card-content">
                <h3>{{ $t('home.dashboard.calendarOverview') }}</h3>
                <p>{{ $t('home.dashboard.calendarOverviewDesc') }}</p>
             </div>
          </RouterLink>

          <!-- Admin Card (conditional) -->
          <RouterLink v-if="user?.rollen_id === 2" to="/admin" class="dash-card admin-card">
             <div class="card-icon">⚙️</div>
             <div class="card-content">
                <h3>{{ $t('home.dashboard.administration') }}</h3>
                <p>{{ $t('home.dashboard.administrationDesc') }}</p>
             </div>
          </RouterLink>
       </section>
      </div>
    </template>

    <!-- LANDING VIEW (LOGGED OUT) -->
    <template v-else>
      <section class="hero-section">
        <div class="container hero-grid">
          <div class="hero-content">
          <div class="badge">{{ $t('home.landing.badge') }}</div>
          <h1 class="hero-title">
            {{ $t('home.landing.title') }} <br>
            <span class="text-gradient">{{ $t('home.landing.titleSuffix') }}</span>
          </h1>
          <p class="hero-subtitle">
            {{ $t('home.landing.subtitle') }}
          </p>
          <div class="hero-actions">
            <RouterLink to="/login" class="btn btn-primary btn-lg">{{ $t('home.landing.ctaStart') }}</RouterLink>
            <RouterLink to="/register" class="btn btn-text">{{ $t('home.landing.ctaRegister') }}</RouterLink>
          </div>
        </div>
        <div class="hero-visual">
           <div class="floating-card c1">
              <span>📅 {{ $t('home.landing.floating.room') }}</span>
              <small>14:00 - 15:30</small>
           </div>
           <div class="floating-card c2">
              <span>✅ {{ $t('home.landing.floating.confirmed') }}</span>
           </div>
           <div class="hero-blob"></div>
        </div>
      </div>
      </section>

      <section class="features-section">
         <div class="container features-grid">
         <div class="feature-item">
            <div class="f-icon">⚡</div>
            <h3>{{ $t('home.features.fast') }}</h3>
            <p>{{ $t('home.features.fastDesc') }}</p>
         </div>
         <div class="feature-item">
            <div class="f-icon">📱</div>
            <h3>{{ $t('home.features.mobile') }}</h3>
            <p>{{ $t('home.features.mobileDesc') }}</p>
         </div>
         <div class="feature-item">
            <div class="f-icon">🔒</div>
            <h3>{{ $t('home.features.secure') }}</h3>
            <p>{{ $t('home.features.secureDesc') }}</p>
         </div>
         </div>
      </section>
    </template>

  </div>
</template>

<style scoped>
.home-page {
  width: 100%;
}

/* Dashboard Styles */
.dashboard-header {
  margin-bottom: var(--space-8);
  text-align: left;
  padding-top: var(--space-8);
}

.dashboard-header h1 {
  font-size: 2.5rem;
  margin-bottom: var(--space-2);
  letter-spacing: -0.05em;
}

.highlight {
  color: var(--color-primary);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

.dash-card {
  background-color: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  text-decoration: none;
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.dash-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-light);
}

.card-icon {
  font-size: 2rem;
  background-color: var(--color-bg-secondary);
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
}

.card-content h3 {
  margin: 0 0 var(--space-2) 0;
  font-size: 1.25rem;
}

.card-content p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.5;
}

.primary-card {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.primary-card .card-content p {
  color: rgba(255,255,255, 0.9);
}

.primary-card .card-icon {
  background-color: rgba(255,255,255, 0.2);
}

.primary-card:hover {
  background-color: var(--color-primary-dark);
}

.card-arrow {
  position: absolute;
  bottom: var(--space-6);
  right: var(--space-6);
  font-size: 1.5rem;
  opacity: 0.5;
}

/* Landing Page Styles */
.hero-section {
  width: 100%;
  padding: var(--space-12) 0;
  /* background-color: var(--color-bg-secondary); */
}

.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: var(--space-8);
}

.badge {
  display: inline-block;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  padding: 4px 12px;
  border-radius: 99px;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: var(--space-4);
}

.hero-title {
  font-size: 3.5rem;
  line-height: 1.1;
  margin-bottom: var(--space-6);
  letter-spacing: -0.03em;
}

.text-gradient {
  background: linear-gradient(135deg, var(--color-primary) 0%, #60a5fa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-8);
  max-width: 500px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.btn-lg {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}

/* Hero Visual */
.hero-visual {
  position: relative;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-blob {
  position: absolute;
  width: 300px;
  height: 300px;
  background: linear-gradient(45deg, var(--color-primary-light), #e0e7ff);
  border-radius: 50%;
  filter: blur(60px);
  z-index: 0;
  opacity: 0.6;
}

.floating-card {
  position: absolute;
  background: var(--color-bg-primary);
  padding: 1rem 1.5rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(0,0,0,0.05);
  font-weight: 600;
  z-index: 1;
  display: flex;
  flex-direction: column;
  animation: float 6s ease-in-out infinite;
}

.floating-card small {
  font-weight: 400;
  color: var(--color-text-muted);
}

.c1 {
  top: 20%;
  right: 10%;
  transform: rotate(5deg);
}

.c2 {
  bottom: 25%;
  left: 10%;
  animation-delay: 2s;
  padding: 0.75rem 1.5rem;
  color: var(--color-success);
}

@keyframes float {
  0% { transform: translateY(0px) rotate(5deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
  100% { transform: translateY(0px) rotate(5deg); }
}

/* Features */
.features-section {
  width: 100%;
  margin-top: var(--space-12);
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-12);
  padding-bottom: var(--space-12);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-8);
}

.feature-item {
  text-align: center;
}

.f-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-4);
}

.feature-item h3 {
  font-size: 1.25rem;
  margin-bottom: var(--space-2);
}

.feature-item p {
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .hero-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .hero-actions {
    justify-content: center;
  }
  .hero-visual {
    display: none;
  }
  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>


