const routes = [
  // Public routes (no authentication required)
  {
    path: '/login',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      { 
        path: '', 
        component: () => import('pages/LoginPage.vue'),
        meta: { requiresAuth: false }
      }
    ]
  },

  // Protected routes (require authentication)
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { 
        path: '', 
        component: () => import('pages/ChatPage.vue'),
        meta: { requiresAuth: true, requiresOnboarding: true }
      },
      { 
        path: 'dashboard', 
        component: () => import('pages/DashboardPage.vue'),
        meta: { requiresAuth: true, requiresOnboarding: true }
      },
      { 
        path: 'chat', 
        component: () => import('pages/ChatPage.vue'),
        meta: { requiresAuth: true, requiresOnboarding: true }
      },
      { 
        path: 'tasks', 
        component: () => import('pages/TaskListPage.vue'),
        meta: { requiresAuth: true, requiresOnboarding: true }
      },
      { 
        path: 'tasks/new', 
        component: () => import('pages/TaskCreatePage.vue'),
        meta: { requiresAuth: true, requiresOnboarding: true }
      },
      { 
        path: 'tasks/:id', 
        component: () => import('pages/TaskDetailPage.vue'),
        meta: { requiresAuth: true, requiresOnboarding: true }
      }
    ]
  },

  // Onboarding route (requires auth but not onboarding completion)
  {
    path: '/onboarding',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        component: () => import('pages/OnboardingPage.vue'),
        meta: { requiresAuth: true, requiresOnboarding: false }
      }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
