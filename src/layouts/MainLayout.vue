<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title>
          Jarvis
        </q-toolbar-title>

        <div v-if="authStore.isAuthenticated" class="q-gutter-sm">
          <q-btn
            flat
            round
            dense
            icon="account_circle"
            @click="showUserMenu = true"
          />
          <q-btn
            flat
            round
            dense
            icon="logout"
            @click="handleLogout"
          />
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
    >
      <q-list>
        <q-item-label header>
          {{ authStore.isAuthenticated ? 'Navigation' : 'Essential Links' }}
        </q-item-label>

        <template v-if="authStore.isAuthenticated">
          <q-item clickable v-ripple @click="$router.push('/')">
            <q-item-section avatar>
              <q-icon name="dashboard" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Dashboard</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-ripple disabled>
            <q-item-section avatar>
              <q-icon name="chat" />
            </q-item-section>
            <q-item-section>
              <q-item-label>AI Chat</q-item-label>
              <q-item-label caption>Coming Soon</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-ripple @click="$router.push('/tasks')">
            <q-item-section avatar>
              <q-icon name="task_alt" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Tasks</q-item-label>
              <q-item-label caption>Manage your tasks</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-ripple disabled>
            <q-item-section avatar>
              <q-icon name="event" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Calendar</q-item-label>
              <q-item-label caption>Coming Soon</q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable v-ripple disabled>
            <q-item-section avatar>
              <q-icon name="folder" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Documents</q-item-label>
              <q-item-label caption>Coming Soon</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator class="q-my-md" />

          <q-item clickable v-ripple disabled>
            <q-item-section avatar>
              <q-icon name="settings" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Settings</q-item-label>
              <q-item-label caption>Coming Soon</q-item-label>
            </q-item-section>
          </q-item>
        </template>

        <template v-else>
          <EssentialLink
            v-for="link in linksList"
            :key="link.title"
            v-bind="link"
          />
        </template>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- User Menu Dialog -->
    <q-dialog v-model="showUserMenu">
      <q-card style="min-width: 300px">
        <q-card-section class="text-center">
          <q-avatar size="64px" color="primary" text-color="white" icon="account_circle" />
          <div class="text-h6 q-mt-md">{{ authStore.user?.fullName || authStore.user?.name }}</div>
          <div class="text-body2 text-grey-6">{{ authStore.user?.email }}</div>
        </q-card-section>

        <q-card-section>
          <q-list>
            <q-item clickable v-ripple disabled>
              <q-item-section avatar>
                <q-icon name="person" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Profile</q-item-label>
                <q-item-label caption>Coming Soon</q-item-label>
              </q-item-section>
            </q-item>

            <q-item clickable v-ripple disabled>
              <q-item-section avatar>
                <q-icon name="settings" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Settings</q-item-label>
                <q-item-label caption>Coming Soon</q-item-label>
              </q-item-section>
            </q-item>

            <q-separator />

            <q-item clickable v-ripple @click="handleLogout">
              <q-item-section avatar>
                <q-icon name="logout" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Logout</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import EssentialLink from 'components/EssentialLink.vue'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()

const leftDrawerOpen = ref(false)
const showUserMenu = ref(false)

const toggleLeftDrawer = () => {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

const handleLogout = () => {
  authStore.logout()
  showUserMenu.value = false
  $q.notify({
    type: 'positive',
    message: 'Logged out successfully',
    position: 'top'
  })
  router.push('/login')
}

const linksList = [
  {
    title: 'Docs',
    caption: 'quasar.dev',
    icon: 'school',
    link: 'https://quasar.dev'
  },
  {
    title: 'Github',
    caption: 'github.com/quasarframework',
    icon: 'code',
    link: 'https://github.com/quasarframework'
  },
  {
    title: 'Discord Chat Channel',
    caption: 'chat.quasar.dev',
    icon: 'chat',
    link: 'https://chat.quasar.dev'
  },
  {
    title: 'Forum',
    caption: 'forum.quasar.dev',
    icon: 'record_voice_over',
    link: 'https://forum.quasar.dev'
  },
  {
    title: 'Twitter',
    caption: '@quasarframework',
    icon: 'rss_feed',
    link: 'https://twitter.quasar.dev'
  },
  {
    title: 'Facebook',
    caption: '@QuasarFramework',
    icon: 'public',
    link: 'https://facebook.quasar.dev'
  },
  {
    title: 'Quasar Awesome',
    caption: 'Community Quasar projects',
    icon: 'favorite',
    link: 'https://awesome.quasar.dev'
  }
]
</script>
