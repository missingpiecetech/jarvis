import { defineRouter } from '#q-app/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes'
import { useAuthStore } from 'src/stores/auth'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  // Navigation guards for authentication
  Router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()
    
    // Wait for auth store to initialize
    await authStore.initialize()
    
    // Check if route requires authentication
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      // Redirect to login if not authenticated
      next('/login')
      return
    }
    
    // Check if user is authenticated but trying to access login page
    if (to.path === '/login' && authStore.isAuthenticated) {
      // Redirect to chat if already authenticated
      next('/')
      return
    }
    
    // Check if route requires completed onboarding
    if (to.meta.requiresOnboarding && authStore.isAuthenticated && !authStore.hasCompletedOnboarding) {
      // Redirect to onboarding if not completed
      next('/onboarding')
      return
    }
    
    // Check if user is trying to access onboarding but already completed it
    if (to.path === '/onboarding' && authStore.isAuthenticated && authStore.hasCompletedOnboarding) {
      // Redirect to chat if onboarding already completed
      next('/')
      return
    }
    
    next()
  })

  return Router
})
