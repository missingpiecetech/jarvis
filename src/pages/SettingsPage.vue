<template>
  <q-page class="q-pa-md">
    <!-- Header -->
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-h4">Settings</div>
        <div class="text-subtitle1 text-grey-6">Manage your preferences and integrations</div>
      </div>
    </div>

    <!-- Settings Tabs -->
    <q-card>
      <q-tabs
        v-model="activeTab"
        dense
        class="text-grey"
        active-color="primary"
        indicator-color="primary"
        align="justify"
        narrow-indicator
      >
        <q-tab name="general" label="General" />
        <q-tab name="calendar" label="Calendar" />
        <q-tab name="notifications" label="Notifications" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="activeTab" animated>
        <!-- General Settings -->
        <q-tab-panel name="general">
          <div class="text-h6">General Settings</div>
          <div class="q-mt-md">
            <!-- User Profile -->
            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="text-subtitle1">Profile Information</div>
                <div class="q-mt-md">
                  <q-input
                    v-model="userSettings.fullName"
                    label="Full Name"
                    outlined
                    class="q-mb-md"
                  />
                  <q-input
                    v-model="userSettings.email"
                    label="Email"
                    outlined
                    readonly
                    class="q-mb-md"
                  />
                  <q-select
                    v-model="userSettings.timezone"
                    label="Timezone"
                    outlined
                    :options="timezoneOptions"
                    class="q-mb-md"
                  />
                </div>
              </q-card-section>
            </q-card>

            <!-- Working Hours -->
            <q-card flat bordered class="q-mb-md">
              <q-card-section>
                <div class="text-subtitle1">Working Hours</div>
                <div class="row q-gutter-md q-mt-md">
                  <div class="col">
                    <q-time
                      v-model="userSettings.workingHours.start"
                      label="Start Time"
                      format24h
                    />
                  </div>
                  <div class="col">
                    <q-time
                      v-model="userSettings.workingHours.end"
                      label="End Time"
                      format24h
                    />
                  </div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </q-tab-panel>

        <!-- Calendar Settings -->
        <q-tab-panel name="calendar">
          <div class="text-h6">Calendar Integrations</div>
          <div class="text-body2 text-grey-6 q-mb-md">
            Connect your external calendars to sync events automatically.
          </div>

          <!-- Google Calendar Integration -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="row items-center q-mb-md">
                <q-icon name="event" size="32px" color="red" class="q-mr-md" />
                <div class="col">
                  <div class="text-h6">Google Calendar</div>
                  <div class="text-body2 text-grey-6">
                    Sync events with your Google Calendar
                  </div>
                </div>
                <div class="col-auto">
                  <q-chip
                    :color="googleCalendarStatus.connected ? 'positive' : 'grey'"
                    :text-color="googleCalendarStatus.connected ? 'white' : 'black'"
                    :icon="googleCalendarStatus.connected ? 'check_circle' : 'circle'"
                  >
                    {{ googleCalendarStatus.connected ? 'Connected' : 'Not Connected' }}
                  </q-chip>
                </div>
              </div>

              <div class="row q-gutter-md">
                <q-btn
                  v-if="!googleCalendarStatus.connected"
                  color="primary"
                  label="Connect Google Calendar"
                  icon="link"
                  @click="connectGoogleCalendar"
                  :loading="googleCalendarLoading"
                />
                <q-btn
                  v-else
                  color="negative"
                  label="Disconnect"
                  icon="link_off"
                  @click="disconnectGoogleCalendar"
                  :loading="googleCalendarLoading"
                />
                
                <q-btn
                  v-if="googleCalendarStatus.connected"
                  color="secondary"
                  label="Sync Now"
                  icon="sync"
                  @click="syncGoogleCalendar"
                  :loading="syncLoading"
                />
              </div>

              <!-- Configuration -->
              <div v-if="showGoogleConfig" class="q-mt-md">
                <q-separator class="q-mb-md" />
                <div class="text-subtitle2 q-mb-md">Configuration</div>
                <q-input
                  v-model="googleConfig.clientId"
                  label="Google Client ID"
                  outlined
                  type="password"
                  class="q-mb-md"
                  hint="Get this from Google Cloud Console"
                />
                <q-input
                  v-model="googleConfig.clientSecret"
                  label="Google Client Secret"
                  outlined
                  type="password"
                  class="q-mb-md"
                  hint="Get this from Google Cloud Console"
                />
                <div class="row q-gutter-md">
                  <q-btn
                    color="primary"
                    label="Save Configuration"
                    @click="saveGoogleConfig"
                  />
                  <q-btn
                    color="grey"
                    label="Cancel"
                    flat
                    @click="showGoogleConfig = false"
                  />
                </div>
              </div>

              <div v-if="!googleCalendarStatus.connected && !showGoogleConfig" class="q-mt-md">
                <q-btn
                  flat
                  color="primary"
                  label="Configure API Keys"
                  @click="showGoogleConfig = true"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- Future integrations placeholder -->
          <q-card flat bordered class="q-mb-md">
            <q-card-section>
              <div class="row items-center">
                <q-icon name="event" size="32px" color="blue" class="q-mr-md" />
                <div class="col">
                  <div class="text-h6">Outlook Calendar</div>
                  <div class="text-body2 text-grey-6">
                    Coming soon - sync with Microsoft Outlook
                  </div>
                </div>
                <div class="col-auto">
                  <q-chip color="grey" text-color="black" icon="schedule">
                    Coming Soon
                  </q-chip>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <q-card flat bordered>
            <q-card-section>
              <div class="row items-center">
                <q-icon name="event" size="32px" color="grey" class="q-mr-md" />
                <div class="col">
                  <div class="text-h6">Apple Calendar</div>
                  <div class="text-body2 text-grey-6">
                    Coming soon - sync with Apple iCloud Calendar
                  </div>
                </div>
                <div class="col-auto">
                  <q-chip color="grey" text-color="black" icon="schedule">
                    Coming Soon
                  </q-chip>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-tab-panel>

        <!-- Notifications Settings -->
        <q-tab-panel name="notifications">
          <div class="text-h6">Notification Preferences</div>
          
          <q-card flat bordered class="q-mt-md">
            <q-card-section>
              <div class="text-subtitle1 q-mb-md">Event Notifications</div>
              
              <q-toggle
                v-model="notificationSettings.eventReminders"
                label="Event Reminders"
                color="primary"
                class="q-mb-md"
              />
              
              <q-toggle
                v-model="notificationSettings.calendarSync"
                label="Calendar Sync Notifications"
                color="primary"
                class="q-mb-md"
              />
              
              <q-toggle
                v-model="notificationSettings.taskDeadlines"
                label="Task Deadline Reminders"
                color="primary"
                class="q-mb-md"
              />
            </q-card-section>
          </q-card>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>

    <!-- Save Button -->
    <div class="row justify-end q-mt-md">
      <q-btn
        color="primary"
        label="Save Settings"
        icon="save"
        @click="saveSettings"
        :loading="saveLoading"
      />
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { calendarIntegrationService } from 'src/services/CalendarIntegrationService'

