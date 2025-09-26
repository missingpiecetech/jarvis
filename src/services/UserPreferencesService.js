/**
 * User Preferences Service
 * Handles CRUD operations for user preferences with PocketBase backend and local caching
 */
import { UserPreferences } from 'src/models'
import { pocketbaseService } from './pocketbase.js'
import { cacheService } from './cache.js'

class UserPreferencesService {
  constructor() {
    this.collection = 'user_preferences'
    this.cacheKey = 'jarvis_user_preferences'
  }

  /**
   * Create user preferences
   */
  async create(preferencesData) {
    try {
      const preferences = new UserPreferences(preferencesData)
      const errors = preferences.validate()
      
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to create in PocketBase first
      let result
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(this.collection, preferences.toPocketBase())
        
        if (result.success) {
          preferences.id = result.data.id
          preferences.createdAt = new Date(result.data.created)
          preferences.updatedAt = new Date(result.data.updated)
        }
      } else {
        // Offline mode - generate local ID
        preferences.id = 'local_' + Date.now()
        result = { success: true, data: preferences }
      }

      // Cache the preferences locally
      await this.cachePreferences(preferences)
      
      return { success: true, data: preferences }
    } catch (error) {
      console.error('Error creating user preferences:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get user preferences for current user
   */
  async get(userId = null) {
    try {
      const currentUser = pocketbaseService.getCurrentUser()
      const targetUserId = userId || currentUser?.id

      if (!targetUserId) {
        return { success: false, error: 'User ID is required' }
      }

      // Try cache first
      const cachedPreferences = await cacheService.get(`${this.cacheKey}_${targetUserId}`)
      if (cachedPreferences) {
        return { success: true, data: new UserPreferences(cachedPreferences) }
      }

      // Try PocketBase
      if (pocketbaseService.isAuthenticated()) {
        const filter = `user_id = "${targetUserId}"`
        const result = await pocketbaseService.getAll(this.collection, filter)
        
        if (result.success && result.data.length > 0) {
          const preferences = UserPreferences.fromPocketBase(result.data[0])
          await this.cachePreferences(preferences)
          return { success: true, data: preferences }
        }
      }

      // If no preferences found, create default ones
      return this.createDefault(targetUserId)
    } catch (error) {
      console.error('Error getting user preferences:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Create default preferences for user
   */
  async createDefault(userId) {
    const defaultPreferences = {
      userId: userId,
      theme: 'light',
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }

    return this.create(defaultPreferences)
  }

  /**
   * Update user preferences
   */
  async update(updates, userId = null) {
    try {
      const currentUser = pocketbaseService.getCurrentUser()
      const targetUserId = userId || currentUser?.id

      // Get existing preferences
      const existingResult = await this.get(targetUserId)
      let preferences

      if (existingResult.success) {
        preferences = existingResult.data
      } else {
        // Create new preferences if none exist
        const createResult = await this.createDefault(targetUserId)
        if (!createResult.success) {
          return createResult
        }
        preferences = createResult.data
      }

      // Apply updates
      Object.assign(preferences, updates)
      preferences.updatedAt = new Date()

      const errors = preferences.validate()
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to update in PocketBase
      if (pocketbaseService.isAuthenticated() && preferences.id && !preferences.id.startsWith('local_')) {
        const result = await pocketbaseService.update(this.collection, preferences.id, preferences.toPocketBase())
        if (result.success) {
          preferences.updatedAt = new Date(result.data.updated)
        }
      }

      // Update cache
      await this.cachePreferences(preferences)

      return { success: true, data: preferences }
    } catch (error) {
      console.error('Error updating user preferences:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update a specific preference category
   */
  async updateCategory(category, updates, userId = null) {
    const existingResult = await this.get(userId)
    if (!existingResult.success) {
      return existingResult
    }

    const preferences = existingResult.data
    preferences.updateCategory(category, updates)

    return this.update(preferences, userId)
  }

  /**
   * Update notification preferences
   */
  async updateNotifications(notificationUpdates, userId = null) {
    return this.updateCategory('notifications', notificationUpdates, userId)
  }

  /**
   * Update work preferences
   */
  async updateWorkPreferences(workUpdates, userId = null) {
    return this.updateCategory('workPreferences', workUpdates, userId)
  }

  /**
   * Update calendar preferences
   */
  async updateCalendarPreferences(calendarUpdates, userId = null) {
    return this.updateCategory('calendarPreferences', calendarUpdates, userId)
  }

  /**
   * Update AI preferences
   */
  async updateAIPreferences(aiUpdates, userId = null) {
    return this.updateCategory('aiPreferences', aiUpdates, userId)
  }

  /**
   * Update privacy preferences
   */
  async updatePrivacyPreferences(privacyUpdates, userId = null) {
    return this.updateCategory('privacyPreferences', privacyUpdates, userId)
  }

  /**
   * Update integration preferences
   */
  async updateIntegrations(integrationUpdates, userId = null) {
    return this.updateCategory('integrations', integrationUpdates, userId)
  }

  /**
   * Set notification preference
   */
  async setNotificationSetting(type, enabled, userId = null) {
    return this.updateNotifications({ [type]: enabled }, userId)
  }

  /**
   * Get notification preference
   */
  async getNotificationSetting(type, userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      return { success: true, data: result.data.getNotificationSetting(type) }
    }
    return result
  }

  /**
   * Check if user is in working hours
   */
  async isInWorkingHours(date = new Date(), userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      return { success: true, data: result.data.isInWorkingHours(date) }
    }
    return result
  }

  /**
   * Get next working day
   */
  async getNextWorkingDay(startDate = new Date(), userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      return { success: true, data: result.data.getNextWorkingDay(startDate) }
    }
    return result
  }

  /**
   * Format date according to user preference
   */
  async formatDate(date, userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      return { success: true, data: result.data.formatDate(date) }
    }
    return result
  }

  /**
   * Format time according to user preference
   */
  async formatTime(date, userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      return { success: true, data: result.data.formatTime(date) }
    }
    return result
  }

  /**
   * Get default event reminders
   */
  async getDefaultReminders(userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      return { success: true, data: result.data.getDefaultReminders() }
    }
    return result
  }

  /**
   * Check if feature is enabled
   */
  async isFeatureEnabled(category, feature, userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      return { success: true, data: result.data.isFeatureEnabled(category, feature) }
    }
    return result
  }

  /**
   * Export preferences to JSON
   */
  async exportToJSON(userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      return { success: true, data: result.data.exportToJSON() }
    }
    return result
  }

