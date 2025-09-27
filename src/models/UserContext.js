/**
 * UserContext data model
 * Represents contextual information about the user extracted from conversations
 * Includes tasks, events, facts, preferences, and other insights
 */
export class UserContext {
  constructor(data = {}) {
    this.id = data.id || null
    this.userId = data.userId || null
    this.type = data.type || 'fact' // fact, preference, goal, habit, interest
    this.category = data.category || 'general' // work, personal, health, finance, etc.
    this.key = data.key || '' // Short identifier/key for the context
    this.value = data.value || '' // The actual contextual information
    this.confidence = data.confidence || 0.8 // Confidence level (0-1) of this context
    this.extractedFromConversationId = data.extractedFromConversationId || null
    this.extractedFromMessageId = data.extractedFromMessageId || null
    this.isActive = data.isActive !== undefined ? data.isActive : true
    this.lastConfirmedAt = data.lastConfirmedAt ? new Date(data.lastConfirmedAt) : null
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date()
    this.tags = data.tags || [] // Array of strings for categorization
    this.metadata = data.metadata || {} // Additional metadata
  }

  /**
   * Create a UserContext instance from PocketBase record
   */
  static fromPocketBase(record) {
    return new UserContext({
      id: record.id,
      userId: record.user_id,
      type: record.type,
      category: record.category,
      key: record.key,
      value: record.value,
      confidence: record.confidence,
      extractedFromConversationId: record.extracted_from_conversation_id,
      extractedFromMessageId: record.extracted_from_message_id,
      isActive: record.is_active,
      lastConfirmedAt: record.last_confirmed_at,
      createdAt: record.created,
      updatedAt: record.updated,
      tags: record.tags || [],
      metadata: record.metadata ? JSON.parse(record.metadata) : {}
    })
  }

  /**
   * Convert UserContext instance to PocketBase format
   */
  toPocketBase() {
    return {
      user_id: this.userId,
      type: this.type,
      category: this.category,
      key: this.key,
      value: this.value,
      confidence: this.confidence,
      extracted_from_conversation_id: this.extractedFromConversationId,
      extracted_from_message_id: this.extractedFromMessageId,
      is_active: this.isActive,
      last_confirmed_at: this.lastConfirmedAt ? this.lastConfirmedAt.toISOString() : null,
      tags: this.tags,
      metadata: JSON.stringify(this.metadata)
    }
  }

  /**
   * Mark context as confirmed/validated
   */
  confirm() {
    this.lastConfirmedAt = new Date()
    this.updatedAt = new Date()
    this.confidence = Math.min(1.0, this.confidence + 0.1)
  }

  /**
   * Update the context value
   */
  updateValue(newValue, confidence = null) {
    this.value = newValue
    this.updatedAt = new Date()
    if (confidence !== null) {
      this.confidence = confidence
    }
  }

  /**
   * Deactivate the context
   */
  deactivate() {
    this.isActive = false
    this.updatedAt = new Date()
  }

  /**
   * Check if context is recent (within specified days)
   */
  isRecent(days = 30) {
    const daysSinceUpdate = (new Date() - this.updatedAt) / (1000 * 60 * 60 * 24)
    return daysSinceUpdate <= days
  }

  /**
   * Get context summary for display
   */
  getSummary() {
    return {
      type: this.type,
      category: this.category,
      key: this.key,
      value: this.value.length > 100 ? this.value.substring(0, 100) + '...' : this.value,
      confidence: this.confidence,
      isActive: this.isActive,
      lastUpdated: this.updatedAt
    }
  }

  /**
   * Validate context data
   */
  validate() {
    const errors = []
    
    if (!this.userId) {
      errors.push('User ID is required')
    }
    
    const validTypes = ['fact', 'preference', 'goal', 'habit', 'interest', 'constraint']
    if (!validTypes.includes(this.type)) {
      errors.push('Type must be one of: ' + validTypes.join(', '))
    }
    
    if (!this.key?.trim()) {
      errors.push('Key is required')
    }
    
    if (!this.value?.trim()) {
      errors.push('Value is required')
    }
    
    if (this.confidence < 0 || this.confidence > 1) {
      errors.push('Confidence must be between 0 and 1')
    }
    
    return errors
  }
}

