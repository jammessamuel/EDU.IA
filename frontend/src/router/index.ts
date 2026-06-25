import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'simulator',
      component: () => import('../views/SimulatorView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/kanban',
      name: 'kanban',
      component: () => import('../views/KanbanView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/whatsapp',
      name: 'whatsapp',
      component: () => import('../views/WhatsAppView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/enrollments',
      name: 'enrollments',
      component: () => import('../views/EnrollmentsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/post-sales',
      name: 'post-sales',
      component: () => import('../views/PostSalesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/validar/:authCode',
      name: 'validate-enrollment',
      component: () => import('../views/ValidateEnrollmentView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const token = localStorage.getItem('eduia_token')
  if (to.meta.requiresAuth && !token) return { name: 'login' }
  if (to.name === 'login' && token) return { name: 'simulator' }
})

export default router