const $q = useQuasar()
const authStore = useAuthStore()

// Reactive data
const activeTab = ref('general')
const saveLoading = ref(false)
const googleCalendarLoading = ref(false)
const syncLoading = ref(false)
const showGoogleConfig = ref(false)

const userSettings = ref({
  fullName: '',
  email: '',
  timezone: '',
  workingHours: {
    start: '09:00',
    end: '17:00'
  }
})

const googleConfig = ref({
  clientId: '',
  clientSecret: ''
})

const googleCalendarStatus = ref({
  connected: false,
  name: 'Google Calendar'
})

const notificationSettings = ref({
  eventReminders: true,
  calendarSync: true,
  taskDeadlines: true
})

// Computed
const timezoneOptions = computed(() => [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
])

// Methods
const loadSettings = () => {
  // Load user settings from auth store
  if (authStore.user) {
    userSettings.value = {
      fullName: authStore.user.fullName || authStore.user.name || '',
      email: authStore.user.email || '',
      timezone: authStore.user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      workingHours: {
        start: authStore.user.workingHours?.start || '09:00',
        end: authStore.user.workingHours?.end || '17:00'
      }
    }
  }

  // Load calendar integration status
  loadCalendarStatus()
}

const loadCalendarStatus = async () => {
  try {
    await calendarIntegrationService.initialize()
    const status = calendarIntegrationService.getConnectionStatus()
    googleCalendarStatus.value = status.google || { connected: false, name: 'Google Calendar' }
  } catch (error) {
    console.error('Error loading calendar status:', error)
  }
}

