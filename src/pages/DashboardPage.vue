<template>
  <q-page class="q-pa-lg">
    <div class="row q-gutter-lg">
      <!-- Welcome Header -->
      <div class="col-12">
        <q-card class="bg-primary text-white">
          <q-card-section>
            <div class="text-h4">Welcome back, {{ authStore.user?.fullName || authStore.user?.name }}!</div>
            <div class="text-subtitle1">Your personal assistant is ready to help</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Quick Stats -->
      <div class="col-12">
        <div class="row q-gutter-md">
          <div class="col-md-3 col-sm-6 col-xs-12">
            <q-card class="text-center">
              <q-card-section>
                <q-icon name="schedule" size="48px" color="primary" />
                <div class="text-h6 q-mt-sm">Working Hours</div>
                <div class="text-body2 text-grey-6">
                  {{ authStore.user?.workingHours?.start || '09:00' }} - 
                  {{ authStore.user?.workingHours?.end || '17:00' }}
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-md-3 col-sm-6 col-xs-12">
            <q-card class="text-center">
              <q-card-section>
                <q-icon name="business" size="48px" color="secondary" />
                <div class="text-h6 q-mt-sm">Business Type</div>
                <div class="text-body2 text-grey-6">
                  {{ authStore.user?.businessType || 'Not specified' }}
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-md-3 col-sm-6 col-xs-12">
            <q-card class="text-center">
              <q-card-section>
                <q-icon name="calendar_today" size="48px" color="accent" />
                <div class="text-h6 q-mt-sm">Working Days</div>
                <div class="text-body2 text-grey-6">
                  {{ workingDaysCount }} days/week
                </div>
              </q-card-section>
            </q-card>
          </div>

          <div class="col-md-3 col-sm-6 col-xs-12">
            <q-card class="text-center">
              <q-card-section>
                <q-icon name="notifications" size="48px" color="positive" />
                <div class="text-h6 q-mt-sm">Notifications</div>
                <div class="text-body2 text-grey-6">
                  {{ authStore.user?.notifications ? 'Enabled' : 'Disabled' }}
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>

      <!-- Features Coming Soon -->
      <div class="col-12">
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">Features Coming Soon</div>
            <q-list>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="chat" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>AI Chat Assistant</q-item-label>
                  <q-item-label caption>Intelligent conversations with your personal assistant</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="task_alt" color="secondary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Task Management</q-item-label>
                  <q-item-label caption>Organize and track your tasks and projects</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="event" color="accent" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Calendar Integration</q-item-label>
                  <q-item-label caption>Sync with your favorite calendar applications</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section avatar>
                  <q-icon name="folder" color="warning" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Document Management</q-item-label>
                  <q-item-label caption>Store and organize your important documents</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <!-- User Profile Summary -->
      <div class="col-12">
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">Your Profile</div>
            <q-list>
              <q-item>
                <q-item-section>
                  <q-item-label>Email</q-item-label>
                  <q-item-label caption>{{ authStore.user?.email }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item v-if="authStore.user?.phone">
                <q-item-section>
                  <q-item-label>Phone</q-item-label>
                  <q-item-label caption>{{ authStore.user.phone }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section>
                  <q-item-label>Timezone</q-item-label>
                  <q-item-label caption>{{ authStore.user?.timezone }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item v-if="authStore.user?.goals">
                <q-item-section>
                  <q-item-label>Goals</q-item-label>
                  <q-item-label caption>{{ authStore.user.goals }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'

const authStore = useAuthStore()

const workingDaysCount = computed(() => {
  return authStore.user?.workingDays?.length || 5
})
</script>