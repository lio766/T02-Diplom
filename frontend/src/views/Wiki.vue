<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, tm, rt } = useI18n()

const activeTopic = ref('booking')
const openFaqIndex = ref(null)

function toggleFaq(index) {
  openFaqIndex.value = openFaqIndex.value === index ? null : index
}

const groupedFaqs = computed(() => {
  const items = tm('wiki.faqItems') || []
  const groups = {}
  
  items.forEach((item, index) => {
      const catKey = rt(item.cat)
      if (!groups[catKey]) groups[catKey] = []
      // We store the original global index to keep open state working correctly
      groups[catKey].push({ ...item, originalIndex: index })
  })
  
  return groups
})

const topics = [
  { id: 'booking', titleKey: 'wiki.topics.booking' },
  { id: 'calendar', titleKey: 'wiki.topics.calendar' },
  { id: 'admin', titleKey: 'wiki.topics.admin' },
  { id: 'faq', titleKey: 'wiki.topics.faq' }
]
</script>

<template>
  <div class="wiki-page">
    <div class="wiki-container">
      <aside class="wiki-sidebar">
        <h3 class="sidebar-title">{{ $t('wiki.title') }}</h3>
        <ul class="topic-list">
          <li v-for="topic in topics" :key="topic.id">
            <button 
              class="topic-btn" 
              :class="{ active: activeTopic === topic.id }"
              @click="activeTopic = topic.id"
            >
              {{ $t(topic.titleKey) }}
            </button>
          </li>
        </ul>
      </aside>
      
      <main class="wiki-content">
        <div v-if="activeTopic === 'booking'" class="wiki-article fade-in">
           <h2 class="article-title">{{ $t('wiki.topics.booking') }}</h2>
           <p class="intro-text">Lerne, wie du schnell und einfach Räume buchst.</p>
           
           <div class="tutorial-step">
              <h4>1. Zeitraum wählen</h4>
              <div class="skeleton-block text"></div>
               <div class="skeleton-block image">
                  <span>{{ t('wiki.placeholders.image') }} - Kalenderansicht</span>
               </div>
           </div>
           
            <div class="tutorial-step">
              <h4>2. Details eingeben</h4>
              <div class="skeleton-block video">
                  <span>▶️ {{ t('wiki.placeholders.video') }} - Formular ausfüllen</span>
               </div>
               <div class="skeleton-block text short"></div>
           </div>
        </div>
        
         <div v-if="activeTopic === 'calendar'" class="wiki-article fade-in">
           <h2 class="article-title">{{ $t('wiki.topics.calendar') }}</h2>
           <p class="intro-text">Alles über die Kalenderfunktionen.</p>
           
           <div class="tutorial-step">
               <div class="skeleton-block video">
                  <span>▶️ {{ t('wiki.placeholders.video') }} - Overview</span>
               </div>
               <div class="skeleton-block text"></div>
               <div class="skeleton-block text"></div>
           </div>
        </div>
        
         <div v-if="activeTopic === 'admin'" class="wiki-article fade-in">
           <h2 class="article-title">{{ $t('wiki.topics.admin') }}</h2>
            <div class="skeleton-block text"></div>
            <div class="skeleton-block image">
                <span>{{ t('wiki.placeholders.image') }} - Admin Dashboard</span>
            </div>
            <div class="skeleton-block text"></div>
        </div>

        <div v-if="activeTopic === 'faq'" class="wiki-article fade-in">
           <h2 class="article-title">{{ $t('wiki.topics.faq') }}</h2>
           
           <div class="faq-list">
              <div v-for="(categoryItems, categoryKey) in groupedFaqs" :key="categoryKey" class="faq-category-group">
                <h3 class="faq-category-title">{{ t(`wiki.faqCategories.${categoryKey}`) }}</h3>
                <div 
                  v-for="item in categoryItems" 
                  :key="item.originalIndex" 
                  class="faq-item"
                  :class="{ 'is-open': openFaqIndex === item.originalIndex }"
                >
                  <button class="faq-question-btn" @click="toggleFaq(item.originalIndex)">
                    <span class="question-text">{{ rt(item.q) }}</span>
                    <span class="chevron">▼</span>
                  </button>
                  <div class="faq-answer-wrapper" :style="{ maxHeight: openFaqIndex === item.originalIndex ? '200px' : '0' }">
                     <p class="faq-answer">{{ rt(item.a) }}</p>
                  </div>
                </div>
             </div>
           </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.wiki-page { 
  display: flex;
  flex: 1;
  padding: var(--space-6);
  background-color: var(--color-bg-secondary);
}