const connectGoogleCalendar = async () => {
  googleCalendarLoading.value = true
  try {
    const result = await calendarIntegrationService.connectProvider('google', googleConfig.value)
    
    if (result.success) {
      googleCalendarStatus.value.connected = true
      showGoogleConfig.value = false
      $q.notify({
        type: 'positive',
        message: 'Google Calendar connected successfully!',
        position: 'top'
      })
    } else {
      if (result.requiresSetup) {
        showGoogleConfig.value = true
        $q.notify({
          type: 'warning',
          message: result.error,
          position: 'top'
        })
      } else if (result.requiresAuth) {
        // In a real app, this would open OAuth flow
        $q.notify({
          type: 'info', 
          message: 'Google Calendar OAuth not implemented in demo. Please configure API keys first.',
          position: 'top'
        })
      } else {
        $q.notify({
          type: 'negative',
          message: 'Failed to connect: ' + result.error,
          position: 'top'
        })
      }
    }
  } catch (error) {
    console.error('Error connecting Google Calendar:', error)
    $q.notify({
      type: 'negative',
      message: 'Error connecting to Google Calendar',
      position: 'top'
    })
  } finally {
    googleCalendarLoading.value = false
  }
}

const disconnectGoogleCalendar = async () => {
  googleCalendarLoading.value = true
  try {
    const result = await calendarIntegrationService.disconnectProvider('google')
    
    if (result.success) {
      googleCalendarStatus.value.connected = false
      $q.notify({
        type: 'positive',
        message: 'Google Calendar disconnected successfully!',
        position: 'top'
      })
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to disconnect: ' + result.error,
        position: 'top'
      })
    }
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error)
    $q.notify({
      type: 'negative',
      message: 'Error disconnecting from Google Calendar',
      position: 'top'
    })
  } finally {
    googleCalendarLoading.value = false
  }
}

const syncGoogleCalendar = async () => {
  syncLoading.value = true
  try {
    const result = await calendarIntegrationService.syncProvider('google')
    
    if (result.success) {
      $q.notify({
        type: 'positive',
        message: `Synced ${result.eventCount} events from Google Calendar`,
        position: 'top'
      })
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to sync: ' + result.error,
        position: 'top'
      })
    }
  } catch (error) {
    console.error('Error syncing Google Calendar:', error)
    $q.notify({
      type: 'negative',
      message: 'Error syncing Google Calendar',
      position: 'top'
    })
  } finally {
    syncLoading.value = false
  }
}

const saveGoogleConfig = () => {
  if (!googleConfig.value.clientId || !googleConfig.value.clientSecret) {
    $q.notify({
      type: 'negative',
      message: 'Please enter both Client ID and Client Secret',
      position: 'top'
    })
    return
  }
  
  // Save to localStorage for demo
  localStorage.setItem('google_calendar_config', JSON.stringify(googleConfig.value))
  
  $q.notify({
    type: 'positive',
    message: 'Google Calendar configuration saved',
    position: 'top'
  })
  
  showGoogleConfig.value = false
}

const saveSettings = async () => {
  saveLoading.value = true
  try {
    // In a real app, this would save to the backend
    // For now, we'll just show a success message
    
    $q.notify({
      type: 'positive',
      message: 'Settings saved successfully!',
      position: 'top'
    })
  } catch (error) {
    console.error('Error saving settings:', error)
    $q.notify({
      type: 'negative',
      message: 'Error saving settings',
      position: 'top'
    })
  } finally {
    saveLoading.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadSettings()
  
  // Load saved Google config
  const savedConfig = localStorage.getItem('google_calendar_config')
  if (savedConfig) {
    try {
      googleConfig.value = JSON.parse(savedConfig)
    } catch (error) {
      console.error('Error loading Google config:', error)
    }
  }
})
</script>

<style lang="scss" scoped>
.q-card {
  border-radius: 8px;
}
</style>