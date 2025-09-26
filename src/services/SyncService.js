/**
 * Sync Service
 * Handles synchronization between local cache and PocketBase backend
 */
import { pocketbaseService } from './pocketbase.js'
import { cacheService } from './cache.js'
import { taskService } from './TaskService.js'
import { eventService } from './EventService.js'
import { documentService } from './DocumentService.js'
import { conversationService } from './ConversationService.js'
import { userPreferencesService } from './UserPreferencesService.js'

class SyncService {
  constructor() {
    this.services = [
      { name: 'tasks', service: taskService },
      { name: 'events', service: eventService },
      { name: 'documents', service: documentService },
      { name: 'conversations', service: conversationService },
      { name: 'userPreferences', service: userPreferencesService }
    ]
    
    this.isOnline = navigator.onLine
    this.syncInProgress = false
    this.lastSyncTime = null
    this.syncIntervalId = null
    this.syncStatus = {}

    // Set up online/offline event listeners
    this.setupNetworkListeners()
  }

  /**
   * Initialize sync service
   */
  async initialize() {
    // Load last sync time from cache
    this.lastSyncTime = await cacheService.get('last_sync_time')
    
    // Set up periodic sync when online
    if (this.isOnline) {
      this.startPeriodicSync()
    }

    // Clear expired cache entries
    await cacheService.clearExpired()
  }

  /**
   * Set up network status listeners
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Network: Online')
      this.isOnline = true
      this.onOnline()
    })

    window.addEventListener('offline', () => {
      console.log('Network: Offline')
      this.isOnline = false
      this.onOffline()
    })
  }

  /**
   * Handle online event
   */
  async onOnline() {
    if (pocketbaseService.isAuthenticated()) {
      // Trigger sync when coming back online
      setTimeout(() => this.syncAll(), 1000)
      
      // Start periodic sync
      this.startPeriodicSync()
    }
  }

  /**
   * Handle offline event
   */
  onOffline() {
    // Stop periodic sync
    this.stopPeriodicSync()
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync(intervalMinutes = 5) {
    this.stopPeriodicSync() // Clear any existing interval
    
    this.syncIntervalId = setInterval(() => {
      if (this.isOnline && pocketbaseService.isAuthenticated() && !this.syncInProgress) {
        this.syncAll()
      }
    }, intervalMinutes * 60 * 1000)
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId)
      this.syncIntervalId = null
    }
  }

  /**
   * Check if sync is needed
   */
  needsSync() {
    if (!this.lastSyncTime) return true
    
    const timeSinceLastSync = Date.now() - this.lastSyncTime
    const syncThreshold = 10 * 60 * 1000 // 10 minutes
    
    return timeSinceLastSync > syncThreshold
  }

  /**
   * Sync all data
   */
  async syncAll() {
    if (this.syncInProgress || !this.isOnline || !pocketbaseService.isAuthenticated()) {
      return { success: false, error: 'Sync not available' }
    }

    console.log('Starting full sync...')
    this.syncInProgress = true

    try {
      const results = {}
      
      // Sync each service
      for (const { name, service } of this.services) {
        try {
          console.log(`Syncing ${name}...`)
          const result = await service.sync()
          results[name] = result
          this.syncStatus[name] = {
            lastSync: Date.now(),
            success: result.success,
            error: result.success ? null : result.error
          }
        } catch (error) {
          console.error(`Error syncing ${name}:`, error)
          results[name] = { success: false, error: error.message }
          this.syncStatus[name] = {
            lastSync: Date.now(),
            success: false,
            error: error.message
          }
        }
      }

      // Update last sync time
      this.lastSyncTime = Date.now()
      await cacheService.set('last_sync_time', this.lastSyncTime)
      await cacheService.set('sync_status', this.syncStatus)

      console.log('Full sync completed')
      return { success: true, data: results }
    } catch (error) {
      console.error('Sync error:', error)
      return { success: false, error: error.message }
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Sync specific service
   */
  async syncService(serviceName) {
    if (this.syncInProgress || !this.isOnline || !pocketbaseService.isAuthenticated()) {
      return { success: false, error: 'Sync not available' }
    }

    const serviceInfo = this.services.find(s => s.name === serviceName)
    if (!serviceInfo) {
      return { success: false, error: 'Service not found' }
    }

    try {
      console.log(`Syncing ${serviceName}...`)
      const result = await serviceInfo.service.sync()
      
      this.syncStatus[serviceName] = {
        lastSync: Date.now(),
        success: result.success,
        error: result.success ? null : result.error
      }
      
      await cacheService.set('sync_status', this.syncStatus)
      
      return result
    } catch (error) {
      console.error(`Error syncing ${serviceName}:`, error)
      
      this.syncStatus[serviceName] = {
        lastSync: Date.now(),
        success: false,
        error: error.message
      }
      
      await cacheService.set('sync_status', this.syncStatus)
      
      return { success: false, error: error.message }
    }
  }

  /**
   * Force sync all data (ignore sync threshold)
   */
  async forceSyncAll() {
    this.lastSyncTime = null
    return this.syncAll()
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const cachedStatus = await cacheService.get('sync_status') || {}
    
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      needsSync: this.needsSync(),
      services: { ...this.syncStatus, ...cachedStatus }
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    const cacheStats = await cacheService.getStats()
    const syncStatus = await this.getSyncStatus()
    
    return {
      cache: cacheStats,
      sync: syncStatus,
      network: {
        isOnline: this.isOnline,
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt
        } : null
      }
    }
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    await cacheService.clear()
    this.lastSyncTime = null
    this.syncStatus = {}
  }

  /**
   * Check PocketBase connection
   */
  async checkConnection() {
    try {
      const isHealthy = await pocketbaseService.healthCheck()
      return { success: true, data: { healthy: isHealthy, online: this.isOnline } }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Handle authentication change
   */
  async onAuthChange(isAuthenticated) {
    if (isAuthenticated && this.isOnline) {
      // Start syncing when user logs in
      setTimeout(() => this.syncAll(), 2000)
      this.startPeriodicSync()
    } else {
      // Stop syncing when user logs out
      this.stopPeriodicSync()
    }
  }

  /**
   * Estimate sync time based on cached data
   */
  async estimateSyncTime() {
    try {
      const cacheStats = await cacheService.getStats()
      
      // Rough estimate: 1 second per 100 entries
      const estimatedSeconds = Math.max(1, Math.ceil(cacheStats.totalEntries / 100))
      
      return {
        success: true,
        data: {
          estimatedSeconds,
          totalEntries: cacheStats.totalEntries,
          estimatedMinutes: Math.ceil(estimatedSeconds / 60)
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Schedule sync for later (when coming online)
   */
  scheduleSync() {
    // This could be enhanced to use service workers for background sync
    console.log('Sync scheduled for when online')
  }

  /**
   * Get pending sync items count
   */
  async getPendingSyncCount() {
    try {
      let totalPending = 0
      
      for (const { name, service } of this.services) {
        if (service.cacheKey) {
          const cachedItems = await cacheService.get(service.cacheKey) || []
          const localItems = Array.isArray(cachedItems) 
            ? cachedItems.filter(item => item.id && item.id.startsWith('local_'))
            : []
          totalPending += localItems.length
        }
      }
      
      return { success: true, data: totalPending }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Destroy sync service
   */
  destroy() {
    this.stopPeriodicSync()
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOffline)
  }
}

export const syncService = new SyncService()
export default syncService