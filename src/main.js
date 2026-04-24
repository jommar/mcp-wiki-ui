import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './style.css';

const routes = [
  { path: '/', redirect: '/graph' },
  { path: '/graph', name: 'graph', component: () => import('./views/KnowledgeGraph.vue') },
  { path: '/search', name: 'search', component: () => import('./views/SearchDashboard.vue') },
  { path: '/topics', name: 'topics', component: () => import('./views/TopicTree.vue') },
  { path: '/health', name: 'health', component: () => import('./views/HealthReport.vue') },
  { path: '/stats', name: 'stats', component: () => import('./views/StatsDashboard.vue') },
  { path: '/section/:key', name: 'section', component: () => import('./views/SectionViewer.vue') },
];

const router = createRouter({ history: createWebHistory(), routes });

createApp(App).use(router).mount('#app');
