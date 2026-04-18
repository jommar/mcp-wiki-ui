import { createRouter, createWebHistory } from 'vue-router';
import KnowledgeGraph from '../views/KnowledgeGraph.vue';
import SectionViewer from '../views/SectionViewer.vue';
import SearchDashboard from '../views/SearchDashboard.vue';
import TopicTree from '../views/TopicTree.vue';
import HealthReport from '../views/HealthReport.vue';
import StatsDashboard from '../views/StatsDashboard.vue';

const routes = [
  { path: '/', name: 'graph', component: KnowledgeGraph },
  { path: '/section/:sectionKey', name: 'section', component: SectionViewer, props: true },
  { path: '/search', name: 'search', component: SearchDashboard },
  { path: '/topics', name: 'topics', component: TopicTree },
  { path: '/health', name: 'health', component: HealthReport },
  { path: '/stats', name: 'stats', component: StatsDashboard },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
