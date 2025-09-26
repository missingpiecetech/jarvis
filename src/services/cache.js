/**
 * Cache Service
 * Handles local storage and IndexedDB for offline data caching
 */

class CacheService {
  constructor() {
    this.dbName = 'JarvisDB'
    this.dbVersion = 1
    this.db = null
    this.isIndexedDBSupported = 'indexedDB' in window
    this.isLocalStorageSupported = 'localStorage' in window
    this.initialized = false
  }

  /**
   * Initialize the cache service
   */
  async init() {
    if (this.initialized) return

    if (this.isIndexedDBSupported) {
      try {
        await this.initIndexedDB()
      } catch (error) {
        console.warn('IndexedDB initialization failed, falling back to localStorage:', error)
        this.isIndexedDBSupported = false
      }
    }

    this.initialized = true
  }

  /**
   * Initialize IndexedDB
   */
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)

      request.onsuccess = (event) => {
        this.db = event.target.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Create object stores for different data types
        const stores = [
          'tasks',
          'events', 
          'documents',
          'conversations',
          'preferences',
          'cache'
        ]

        stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'key' })
            store.createIndex('timestamp', 'timestamp', { unique: false })
            store.createIndex('userId', 'userId', { unique: false })
          }
        })
      }
    })
  }

  /**
   * Set cache entry
   */
  async set(key, value, ttl = null) {
    await this.init()

    const cacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl ? Date.now() + (ttl * 1000) : null,
      userId: this.getCurrentUserId()
    }

    if (this.isIndexedDBSupported && this.db) {
      return this.setIndexedDB(cacheEntry)
    } else if (this.isLocalStorageSupported) {
      return this.setLocalStorage(key, cacheEntry)
    } else {
      throw new Error('No storage mechanism available')
    }
  }

  /**
   * Get cache entry
   */
  async get(key) {
    await this.init()

    let cacheEntry

    if (this.isIndexedDBSupported && this.db) {
      cacheEntry = await this.getIndexedDB(key)
    } else if (this.isLocalStorageSupported) {
      cacheEntry = this.getLocalStorage(key)
    } else {
      return null
    }

    if (!cacheEntry) return null

    // Check if entry has expired
    if (cacheEntry.ttl && Date.now() > cacheEntry.ttl) {
      await this.remove(key)
      return null
    }

    return cacheEntry.value
  }

  /**
   * Remove cache entry
   */
  async remove(key) {
    await this.init()

    if (this.isIndexedDBSupported && this.db) {
      return this.removeIndexedDB(key)
    } else if (this.isLocalStorageSupported) {
      return this.removeLocalStorage(key)
    }
  }

  /**
   * Clear all cache entries
   */
  async clear() {
    await this.init()

    if (this.isIndexedDBSupported && this.db) {
      return this.clearIndexedDB()
    } else if (this.isLocalStorageSupported) {
      return this.clearLocalStorage()
    }
  }

  /**
   * Clear expired entries
   */
  async clearExpired() {
    await this.init()

    if (this.isIndexedDBSupported && this.db) {
      return this.clearExpiredIndexedDB()
    } else if (this.isLocalStorageSupported) {
      return this.clearExpiredLocalStorage()
    }
  }

  /**
   * Get cache size and statistics
   */
  async getStats() {
    await this.init()

    const stats = {
      mechanism: this.isIndexedDBSupported ? 'IndexedDB' : 'localStorage',
      totalEntries: 0,
      totalSize: 0,
      expiredEntries: 0,
      stores: {}
    }

    if (this.isIndexedDBSupported && this.db) {
      // Get stats from IndexedDB
      const transaction = this.db.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const request = store.getAll()

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const entries = request.result
          stats.totalEntries = entries.length

          entries.forEach(entry => {
            const size = JSON.stringify(entry).length
            stats.totalSize += size

            if (entry.ttl && Date.now() > entry.ttl) {
              stats.expiredEntries++
            }
          })

          resolve(stats)
        }
      })
    } else if (this.isLocalStorageSupported) {
      // Get stats from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key.startsWith('jarvis_')) {
          try {
            const value = localStorage.getItem(key)
            const entry = JSON.parse(value)
            
            stats.totalEntries++
            stats.totalSize += value.length

            if (entry.ttl && Date.now() > entry.ttl) {
              stats.expiredEntries++
            }
          } catch (error) {
            // Skip invalid entries
          }
        }
      }
    }

    return stats
  }

  // IndexedDB specific methods

  async setIndexedDB(cacheEntry) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.put(cacheEntry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async removeIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clearIndexedDB() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clearExpiredIndexedDB() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.getAll()

      request.onsuccess = () => {
        const entries = request.result
        const now = Date.now()
        const deletePromises = []

        entries.forEach(entry => {
          if (entry.ttl && now > entry.ttl) {
            const deleteRequest = store.delete(entry.key)
            deletePromises.push(new Promise((res, rej) => {
              deleteRequest.onsuccess = res
              deleteRequest.onerror = rej
            }))
          }
        })

        Promise.all(deletePromises).then(resolve).catch(reject)
      }

      request.onerror = () => reject(request.error)
    })
  }

  // localStorage specific methods

  setLocalStorage(key, cacheEntry) {
    try {
      localStorage.setItem(`jarvis_${key}`, JSON.stringify(cacheEntry))
    } catch (error) {
      console.error('Error setting localStorage item:', error)
      throw error
    }
  }

  getLocalStorage(key) {
    try {
      const item = localStorage.getItem(`jarvis_${key}`)
      return item ? JSON.parse(item) : null
    } catch (error) {
      console.error('Error getting localStorage item:', error)
      return null
    }
  }

  removeLocalStorage(key) {
    try {
      localStorage.removeItem(`jarvis_${key}`)
    } catch (error) {
      console.error('Error removing localStorage item:', error)
    }
  }

  clearLocalStorage() {
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key.startsWith('jarvis_')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }

  clearExpiredLocalStorage() {
    try {
      const now = Date.now()
      const keysToRemove = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key.startsWith('jarvis_')) {
          try {
            const item = localStorage.getItem(key)
            const entry = JSON.parse(item)
            if (entry.ttl && now > entry.ttl) {
              keysToRemove.push(key)
            }
          } catch (error) {
            // Remove invalid entries
            keysToRemove.push(key)
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.error('Error clearing expired localStorage items:', error)
    }
  }

  // Utility methods

  getCurrentUserId() {
    // Try to get current user ID from auth store or localStorage
    try {
      const user = JSON.parse(localStorage.getItem('jarvis_user'))
      return user?.id || null
    } catch (error) {
      return null
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable() {
    return this.isIndexedDBSupported || this.isLocalStorageSupported
  }

  /**
   * Get cache mechanism being used
   */
  getMechanism() {
    if (this.isIndexedDBSupported && this.db) {
      return 'IndexedDB'
    } else if (this.isLocalStorageSupported) {
      return 'localStorage'
    } else {
      return 'none'
    }
  }

  /**
   * Estimate available storage space (approximate)
   */
  async estimateStorage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate()
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          available: estimate.quota - estimate.usage
        }
      } catch (error) {
        console.warn('Could not estimate storage:', error)
      }
    }
    return null
  }
}

export const cacheService = new CacheService()
export default cacheService