  /**
   * Import preferences from JSON
   */
  async importFromJSON(jsonData, userId = null) {
    try {
      const result = await this.get(userId)
      let preferences

      if (result.success) {
        preferences = result.data
      } else {
        // Create new preferences if none exist
        const currentUser = pocketbaseService.getCurrentUser()
        const targetUserId = userId || currentUser?.id
        const createResult = await this.createDefault(targetUserId)
        if (!createResult.success) {
          return createResult
        }
        preferences = createResult.data
      }

      preferences.importFromJSON(jsonData)
      return this.update(preferences, userId)
    } catch (error) {
      console.error('Error importing preferences:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetToDefaults(userId = null) {
    try {
      const currentUser = pocketbaseService.getCurrentUser()
      const targetUserId = userId || currentUser?.id

      const result = await this.get(targetUserId)
      if (result.success) {
        const preferences = result.data
        preferences.resetToDefaults()
        return this.update(preferences, userId)
      }

      // Create new default preferences if none exist
      return this.createDefault(targetUserId)
    } catch (error) {
      console.error('Error resetting preferences:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete user preferences
   */
  async delete(userId = null) {
    try {
      const currentUser = pocketbaseService.getCurrentUser()
      const targetUserId = userId || currentUser?.id

      const result = await this.get(targetUserId)
      if (!result.success) {
        return { success: true } // Already deleted or doesn't exist
      }

      const preferences = result.data

      // Try to delete from PocketBase
      if (pocketbaseService.isAuthenticated() && preferences.id && !preferences.id.startsWith('local_')) {
        await pocketbaseService.delete(this.collection, preferences.id)
      }

      // Remove from cache
      await cacheService.remove(`${this.cacheKey}_${targetUserId}`)

      return { success: true }
    } catch (error) {
      console.error('Error deleting user preferences:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Cache user preferences
   */
  async cachePreferences(preferences) {
    await cacheService.set(`${this.cacheKey}_${preferences.userId}`, preferences)
  }

  /**
   * Get preferences for multiple categories
   */
  async getCategories(categories, userId = null) {
    const result = await this.get(userId)
    if (result.success) {
      const preferences = result.data
      const categoryData = {}
      
      categories.forEach(category => {
        if (preferences[category]) {
          categoryData[category] = preferences[category]
        }
      })
      
      return { success: true, data: categoryData }
    }
    return result
  }

  /**
   * Sync local changes with PocketBase
   */
  async sync() {
    try {
      if (!pocketbaseService.isAuthenticated()) {
        return { success: false, error: 'Not authenticated' }
      }

      // Get all cached preferences
      const currentUser = pocketbaseService.getCurrentUser()
      const cachedPreferences = await cacheService.get(`${this.cacheKey}_${currentUser.id}`)
      
      if (!cachedPreferences || !cachedPreferences.id?.startsWith('local_')) {
        return { success: true, data: [] } // Nothing to sync
      }

      // Remove local ID and create in PocketBase
      const preferencesData = { ...cachedPreferences }
      delete preferencesData.id

      const result = await pocketbaseService.create(this.collection, new UserPreferences(preferencesData).toPocketBase())

      if (result.success) {
        // Update cache with new ID
        const newPreferences = UserPreferences.fromPocketBase(result.data)
        await this.cachePreferences(newPreferences)

        return { success: true, data: [{ localId: cachedPreferences.id, newId: newPreferences.id, success: true }] }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Error syncing user preferences:', error)
      return { success: false, error: error.message }
    }
  }
}

export const userPreferencesService = new UserPreferencesService()
export default userPreferencesService