import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { userPreferencesService, syncService, cacheService } from 'src/services'

// Simple hash function for demo purposes - in production, use proper server-side hashing
const simpleHash = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString()
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const userPreferences = ref(null)
  const isAuthenticated = computed(() => !!user.value)
  const hasCompletedOnboarding = computed(() => user.value?.onboardingCompleted || false)
  const isInitialized = ref(false)
  const initializationPromise = ref(null)

  // Initialize services when store is created
  const initializeServices = async () => {
    try {
      await cacheService.init()
      await syncService.initialize()
    } catch (error) {
      console.error('Error initializing services:', error)
    }
  }

  // Load user from localStorage on store creation
  const loadUserFromStorage = async () => {
    const savedUser = localStorage.getItem('jarvis_user')
    if (savedUser) {
      try {
        user.value = JSON.parse(savedUser)
        
        // Load user preferences if user is authenticated
        if (user.value?.id) {
          await loadUserPreferences()
        }
        
        // Notify sync service of authentication change
        syncService.onAuthChange(true)
      } catch (error) {
        console.error('Error parsing saved user data:', error)
        localStorage.removeItem('jarvis_user')
      }
    }
    isInitialized.value = true
  }

  // Initialize the store
  const initialize = async () => {
    if (!initializationPromise.value) {
      initializationPromise.value = Promise.resolve()
        .then(() => initializeServices())
        .then(() => loadUserFromStorage())
    }
    return initializationPromise.value
  }

  // Auto-initialize when store is created
  initialize()

  // Load user preferences
  const loadUserPreferences = async () => {
    if (!user.value?.id) return
    
    try {
      const result = await userPreferencesService.get(user.value.id)
      if (result.success) {
        userPreferences.value = result.data
      }
    } catch (error) {
      console.error('Error loading user preferences:', error)
    }
  }

  const login = async (credentials) => {
    // For now, use simple local storage authentication
    // In a real app, this would make an API call
    const { email, password } = credentials
    
    // Check if user exists in localStorage
    const existingUsers = JSON.parse(localStorage.getItem('jarvis_users') || '[]')
    const existingUser = existingUsers.find(u => u.email === email)
    
    if (existingUser && existingUser.passwordHash === simpleHash(password)) {
      // Remove password hash from user object before storing in memory
      const { passwordHash, ...userWithoutPassword } = existingUser
      user.value = userWithoutPassword
      localStorage.setItem('jarvis_user', JSON.stringify(userWithoutPassword))
      
      // Load user preferences
      await loadUserPreferences()
      
      // Notify sync service of authentication change
      syncService.onAuthChange(true)
      
      return { success: true }
    } else {
      return { success: false, error: 'Invalid email or password' }
    }
  }

  const register = async (userData) => {
    const { email, password, name } = userData
    
    // Check if user already exists
    const existingUsers = JSON.parse(localStorage.getItem('jarvis_users') || '[]')
    const existingUser = existingUsers.find(u => u.email === email)
    
    if (existingUser) {
      return { success: false, error: 'User already exists with this email' }
    }
    
    // Create new user with hashed password
    const newUser = {
      id: Date.now(),
      email,
      passwordHash: simpleHash(password), // Store hash instead of plain password
      name,
      onboardingCompleted: false,
      createdAt: new Date().toISOString()
    }
    
    existingUsers.push(newUser)
    localStorage.setItem('jarvis_users', JSON.stringify(existingUsers))
    
    // Remove password hash from user object before storing in memory and localStorage
    const { passwordHash, ...userWithoutPassword } = newUser
    user.value = userWithoutPassword
    localStorage.setItem('jarvis_user', JSON.stringify(userWithoutPassword))
    
    // Create default user preferences
    await createDefaultPreferences()
    
    // Notify sync service of authentication change
    syncService.onAuthChange(true)
    
    return { success: true }
  }

  const completeOnboarding = async (onboardingData) => {
    if (user.value) {
      const updatedUser = {
        ...user.value,
        ...onboardingData,
        onboardingCompleted: true
      }
      
      user.value = updatedUser
      localStorage.setItem('jarvis_user', JSON.stringify(updatedUser))
      
      // Update in users array (preserve password hash)
      const existingUsers = JSON.parse(localStorage.getItem('jarvis_users') || '[]')
      const userIndex = existingUsers.findIndex(u => u.id === user.value.id)
      if (userIndex !== -1) {
        existingUsers[userIndex] = { ...existingUsers[userIndex], ...onboardingData, onboardingCompleted: true }
        localStorage.setItem('jarvis_users', JSON.stringify(existingUsers))
      }
      
      // Update user preferences with onboarding data
      if (userPreferences.value) {
        const preferencesUpdate = {
          workPreferences: {
            workingHours: onboardingData.workingHours,
            workingDays: onboardingData.workingDays,
            businessType: onboardingData.businessType
          },
          notifications: {
            ...userPreferences.value.notifications,
            email: onboardingData.communicationPreference === 'Email',
            sms: onboardingData.communicationPreference === 'SMS',
            push: onboardingData.communicationPreference === 'Push notifications',
            inApp: onboardingData.communicationPreference === 'In-app notifications'
          }
        }
        
        await userPreferencesService.update(preferencesUpdate, user.value.id)
        await loadUserPreferences() // Reload preferences
      }
    }
  }

  const logout = () => {
    user.value = null
    userPreferences.value = null
    localStorage.removeItem('jarvis_user')
    
    // Notify sync service of authentication change
    syncService.onAuthChange(false)
  }

  // Create default user preferences
  const createDefaultPreferences = async () => {
    if (!user.value?.id) return
    
    try {
      const result = await userPreferencesService.createDefault(user.value.id)
      if (result.success) {
        userPreferences.value = result.data
      }
    } catch (error) {
      console.error('Error creating default preferences:', error)
    }
  }

  // Update user preferences
  const updatePreferences = async (updates) => {
    if (!user.value?.id) return { success: false, error: 'User not authenticated' }
    
    try {
      const result = await userPreferencesService.update(updates, user.value.id)
      if (result.success) {
        userPreferences.value = result.data
      }
      return result
    } catch (error) {
      console.error('Error updating preferences:', error)
      return { success: false, error: error.message }
    }
  }

  // Get sync status
  const getSyncStatus = async () => {
    try {
      return await syncService.getSyncStatus()
    } catch (error) {
      console.error('Error getting sync status:', error)
      return null
    }
  }

  // Trigger manual sync
  const triggerSync = async () => {
    try {
      return await syncService.syncAll()
    } catch (error) {
      console.error('Error triggering sync:', error)
      return { success: false, error: error.message }
    }
  }

  return {
    user,
    userPreferences,
    isAuthenticated,
    hasCompletedOnboarding,
    isInitialized,
    initialize,
    login,
    register,
    completeOnboarding,
    logout,
    loadUserPreferences,
    updatePreferences,
    getSyncStatus,
    triggerSync
  }
})