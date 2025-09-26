<template>
  <q-page class="flex flex-center">
    <q-card class="q-pa-lg" style="min-width: 400px">
      <q-card-section class="text-center">
        <div class="text-h4 text-primary q-mb-md">Welcome to Jarvis</div>
        <div class="text-subtitle1 text-grey-7">Your Personal Assistant</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="handleSubmit" class="q-gutter-md">
          <q-input
            v-model="email"
            type="email"
            label="Email"
            outlined
            :rules="[val => !!val || 'Email is required', val => isValidEmail(val) || 'Invalid email format']"
            lazy-rules
          />
          
          <q-input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            label="Password"
            outlined
            :rules="[val => !!val || 'Password is required', val => val.length >= 6 || 'Password must be at least 6 characters']"
            lazy-rules
          >
            <template v-slot:append>
              <q-icon
                :name="showPassword ? 'visibility' : 'visibility_off'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <q-btn
            type="submit"
            color="primary"
            size="lg"
            class="full-width"
            :loading="loading"
            :label="isRegisterMode ? 'Create Account' : 'Sign In'"
          />
        </q-form>

        <div class="text-center q-mt-md">
          <q-btn
            flat
            color="primary"
            :label="isRegisterMode ? 'Already have an account? Sign in' : 'Need an account? Sign up'"
            @click="toggleMode"
          />
        </div>

        <q-banner v-if="error" class="bg-negative text-white q-mt-md">
          {{ error }}
        </q-banner>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import { useQuasar } from 'quasar'

const router = useRouter()
const authStore = useAuthStore()
const $q = useQuasar()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const isRegisterMode = ref(false)

const isValidEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailPattern.test(email)
}

const toggleMode = () => {
  isRegisterMode.value = !isRegisterMode.value
  error.value = ''
}

const handleSubmit = async () => {
  loading.value = true
  error.value = ''

  try {
    let result
    if (isRegisterMode.value) {
      // For registration, we need a name - let's extract it from email for simplicity
      const name = email.value.split('@')[0]
      result = await authStore.register({
        email: email.value,
        password: password.value,
        name: name
      })
    } else {
      result = await authStore.login({
        email: email.value,
        password: password.value
      })
    }

    if (result.success) {
      $q.notify({
        type: 'positive',
        message: isRegisterMode.value ? 'Account created successfully!' : 'Welcome back!',
        position: 'top'
      })

      // Redirect based on onboarding status
      if (authStore.hasCompletedOnboarding) {
        router.push('/')
      } else {
        router.push('/onboarding')
      }
    } else {
      error.value = result.error
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
    console.error('Authentication error:', err)
  } finally {
    loading.value = false
  }
}
</script>