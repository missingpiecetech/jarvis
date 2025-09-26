/**
 * UserContext Service
 * Handles CRUD operations for user context data, suggestions, and AI-extracted insights
 */
import { UserContext, TaskSuggestion, EventSuggestion } from 'src/models/UserContext.js'
import { pocketbaseService } from './pocketbase.js'
import { cacheService } from './cache.js'

class UserContextService {
  constructor() {
    this.contextCollection = 'user_contexts'
    this.taskSuggestionCollection = 'task_suggestions'
    this.eventSuggestionCollection = 'event_suggestions'
    this.cacheKey = 'jarvis_user_contexts'
    this.suggestionsCacheKey = 'jarvis_suggestions'
  }

  /**
   * Store user context extracted from conversation
   */
  async storeContext(contextData) {
    try {
      const context = new UserContext(contextData)
      const errors = context.validate()
      
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Check for existing similar context to avoid duplicates
      const existing = await this.findSimilarContext(context)
      if (existing.success && existing.data) {
        // Update existing context instead of creating new one
        existing.data.updateValue(context.value, Math.max(existing.data.confidence, context.confidence))
        return await this.updateContext(existing.data.id, existing.data)
      }

      // Create new context
      let result
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(this.contextCollection, context.toPocketBase())
        
        if (result.success) {
          context.id = result.data.id
          context.createdAt = new Date(result.data.created)
          context.updatedAt = new Date(result.data.updated)
        }
      } else {
        // Offline mode
        context.id = 'local_' + Date.now()
        result = { success: true, data: context }
      }

      // Cache the context
      await this.cacheContext(context)
      
      return { success: true, data: context }
    } catch (error) {
      console.error('Error storing context:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Store multiple contexts at once (for batch processing)
   */
  async storeContexts(contextsData) {
    const results = []
    for (const contextData of contextsData) {
      const result = await this.storeContext(contextData)
      results.push(result)
    }
    return results
  }

  /**
   * Find similar context to avoid duplicates
   */
  async findSimilarContext(context) {
    try {
      const filters = {
        userId: context.userId,
        type: context.type,
        key: context.key,
        isActive: true
      }
      
      return await this.getContexts(filters)
    } catch (error) {
      console.error('Error finding similar context:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get user contexts with optional filters
   */
  async getContexts(filters = {}) {
    try {
      // Try cache first
      const cacheKey = `${this.cacheKey}_${JSON.stringify(filters)}`
      const cachedContexts = await cacheService.get(cacheKey)
      if (cachedContexts) {
        return { success: true, data: cachedContexts.map(c => new UserContext(c)) }
      }

      // Get from PocketBase
      if (pocketbaseService.isAuthenticated()) {
        const result = await pocketbaseService.getList(this.contextCollection, {
          filter: this.buildFilterString(filters),
          sort: '-updated'
        })
        
        if (result.success) {
          const contexts = result.data.items.map(record => UserContext.fromPocketBase(record))
          
          // Cache results
          await cacheService.set(cacheKey, contexts, 300) // 5 minutes cache
          
          return { success: true, data: contexts }
        }
      }

      return { success: false, error: 'No contexts found' }
    } catch (error) {
      console.error('Error getting contexts:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get active contexts for a user (for AI prompt context)
   */
  async getActiveContexts(userId, limit = 50) {
    return await this.getContexts({
      userId,
      isActive: true,
      limit
    })
  }

  /**
   * Update context
   */
  async updateContext(id, updates) {
    try {
      if (pocketbaseService.isAuthenticated()) {
        const result = await pocketbaseService.update(this.contextCollection, id, updates.toPocketBase())
        
        if (result.success) {
          const context = UserContext.fromPocketBase(result.data)
          await this.cacheContext(context)
          return { success: true, data: context }
        }
      }

      return { success: false, error: 'Failed to update context' }
    } catch (error) {
      console.error('Error updating context:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Store task suggestion
   */
  async storeTaskSuggestion(suggestionData) {
    try {
      const suggestion = new TaskSuggestion(suggestionData)
      
      let result
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(this.taskSuggestionCollection, suggestion.toPocketBase())
        
        if (result.success) {
          suggestion.id = result.data.id
          suggestion.createdAt = new Date(result.data.created)
          suggestion.updatedAt = new Date(result.data.updated)
        }
      } else {
        suggestion.id = 'local_' + Date.now()
        result = { success: true, data: suggestion }
      }

      return { success: true, data: suggestion }
    } catch (error) {
      console.error('Error storing task suggestion:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Store event suggestion
   */
  async storeEventSuggestion(suggestionData) {
    try {
      const suggestion = new EventSuggestion(suggestionData)
      
      let result
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(this.eventSuggestionCollection, suggestion.toPocketBase())
        
        if (result.success) {
          suggestion.id = result.data.id
          suggestion.createdAt = new Date(result.data.created)
          suggestion.updatedAt = new Date(result.data.updated)
        }
      } else {
        suggestion.id = 'local_' + Date.now()
        result = { success: true, data: suggestion }
      }

      return { success: true, data: suggestion }
    } catch (error) {
      console.error('Error storing event suggestion:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get suggestions for user
   */
  async getSuggestions(userId, type = 'all') { // 'all', 'tasks', 'events'
    try {
      const results = {}
      
      if (type === 'all' || type === 'tasks') {
        const taskResult = await this.getTaskSuggestions(userId)
        results.tasks = taskResult.success ? taskResult.data : []
      }
      
      if (type === 'all' || type === 'events') {
        const eventResult = await this.getEventSuggestions(userId)
        results.events = eventResult.success ? eventResult.data : []
      }
      
      return { success: true, data: results }
    } catch (error) {
      console.error('Error getting suggestions:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get task suggestions
   */
  async getTaskSuggestions(userId, status = 'suggested') {
    try {
      if (pocketbaseService.isAuthenticated()) {
        const result = await pocketbaseService.getList(this.taskSuggestionCollection, {
          filter: `user_id = "${userId}" && status = "${status}"`,
          sort: '-created'
        })
        
        if (result.success) {
          const suggestions = result.data.items.map(record => TaskSuggestion.fromPocketBase(record))
          return { success: true, data: suggestions }
        }
      }

      return { success: false, error: 'No task suggestions found' }
    } catch (error) {
      console.error('Error getting task suggestions:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get event suggestions
   */
  async getEventSuggestions(userId, status = 'suggested') {
    try {
      if (pocketbaseService.isAuthenticated()) {
        const result = await pocketbaseService.getList(this.eventSuggestionCollection, {
          filter: `user_id = "${userId}" && status = "${status}"`,
          sort: '-created'
        })
        
        if (result.success) {
          const suggestions = result.data.items.map(record => EventSuggestion.fromPocketBase(record))
          return { success: true, data: suggestions }
        }
      }

      return { success: false, error: 'No event suggestions found' }
    } catch (error) {
      console.error('Error getting event suggestions:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Build filter string for PocketBase queries
   */
  buildFilterString(filters) {
    const conditions = []
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== 'limit') {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        if (typeof value === 'string') {
          conditions.push(`${dbKey} = "${value}"`)
        } else if (typeof value === 'boolean') {
          conditions.push(`${dbKey} = ${value}`)
        } else {
          conditions.push(`${dbKey} = "${value}"`)
        }
      }
    })
    
    return conditions.join(' && ')
  }

  /**
   * Cache context locally
   */
  async cacheContext(context) {
    try {
      const cacheKey = `${this.cacheKey}_${context.id}`
      await cacheService.set(cacheKey, context, 3600) // 1 hour cache
    } catch (error) {
      console.error('Error caching context:', error)
    }
  }

  /**
   * Get context summary for AI prompts
   */
  async getContextSummaryForPrompt(userId) {
    try {
      const contextsResult = await this.getActiveContexts(userId, 20)
      
      if (!contextsResult.success || !contextsResult.data.length) {
        return { success: true, data: '' }
      }

      const contexts = contextsResult.data
      const summary = []

      // Group by category
      const groupedContexts = contexts.reduce((acc, context) => {
        if (!acc[context.category]) acc[context.category] = []
        acc[context.category].push(context)
        return acc
      }, {})

      Object.entries(groupedContexts).forEach(([category, categoryContexts]) => {
        const items = categoryContexts
          .filter(c => c.confidence > 0.5) // Only include confident contexts
          .slice(0, 5) // Limit per category
          .map(c => `${c.key}: ${c.value}`)
        
        if (items.length > 0) {
          summary.push(`${category}: ${items.join(', ')}`)
        }
      })

      return { 
        success: true, 
        data: summary.length > 0 ? `User context: ${summary.join('; ')}` : ''
      }
    } catch (error) {
      console.error('Error getting context summary:', error)
      return { success: false, error: error.message }
    }
  }
}

export const userContextService = new UserContextService()
export default userContextService