.wiki-container { 
  display: flex; 
  gap: var(--space-8); 
  width: 100%;
  max-width: 1200px; 
  margin: 0 auto; 
  align-items: flex-start;
}

.wiki-sidebar { 
  width: 280px; 
  flex-shrink: 0; 
  background-color: var(--color-bg-surface);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  position: sticky;
  top: 100px;
}

.sidebar-title {
  margin-bottom: var(--space-4);
  font-size: 1.1rem;
  color: var(--color-text-primary);
  padding-bottom: var(--space-2);
  border-bottom: 2px solid var(--color-primary);
}

.topic-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.topic-btn { 
  display: block; 
  width: 100%; 
  text-align: left; 
  padding: 12px 16px; 
  background: none; 
  border: none; 
  cursor: pointer; 
  border-radius: var(--radius-lg); 
  color: var(--color-text-secondary); 
  font-weight: 500;
  transition: all 0.2s ease;
  margin-bottom: 4px;
}

.topic-btn:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.topic-btn.active { 
  background: var(--color-bg-accent); 
  color: var(--color-primary); 
  font-weight: 700; 
}

.wiki-content { 
  flex: 1; 
  background: var(--color-bg-surface); 
  padding: var(--space-8); 
  border-radius: var(--radius-xl); 
  box-shadow: var(--shadow-sm); 
  border: 1px solid var(--color-border); 
  min-height: 500px;
}

.article-title {
  font-size: 2rem;
  margin-bottom: var(--space-4);
  color: var(--color-text-primary);
}

.intro-text {
  font-size: 1.1rem;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-8);
}

.tutorial-step {
  margin-bottom: var(--space-8);
}

.tutorial-step h4 {
  margin-bottom: var(--space-3);
  color: var(--color-text-primary);
}

.faq-category-group {
  margin-bottom: var(--space-6);
}

.faq-category-title {
  font-size: 1.2rem;
  color: var(--color-primary);
  margin-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-2);
}

.faq-item {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-3);
  overflow: hidden;
  transition: all 0.3s ease;
}

.faq-question-btn {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-primary);
  font-size: 1rem;
}

.faq-question-btn:hover {
  background-color: rgba(0,0,0,0.02);
}

.chevron {
  transition: transform 0.3s ease;
  opacity: 0.5;
}

.faq-item.is-open .chevron {
  transform: rotate(180deg);
  opacity: 1;
}

.faq-answer-wrapper {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
}

.faq-answer {
  padding: 0 var(--space-4) var(--space-4) var(--space-4);
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* Skeletons */
.skeleton-block {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
  animation: pulse 2s infinite;
}

.skeleton-block.text {
  height: 1rem;
  width: 100%;
  margin-bottom: 0.8rem;
}

.skeleton-block.text.short {
  width: 60%;
}

.skeleton-block.image {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  border: 2px dashed var(--color-border);
  background: var(--color-bg-secondary);
}

.skeleton-block.video {
  height: 400px;
  background: #1a202c;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  border-radius: var(--radius-lg);
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 0.8; }
  100% { opacity: 0.6; }
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .wiki-container {
    flex-direction: column;
  }
  .wiki-sidebar {
    width: 100%;
    position: static;
  }
}
</style>