/**
 * TaskSuggestion class for AI-generated task suggestions
 */
export class TaskSuggestion {
  constructor(data = {}) {
    this.id = data.id || null
    this.userId = data.userId || null
    this.title = data.title || ''
    this.description = data.description || ''
    this.priority = data.priority || 'medium'
    this.suggestedDueDate = data.suggestedDueDate ? new Date(data.suggestedDueDate) : null
    this.estimatedDuration = data.estimatedDuration || null
    this.category = data.category || 'general'
    this.tags = data.tags || []
    this.confidence = data.confidence || 0.7
    this.extractedFromConversationId = data.extractedFromConversationId || null
    this.extractedFromMessageId = data.extractedFromMessageId || null
    this.status = data.status || 'suggested' // suggested, accepted, rejected, created
    this.createdTaskId = data.createdTaskId || null // If user creates task from suggestion
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date()
  }

  /**
   * Create a TaskSuggestion instance from PocketBase record
   */
  static fromPocketBase(record) {
    return new TaskSuggestion({
      id: record.id,
      userId: record.user_id,
      title: record.title,
      description: record.description,
      priority: record.priority,
      suggestedDueDate: record.suggested_due_date,
      estimatedDuration: record.estimated_duration,
      category: record.category,
      tags: record.tags || [],
      confidence: record.confidence,
      extractedFromConversationId: record.extracted_from_conversation_id,
      extractedFromMessageId: record.extracted_from_message_id,
      status: record.status,
      createdTaskId: record.created_task_id,
      createdAt: record.created,
      updatedAt: record.updated
    })
  }

  /**
   * Convert to PocketBase format
   */
  toPocketBase() {
    return {
      user_id: this.userId,
      title: this.title,
      description: this.description,
      priority: this.priority,
      suggested_due_date: this.suggestedDueDate ? this.suggestedDueDate.toISOString() : null,
      estimated_duration: this.estimatedDuration,
      category: this.category,
      tags: this.tags,
      confidence: this.confidence,
      extracted_from_conversation_id: this.extractedFromConversationId,
      extracted_from_message_id: this.extractedFromMessageId,
      status: this.status,
      created_task_id: this.createdTaskId
    }
  }

  /**
   * Accept the suggestion and mark for task creation
   */
  accept() {
    this.status = 'accepted'
    this.updatedAt = new Date()
  }

  /**
   * Reject the suggestion
   */
  reject() {
    this.status = 'rejected'
    this.updatedAt = new Date()
  }
}

/**
 * EventSuggestion class for AI-generated event suggestions
 */
export class EventSuggestion extends TaskSuggestion {
  constructor(data = {}) {
    super(data)
    this.suggestedStartDate = data.suggestedStartDate ? new Date(data.suggestedStartDate) : null
    this.suggestedEndDate = data.suggestedEndDate ? new Date(data.suggestedEndDate) : null
    this.location = data.location || ''
    this.isAllDay = data.isAllDay || false
    this.createdEventId = data.createdEventId || null
  }

  /**
   * Create an EventSuggestion instance from PocketBase record
   */
  static fromPocketBase(record) {
    const suggestion = super.fromPocketBase(record)
    suggestion.suggestedStartDate = record.suggested_start_date ? new Date(record.suggested_start_date) : null
    suggestion.suggestedEndDate = record.suggested_end_date ? new Date(record.suggested_end_date) : null
    suggestion.location = record.location || ''
    suggestion.isAllDay = record.is_all_day || false
    suggestion.createdEventId = record.created_event_id || null
    return suggestion
  }

  /**
   * Convert to PocketBase format
   */
  toPocketBase() {
    const base = super.toPocketBase()
    return {
      ...base,
      suggested_start_date: this.suggestedStartDate ? this.suggestedStartDate.toISOString() : null,
      suggested_end_date: this.suggestedEndDate ? this.suggestedEndDate.toISOString() : null,
      location: this.location,
      is_all_day: this.isAllDay,
      created_event_id: this.createdEventId
    }
  }
}