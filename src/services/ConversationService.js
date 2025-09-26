/**
 * Conversation Service
 * Handles CRUD operations for conversation logs with PocketBase backend and local caching
 */
import { ConversationLog, Message } from 'src/models'
import { pocketbaseService } from './pocketbase.js'
import { cacheService } from './cache.js'

class ConversationService {
  constructor() {
    this.collection = 'conversations'
    this.cacheKey = 'jarvis_conversations'
    this.activeConversationKey = 'jarvis_active_conversation'
  }

  /**
   * Create a new conversation
   */
  async create(conversationData) {
    try {
      const conversation = new ConversationLog(conversationData)
      const errors = conversation.validate()
      
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to create in PocketBase first
      let result
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(this.collection, conversation.toPocketBase())
        
        if (result.success) {
          conversation.id = result.data.id
          conversation.createdAt = new Date(result.data.created)
          conversation.updatedAt = new Date(result.data.updated)
        }
      } else {
        // Offline mode - generate local ID
        conversation.id = 'local_' + Date.now()
        result = { success: true, data: conversation }
      }

      // Cache the conversation locally
      await this.cacheConversation(conversation)
      
      return { success: true, data: conversation }
    } catch (error) {
      console.error('Error creating conversation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Start a new conversation session
   */
  async startNewSession(title = '') {
    const sessionId = 'session_' + Date.now()
    const currentUser = pocketbaseService.getCurrentUser()
    
    const conversationData = {
      sessionId,
      title,
      userId: currentUser?.id,
      isActive: true,
      messages: []
    }

    const result = await this.create(conversationData)
    if (result.success) {
      await this.setActiveConversation(result.data.id)
    }
    
    return result
  }

  /**
   * Get conversation by ID
   */
  async get(id) {
    try {
      // Try cache first
      const cachedConversation = await cacheService.get(`${this.cacheKey}_${id}`)
      if (cachedConversation) {
        return { success: true, data: new ConversationLog(cachedConversation) }
      }

      // Try PocketBase
      if (pocketbaseService.isAuthenticated()) {
        const result = await pocketbaseService.get(this.collection, id)
        if (result.success) {
          const conversation = ConversationLog.fromPocketBase(result.data)
          await this.cacheConversation(conversation)
          return { success: true, data: conversation }
        }
      }

      return { success: false, error: 'Conversation not found' }
    } catch (error) {
      console.error('Error getting conversation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all conversations for current user
   */
  async getAll(filters = {}) {
    try {
      let conversations = []

      // Try PocketBase first
      if (pocketbaseService.isAuthenticated()) {
        const currentUser = pocketbaseService.getCurrentUser()
        const filter = `user_id = "${currentUser.id}"`
        const result = await pocketbaseService.getAll(this.collection, filter, '-last_message_at')
        
        if (result.success) {
          conversations = result.data.map(record => ConversationLog.fromPocketBase(record))
          // Update cache
          await this.cacheConversations(conversations)
        }
      }

      // Fallback to cache if PocketBase fails or offline
      if (conversations.length === 0) {
        const cachedConversations = await cacheService.get(this.cacheKey) || []
        conversations = cachedConversations.map(conversationData => new ConversationLog(conversationData))
      }

      // Apply filters
      conversations = this.applyFilters(conversations, filters)

      return { success: true, data: conversations }
    } catch (error) {
      console.error('Error getting conversations:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update conversation
   */
  async update(id, updates) {
    try {
      // Get existing conversation
      const existingResult = await this.get(id)
      if (!existingResult.success) {
        return existingResult
      }

      const conversation = existingResult.data
      Object.assign(conversation, updates)
      conversation.updatedAt = new Date()

      const errors = conversation.validate()
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to update in PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith('local_')) {
        const result = await pocketbaseService.update(this.collection, id, conversation.toPocketBase())
        if (result.success) {
          conversation.updatedAt = new Date(result.data.updated)
        }
      }

      // Update cache
      await this.cacheConversation(conversation)

      return { success: true, data: conversation }
    } catch (error) {
      console.error('Error updating conversation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete conversation
   */
  async delete(id) {
    try {
      // Try to delete from PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith('local_')) {
        await pocketbaseService.delete(this.collection, id)
      }

      // Remove from cache
      await cacheService.remove(`${this.cacheKey}_${id}`)
      
      // Remove from conversations list cache
      const cachedConversations = await cacheService.get(this.cacheKey) || []
      const updatedConversations = cachedConversations.filter(conversation => conversation.id !== id)
      await cacheService.set(this.cacheKey, updatedConversations)

      // Clear active conversation if it was deleted
      const activeId = await this.getActiveConversationId()
      if (activeId === id) {
        await cacheService.remove(this.activeConversationKey)
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting conversation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(conversationId, messageData) {
    try {
      const conversationResult = await this.get(conversationId)
      if (!conversationResult.success) {
        return conversationResult
      }

      const conversation = conversationResult.data
      const message = conversation.addMessage(messageData)

      // Update conversation in storage
      const updateResult = await this.update(conversationId, {
        messages: conversation.messages,
        lastMessageAt: conversation.lastMessageAt,
        title: conversation.title // In case title was auto-generated
      })

      if (updateResult.success) {
        return { success: true, data: message }
      }

      return updateResult
    } catch (error) {
      console.error('Error adding message:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get active conversation
   */
  async getActiveConversation() {
    const activeId = await this.getActiveConversationId()
    if (activeId) {
      return this.get(activeId)
    }
    return { success: false, error: 'No active conversation' }
  }

  /**
   * Get active conversation ID
   */
  async getActiveConversationId() {
    return await cacheService.get(this.activeConversationKey)
  }

  /**
   * Set active conversation
   */
  async setActiveConversation(conversationId) {
    await cacheService.set(this.activeConversationKey, conversationId)
  }

  /**
   * Clear active conversation
   */
  async clearActiveConversation() {
    await cacheService.remove(this.activeConversationKey)
  }

  /**
   * Close/deactivate conversation
   */
  async close(id) {
    return this.update(id, { isActive: false })
  }

  /**
   * Reopen/activate conversation
   */
  async reopen(id) {
    const result = await this.update(id, { isActive: true })
    if (result.success) {
      await this.setActiveConversation(id)
    }
    return result
  }

  /**
   * Search conversations and messages
   */
  async search(query) {
    const result = await this.getAll()
    if (result.success) {
      const lowercaseQuery = query.toLowerCase()
      const searchResults = result.data.filter(conversation => {
        // Search in title
        if (conversation.title.toLowerCase().includes(lowercaseQuery)) {
          return true
        }
        
        // Search in messages
        return conversation.searchMessages(query).length > 0
      })
      return { success: true, data: searchResults }
    }
    return result
  }

  /**
   * Get recent conversations
   */
  async getRecent(limit = 10) {
    const result = await this.getAll()
    if (result.success) {
      const recentConversations = result.data
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
        .slice(0, limit)
      return { success: true, data: recentConversations }
    }
    return result
  }

  /**
   * Get active conversations
   */
  async getActive() {
    return this.getAll({ isActive: true })
  }

  /**
   * Export conversation to text
   */
  async exportToText(conversationId) {
    const result = await this.get(conversationId)
    if (result.success) {
      return { success: true, data: result.data.exportToText() }
    }
    return result
  }

  /**
   * Get conversation statistics
   */
  async getStats() {
    const result = await this.getAll()
    if (result.success) {
      const conversations = result.data
      const totalConversations = conversations.length
      const activeConversations = conversations.filter(c => c.isActive).length
      const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0)
      const averageMessagesPerConversation = totalConversations > 0 ? totalMessages / totalConversations : 0
      
      const longestConversation = conversations.reduce((longest, current) => 
        current.messages.length > longest.messages.length ? current : longest,
        { messages: [] }
      )

      return {
        success: true,
        data: {
          totalConversations,
          activeConversations,
          totalMessages,
          averageMessagesPerConversation: Math.round(averageMessagesPerConversation * 100) / 100,
          longestConversation: longestConversation.messages.length > 0 ? {
            id: longestConversation.id,
            title: longestConversation.title,
            messageCount: longestConversation.messages.length
          } : null
        }
      }
    }
    return result
  }

  /**
   * Cache a single conversation
   */
  async cacheConversation(conversation) {
    await cacheService.set(`${this.cacheKey}_${conversation.id}`, conversation)
    
    // Also update the conversations list cache
    const cachedConversations = await cacheService.get(this.cacheKey) || []
    const existingIndex = cachedConversations.findIndex(c => c.id === conversation.id)
    
    if (existingIndex >= 0) {
      cachedConversations[existingIndex] = conversation
    } else {
      cachedConversations.push(conversation)
    }
    
    await cacheService.set(this.cacheKey, cachedConversations)
  }

  /**
   * Cache multiple conversations
   */
  async cacheConversations(conversations) {
    await cacheService.set(this.cacheKey, conversations)
    
    // Also cache individual conversations
    for (const conversation of conversations) {
      await cacheService.set(`${this.cacheKey}_${conversation.id}`, conversation)
    }
  }

  /**
   * Apply filters to conversation list
   */
  applyFilters(conversations, filters) {
    let filteredConversations = [...conversations]

    if (filters.isActive !== undefined) {
      filteredConversations = filteredConversations.filter(conv => conv.isActive === filters.isActive)
    }

    if (filters.sessionId) {
      filteredConversations = filteredConversations.filter(conv => conv.sessionId === filters.sessionId)
    }

    if (filters.createdAfter) {
      const afterDate = new Date(filters.createdAfter)
      filteredConversations = filteredConversations.filter(conv => conv.createdAt >= afterDate)
    }

    if (filters.createdBefore) {
      const beforeDate = new Date(filters.createdBefore)
      filteredConversations = filteredConversations.filter(conv => conv.createdAt <= beforeDate)
    }

    if (filters.hasMessages !== undefined) {
      if (filters.hasMessages) {
        filteredConversations = filteredConversations.filter(conv => conv.messages.length > 0)
      } else {
        filteredConversations = filteredConversations.filter(conv => conv.messages.length === 0)
      }
    }

    // Sort by last message date (most recent first) by default
    filteredConversations.sort((a, b) => {
      const aDate = a.lastMessageAt || a.createdAt
      const bDate = b.lastMessageAt || b.createdAt
      return bDate - aDate
    })

    return filteredConversations
  }

  /**
   * Sync local changes with PocketBase
   */
  async sync() {
    try {
      if (!pocketbaseService.isAuthenticated()) {
        return { success: false, error: 'Not authenticated' }
      }

      const cachedConversations = await cacheService.get(this.cacheKey) || []
      const localConversations = cachedConversations.filter(conversation => conversation.id.startsWith('local_'))
      
      const results = []
      
      for (const localConversation of localConversations) {
        // Remove local ID and create in PocketBase
        const conversationData = { ...localConversation }
        delete conversationData.id
        
        const result = await pocketbaseService.create(this.collection, new ConversationLog(conversationData).toPocketBase())
        
        if (result.success) {
          // Update cache with new ID
          const newConversation = ConversationLog.fromPocketBase(result.data)
          await this.cacheConversation(newConversation)
          
          // Remove old local cache entry
          await cacheService.remove(`${this.cacheKey}_${localConversation.id}`)
          
          // Update active conversation ID if needed
          const activeId = await this.getActiveConversationId()
          if (activeId === localConversation.id) {
            await this.setActiveConversation(newConversation.id)
          }
          
          results.push({ localId: localConversation.id, newId: newConversation.id, success: true })
        } else {
          results.push({ localId: localConversation.id, success: false, error: result.error })
        }
      }

      return { success: true, data: results }
    } catch (error) {
      console.error('Error syncing conversations:', error)
      return { success: false, error: error.message }
    }
  }
}

export const conversationService = new ConversationService()
export default conversationService