import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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
  const isAuthenticated = computed(() => !!user.value)
  const hasCompletedOnboarding = computed(() => user.value?.onboardingCompleted || false)

  // Load user from localStorage on store creation
  const savedUser = localStorage.getItem('jarvis_user')
  if (savedUser) {
    try {
      user.value = JSON.parse(savedUser)
    } catch (error) {
      console.error('Error parsing saved user data:', error)
      localStorage.removeItem('jarvis_user')
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
    
    return { success: true }
  }

  const completeOnboarding = (onboardingData) => {
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
    }
  }

  const logout = () => {
    user.value = null
    localStorage.removeItem('jarvis_user')
  }

  return {
    user,
    isAuthenticated,
    hasCompletedOnboarding,
    login,
    register,
    completeOnboarding,
    logout
  }
})