/**
 * PocketBase/PocketHost service
 * Handles connection and basic operations with PocketBase backend
 */
import PocketBase from 'pocketbase'

class PocketBaseService {
  constructor() {
    // Use PocketHost URL in production, localhost for development
    this.pb = new PocketBase(
      import.meta.env.VITE_POCKETBASE_URL || 
      import.meta.env.VITE_POCKETHOST_URL || 
      'http://127.0.0.1:8090'
    )
    
    // Auto-refresh authentication
    this.pb.authStore.onChange(() => {
      console.log('PocketBase auth changed:', this.pb.authStore.isValid)
    })
  }

  /**
   * Get PocketBase instance
   */
  getInstance() {
    return this.pb
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.pb.authStore.isValid
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.pb.authStore.model
  }

  /**
   * Authenticate user
   */
  async authenticate(email, password) {
    try {
      const authData = await this.pb.collection('users').authWithPassword(email, password)
      return { success: true, user: authData.record }
    } catch (error) {
      console.error('Authentication error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      const user = await this.pb.collection('users').create(userData)
      return { success: true, user }
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Logout user
   */
  logout() {
    this.pb.authStore.clear()
  }

  /**
   * Generic CRUD operations
   */

  /**
   * Create a record
   */
  async create(collection, data) {
    try {
      const record = await this.pb.collection(collection).create(data)
      return { success: true, data: record }
    } catch (error) {
      console.error(`Error creating ${collection}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get a record by ID
   */
  async get(collection, id, expand = '') {
    try {
      const record = await this.pb.collection(collection).getOne(id, { expand })
      return { success: true, data: record }
    } catch (error) {
      console.error(`Error getting ${collection} ${id}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get list of records
   */
  async getList(collection, page = 1, perPage = 50, filter = '', sort = '', expand = '') {
    try {
      const records = await this.pb.collection(collection).getList(page, perPage, {
        filter,
        sort,
        expand
      })
      return { success: true, data: records }
    } catch (error) {
      console.error(`Error getting ${collection} list:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all records (automatically handles pagination)
   */
  async getAll(collection, filter = '', sort = '', expand = '') {
    try {
      const records = await this.pb.collection(collection).getFullList({
        filter,
        sort,
        expand
      })
      return { success: true, data: records }
    } catch (error) {
      console.error(`Error getting all ${collection}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update a record
   */
  async update(collection, id, data) {
    try {
      const record = await this.pb.collection(collection).update(id, data)
      return { success: true, data: record }
    } catch (error) {
      console.error(`Error updating ${collection} ${id}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete a record
   */
  async delete(collection, id) {
    try {
      await this.pb.collection(collection).delete(id)
      return { success: true }
    } catch (error) {
      console.error(`Error deleting ${collection} ${id}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Upload file
   */
  async uploadFile(collection, id, fieldName, file) {
    try {
      const formData = new FormData()
      formData.append(fieldName, file)
      
      const record = await this.pb.collection(collection).update(id, formData)
      return { success: true, data: record }
    } catch (error) {
      console.error(`Error uploading file to ${collection} ${id}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get file URL
   */
  getFileUrl(record, filename, thumb = '') {
    return this.pb.files.getUrl(record, filename, { thumb })
  }

  /**
   * Subscribe to real-time changes
   */
  async subscribe(collection, callback, filter = '') {
    try {
      return await this.pb.collection(collection).subscribe('*', callback, { filter })
    } catch (error) {
      console.error(`Error subscribing to ${collection}:`, error)
      return null
    }
  }

  /**
   * Unsubscribe from real-time changes
   */
  unsubscribe(collection) {
    this.pb.collection(collection).unsubscribe()
  }

  /**
   * Check connection status
   */
  async healthCheck() {
    try {
      await this.pb.health.check()
      return true
    } catch (error) {
      console.error('PocketBase health check failed:', error)
      return false
    }
  }

  /**
   * Batch operations
   */
  async batch(operations) {
    const results = []
    
    for (const operation of operations) {
      try {
        let result
        switch (operation.type) {
          case 'create':
            result = await this.create(operation.collection, operation.data)
            break
          case 'update':
            result = await this.update(operation.collection, operation.id, operation.data)
            break
          case 'delete':
            result = await this.delete(operation.collection, operation.id)
            break
          default:
            result = { success: false, error: 'Unknown operation type' }
        }
        results.push({ ...operation, result })
      } catch (error) {
        results.push({ ...operation, result: { success: false, error: error.message } })
      }
    }
    
    return results
  }
}

// Create singleton instance
export const pocketbaseService = new PocketBaseService()
export default pocketbaseService