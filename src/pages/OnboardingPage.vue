<template>
  <q-page class="flex flex-center q-pa-md">
    <q-card class="q-pa-lg" style="min-width: 500px; max-width: 600px;">
      <q-card-section class="text-center">
        <div class="text-h4 text-primary q-mb-md">Welcome to Jarvis!</div>
        <div class="text-subtitle1 text-grey-7">Let's set up your personal assistant</div>
        
        <q-linear-progress 
          :value="progress" 
          color="primary" 
          class="q-mt-md" 
          size="8px"
          rounded
        />
        <div class="text-caption text-grey-6 q-mt-xs">
          Step {{ currentStep }} of {{ totalSteps }}
        </div>
      </q-card-section>

      <q-card-section>
        <!-- Step 1: Personal Information -->
        <div v-if="currentStep === 1">
          <div class="text-h6 q-mb-md">Personal Information</div>
          <q-form class="q-gutter-md">
            <q-input
              v-model="formData.fullName"
              label="Full Name"
              outlined
              :rules="[val => !!val || 'Name is required']"
            />
            <q-input
              v-model="formData.phone"
              label="Phone Number (Optional)"
              outlined
              type="tel"
            />
            <q-input
              v-model="formData.timezone"
              label="Timezone"
              outlined
              :rules="[val => !!val || 'Timezone is required']"
              :model-value="formData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone"
              readonly
            />
          </q-form>
        </div>

        <!-- Step 2: Work Information -->
        <div v-else-if="currentStep === 2">
          <div class="text-h6 q-mb-md">Work & Schedule</div>
          <q-form class="q-gutter-md">
            <q-select
              v-model="formData.businessType"
              label="Business Type"
              outlined
              :options="businessTypeOptions"
              :rules="[val => !!val || 'Business type is required']"
            />
            
            <div class="text-subtitle2 q-mt-md q-mb-sm">Working Hours</div>
            <div class="row q-gutter-md">
              <q-time
                v-model="formData.workingHours.start"
                label="Start Time"
                format24h
                class="col"
              />
              <q-time
                v-model="formData.workingHours.end"
                label="End Time"
                format24h
                class="col"
              />
            </div>
            
            <q-select
              v-model="formData.workingDays"
              label="Working Days"
              outlined
              multiple
              :options="daysOptions"
              use-chips
              :rules="[val => val && val.length > 0 || 'Select at least one working day']"
            />
          </q-form>
        </div>

        <!-- Step 3: Preferences -->
        <div v-else-if="currentStep === 3">
          <div class="text-h6 q-mb-md">Preferences & Integration</div>
          <q-form class="q-gutter-md">
            <q-select
              v-model="formData.calendarIntegration"
              label="Calendar Integration Preference"
              outlined
              :options="calendarOptions"
            />
            
            <q-select
              v-model="formData.communicationPreference"
              label="Preferred Communication Method"
              outlined
              :options="communicationOptions"
              :rules="[val => !!val || 'Communication preference is required']"
            />
            
            <q-input
              v-model="formData.goals"
              label="What are your main goals with Jarvis? (Optional)"
              outlined
              type="textarea"
              rows="3"
              hint="e.g., Better time management, task organization, meeting scheduling"
            />
            
            <q-toggle
              v-model="formData.notifications"
              label="Enable notifications"
              color="primary"
            />
          </q-form>
        </div>

        <!-- Step 4: Review -->
        <div v-else-if="currentStep === 4">
          <div class="text-h6 q-mb-md">Review Your Information</div>
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label>Full Name</q-item-label>
                <q-item-label caption>{{ formData.fullName }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Business Type</q-item-label>
                <q-item-label caption>{{ formData.businessType }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Working Hours</q-item-label>
                <q-item-label caption>{{ formData.workingHours.start }} - {{ formData.workingHours.end }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Working Days</q-item-label>
                <q-item-label caption>{{ formData.workingDays.join(', ') }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label>Communication Preference</q-item-label>
                <q-item-label caption>{{ formData.communicationPreference }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-section>

      <q-card-actions class="q-pa-lg">
        <q-btn
          v-if="currentStep > 1"
          flat
          color="primary"
          label="Previous"
          @click="previousStep"
        />
        <q-space />
        <q-btn
          color="primary"
          :label="currentStep === totalSteps ? 'Complete Setup' : 'Next'"
          :loading="loading"
          @click="nextStep"
        />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import { useQuasar } from 'quasar'

const router = useRouter()
const authStore = useAuthStore()
const $q = useQuasar()

const currentStep = ref(1)
const totalSteps = 4
const loading = ref(false)

const progress = computed(() => (currentStep.value - 1) / (totalSteps - 1))

const formData = ref({
  fullName: '',
  phone: '',
  timezone: '',
  businessType: '',
  workingHours: {
    start: '09:00',
    end: '17:00'
  },
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  calendarIntegration: 'None',
  communicationPreference: '',
  goals: '',
  notifications: true
})

const businessTypeOptions = [
  'Freelancer',
  'Small Business Owner',
  'Consultant',
  'Corporate Employee',
  'Entrepreneur',
  'Student',
  'Other'
]

const daysOptions = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
]

const calendarOptions = [
  'None',
  'Google Calendar',
  'Outlook Calendar',
  'Apple Calendar',
  'Other'
]

const communicationOptions = [
  'Email',
  'In-app notifications',
  'SMS',
  'Push notifications'
]

onMounted(() => {
  // Pre-fill user's name if available
  if (authStore.user?.name) {
    formData.value.fullName = authStore.user.name
  }
  
  // Set default timezone
  formData.value.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
})

const nextStep = async () => {
  if (currentStep.value === totalSteps) {
    await completeOnboarding()
  } else {
    if (validateCurrentStep()) {
      currentStep.value++
    }
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const validateCurrentStep = () => {
  switch (currentStep.value) {
    case 1:
      if (!formData.value.fullName) {
        $q.notify({
          type: 'negative',
          message: 'Please enter your full name',
          position: 'top'
        })
        return false
      }
      break
    case 2:
      if (!formData.value.businessType) {
        $q.notify({
          type: 'negative',
          message: 'Please select your business type',
          position: 'top'
        })
        return false
      }
      if (!formData.value.workingDays.length) {
        $q.notify({
          type: 'negative',
          message: 'Please select at least one working day',
          position: 'top'
        })
        return false
      }
      break
    case 3:
      if (!formData.value.communicationPreference) {
        $q.notify({
          type: 'negative',
          message: 'Please select a communication preference',
          position: 'top'
        })
        return false
      }
      break
  }
  return true
}

const completeOnboarding = async () => {
  loading.value = true
  
  try {
    // Complete onboarding in the auth store
    authStore.completeOnboarding(formData.value)
    
    $q.notify({
      type: 'positive',
      message: 'Onboarding completed successfully! Welcome to Jarvis!',
      position: 'top'
    })
    
    // Redirect to main app
    router.push('/')
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error completing onboarding. Please try again.',
      position: 'top'
    })
    console.error('Onboarding error:', error)
  } finally {
    loading.value = false
  }
}
</script>