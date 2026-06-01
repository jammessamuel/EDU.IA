import { createRouter, createWebHistory } from 'vue-router'
import SimulatorView from '../views/SimulatorView.vue'
import LoginView from '../views/LoginView.vue'
import KanbanView from '../views/KanbanView.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'simulator',
      component: SimulatorView,
      meta: { requiresAuth: true },
    },
    {
      path: '/kanban',
      name: 'kanban',
      component: KanbanView,
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('eduia_token')
  if (to.meta.requiresAuth && !token) return { name: 'login' }
  if (to.name === 'login' && token) return { name: 'simulator' }
})

export default router
