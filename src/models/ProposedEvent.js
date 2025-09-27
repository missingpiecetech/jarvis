/**
 * ProposedEvent data model
 * Represents AI-suggested events that users can review and add to their calendar
 */
export class ProposedEvent {
  constructor(data = {}) {
    this.id = data.id || null
    this.title = data.title || ''
    this.description = data.description || ''
    this.startDate = data.startDate ? new Date(data.startDate) : null
    this.endDate = data.endDate ? new Date(data.endDate) : null
    this.isAllDay = data.isAllDay || false
    this.location = data.location || ''
    this.cost = data.cost || null
    this.isOnline = data.isOnline || false
    this.isRecurring = data.isRecurring || false
    this.recurrence = data.recurrence || null
    this.url = data.url || ''
    this.organizer = data.organizer || ''
    this.category = data.category || ''
    this.tags = data.tags || []
    this.distance = data.distance || null // Distance from user's location
    this.status = data.status || 'pending' // pending, accepted, declined, archived
    this.userId = data.userId || null
    this.searchQuery = data.searchQuery || '' // Original search query that found this event
    this.source = data.source || '' // AI or external API source
    this.confidence = data.confidence || 0 // AI confidence score 0-100
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date()
    this.archivedAt = data.archivedAt ? new Date(data.archivedAt) : null
  }

  /**
   * Create a ProposedEvent instance from PocketBase record
   */
  static fromPocketBase(record) {
    return new ProposedEvent({
      id: record.id,
      title: record.title,
      description: record.description,
      startDate: record.start_date,
      endDate: record.end_date,
      isAllDay: record.is_all_day,
      location: record.location,
      cost: record.cost,
      isOnline: record.is_online,
      isRecurring: record.is_recurring,
      recurrence: record.recurrence ? JSON.parse(record.recurrence) : null,
      url: record.url,
      organizer: record.organizer,
      category: record.category,
      tags: record.tags ? JSON.parse(record.tags) : [],
      distance: record.distance,
      status: record.status,
      userId: record.user_id,
      searchQuery: record.search_query,
      source: record.source,
      confidence: record.confidence,
      createdAt: record.created,
      updatedAt: record.updated,
      archivedAt: record.archived_at
    })
  }

  /**
   * Convert ProposedEvent instance to PocketBase format
   */
  toPocketBase() {
    return {
      title: this.title,
      description: this.description,
      start_date: this.startDate ? this.startDate.toISOString() : null,
      end_date: this.endDate ? this.endDate.toISOString() : null,
      is_all_day: this.isAllDay,
      location: this.location,
      cost: this.cost,
      is_online: this.isOnline,
      is_recurring: this.isRecurring,
      recurrence: this.recurrence ? JSON.stringify(this.recurrence) : null,
      url: this.url,
      organizer: this.organizer,
      category: this.category,
      tags: JSON.stringify(this.tags),
      distance: this.distance,
      status: this.status,
      user_id: this.userId,
      search_query: this.searchQuery,
      source: this.source,
      confidence: this.confidence,
      archived_at: this.archivedAt ? this.archivedAt.toISOString() : null
    }
  }

  /**
   * Convert to regular Event for adding to calendar
   */
  toEvent() {
    return {
      title: this.title,
      description: this.description,
      startDate: this.startDate,
      endDate: this.endDate,
      isAllDay: this.isAllDay,
      location: this.location,
      status: 'confirmed',
      visibility: 'private',
      color: '#4CAF50', // Green for AI-suggested events
      recurrence: this.recurrence,
      reminders: [{ minutes: 15 }] // Default reminder for proposed events
    }
  }

  /**
   * Get formatted cost string
   */
  getCostString() {
    if (this.cost === null || this.cost === 0) return 'Free'
    if (typeof this.cost === 'number') return `$${this.cost}`
    return this.cost.toString()
  }

  /**
   * Get formatted date range string
   */
  getDateRangeString() {
    if (!this.startDate) return ''
    
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: this.isAllDay ? undefined : '2-digit',
      minute: this.isAllDay ? undefined : '2-digit'
    }
    
    const startStr = this.startDate.toLocaleDateString('en-US', options)
    
    if (!this.endDate) return startStr
    
    const endStr = this.endDate.toLocaleDateString('en-US', options)
    
    // Same day event
    if (this.startDate.toDateString() === this.endDate.toDateString()) {
      if (this.isAllDay) {
        return startStr
      } else {
        const endTime = this.endDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit'
        })
        return `${startStr} - ${endTime}`
      }
    }
    
    return `${startStr} - ${endStr}`
  }

  /**
   * Get distance string with units
   */
  getDistanceString() {
    if (this.distance === null) return ''
    if (this.distance < 1) return `${(this.distance * 1000).toFixed(0)}m away`
    return `${this.distance.toFixed(1)}km away`
  }

  /**
   * Check if event is in the past
   */
  isPast() {
    return this.endDate && this.endDate < new Date()
  }

  /**
   * Check if event is upcoming
   */
  isUpcoming() {
    return this.startDate && this.startDate > new Date()
  }

  /**
   * Archive the proposed event
   */
  archive() {
    this.status = 'archived'
    this.archivedAt = new Date()
  }

  /**
   * Accept the proposed event
   */
  accept() {
    this.status = 'accepted'
  }

  /**
   * Decline the proposed event
   */
  decline() {
    this.status = 'declined'
  }

  /**
   * Validate proposed event data
   */
  validate() {
    const errors = []
    
    if (!this.title?.trim()) {
      errors.push('Title is required')
    }
    
    if (!this.startDate) {
      errors.push('Start date is required')
    }
    
    if (this.startDate && this.endDate && this.startDate >= this.endDate) {
      errors.push('End date must be after start date')
    }
    
    const validStatuses = ['pending', 'accepted', 'declined', 'archived']
    if (!validStatuses.includes(this.status)) {
      errors.push('Status must be one of: ' + validStatuses.join(', '))
    }
    
    return errors
  }
}