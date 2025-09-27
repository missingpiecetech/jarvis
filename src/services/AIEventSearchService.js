/**
 * AI Event Search Service
 * Handles AI-powered event discovery and proposal management
 */
import { ProposedEvent } from 'src/models/ProposedEvent.js'
import { AIService } from './AIService.js'
import { cacheService } from './cache.js'
import { pocketbaseService } from './pocketbase.js'

class AIEventSearchService {
  constructor() {
    this.collection = 'proposed_events'
    this.cacheKey = 'jarvis_proposed_events'
    this.aiService = new AIService()
  }

  /**
   * Search for events using AI based on user criteria
   */
  async searchEvents(criteria) {
    try {
      const {
        topic = '',
        location = '',
        distance = null,
        cost = null,
        isOnline = null,
        dateRange = {},
        isRecurring = null,
        category = ''
      } = criteria

      // Build search prompt for AI
      const prompt = this.buildSearchPrompt(criteria)
      
      // Query AI for event suggestions
      const aiResponse = await this.aiService.sendMessage([
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        maxTokens: 2048,
        extractContext: false
      })

      if (!aiResponse.success) {
        return { success: false, error: aiResponse.error }
      }

      // Parse AI response into proposed events
      const proposedEvents = this.parseAIResponse(aiResponse.content, criteria)
      
      // Filter out events that were previously declined/archived
      const filteredEvents = await this.filterDuplicates(proposedEvents)
      
      // Store proposed events
      const savedEvents = []
      for (const event of filteredEvents) {
        const result = await this.create(event)
        if (result.success) {
          savedEvents.push(result.data)
        }
      }

      return {
        success: true,
        data: savedEvents,
        total: savedEvents.length,
        filtered: proposedEvents.length - filteredEvents.length
      }
    } catch (error) {
      console.error('Error searching events:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Build search prompt for AI
   */
  buildSearchPrompt(criteria) {
    let prompt = `As an event discovery assistant, find and suggest relevant events based on these criteria:

**Search Criteria:**
- Topic/Interest: ${criteria.topic || 'Any'}
- Location: ${criteria.location || 'Any location'}
${criteria.distance ? `- Maximum distance: ${criteria.distance}km` : ''}
${criteria.cost !== null ? `- Cost preference: ${criteria.cost === 0 ? 'Free events only' : `Up to $${criteria.cost}`}` : ''}
${criteria.isOnline !== null ? `- Format: ${criteria.isOnline ? 'Online events only' : 'In-person events only'}` : ''}
${criteria.dateRange.start ? `- Date range: ${criteria.dateRange.start} to ${criteria.dateRange.end || 'ongoing'}` : ''}
${criteria.isRecurring !== null ? `- Type: ${criteria.isRecurring ? 'Recurring events only' : 'Single events only'}` : ''}
${criteria.category ? `- Category: ${criteria.category}` : ''}

Please suggest 5-10 relevant events that match these criteria. For each event, provide:

**Required Information:**
- Title
- Description (brief, 1-2 sentences)
- Start date and time
- End date and time (if applicable)
- Location (specific address or "Online")
- Cost (number for paid events, 0 for free)
- Organizer/Host
- Category (e.g., Technology, Arts, Sports, Education, Business)
- Whether it's recurring (and recurrence pattern if so)
- URL/Website (if available)

**Response Format:**
Respond with a JSON array of events. Each event should be a JSON object with these exact keys:
title, description, startDate, endDate, location, cost, organizer, category, isRecurring, recurrence, url, isOnline

Example:
[
  {
    "title": "Weekly JavaScript Meetup",
    "description": "Learn modern JavaScript techniques with local developers.",
    "startDate": "2025-01-15T18:00:00",
    "endDate": "2025-01-15T20:00:00",
    "location": "Tech Hub, 123 Main St",
    "cost": 0,
    "organizer": "JS Developers Group",
    "category": "Technology",
    "isRecurring": true,
    "recurrence": {"type": "weekly", "interval": 1, "days": ["Wednesday"]},
    "url": "https://example.com/meetup",
    "isOnline": false
  }
]

Focus on real, plausible events. Avoid fictional or overly generic suggestions.`

    return prompt
  }

  /**
   * Parse AI response into ProposedEvent objects
   */
  parseAIResponse(aiContent, originalCriteria) {
    try {
      // Try to extract JSON from AI response
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.warn('No JSON found in AI response')
        return []
      }

      const eventsData = JSON.parse(jsonMatch[0])
      
      return eventsData.map(eventData => new ProposedEvent({
        ...eventData,
        startDate: eventData.startDate ? new Date(eventData.startDate) : null,
        endDate: eventData.endDate ? new Date(eventData.endDate) : null,
        isAllDay: this.determineAllDay(eventData.startDate, eventData.endDate),
        distance: this.calculateDistance(eventData.location, originalCriteria.location),
        searchQuery: this.buildSearchQueryString(originalCriteria),
        source: 'AI',
        confidence: 75, // Default confidence for AI suggestions
        tags: this.extractTags(eventData)
      }))
    } catch (error) {
      console.error('Error parsing AI response:', error)
      return []
    }
  }

  /**
   * Filter out events that were previously declined or archived
   */
  async filterDuplicates(proposedEvents) {
    try {
      const existingEvents = await this.getAll({ 
        status: ['declined', 'archived'] 
      })
      
      if (!existingEvents.success) {
        return proposedEvents // If we can't check, include all
      }

      const existingTitlesAndDates = new Set(
        existingEvents.data.map(event => 
          `${event.title.toLowerCase()}_${event.startDate?.toDateString()}`
        )
      )

      return proposedEvents.filter(event => {
        const key = `${event.title.toLowerCase()}_${event.startDate?.toDateString()}`
        return !existingTitlesAndDates.has(key)
      })
    } catch (error) {
      console.error('Error filtering duplicates:', error)
      return proposedEvents
    }
  }

  /**
   * Create a new proposed event
   */
  async create(eventData) {
    try {
      const proposedEvent = new ProposedEvent(eventData)
      const errors = proposedEvent.validate()
      
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to create in PocketBase first
      let result
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(this.collection, proposedEvent.toPocketBase())
        
        if (result.success) {
          proposedEvent.id = result.data.id
          proposedEvent.createdAt = new Date(result.data.created)
          proposedEvent.updatedAt = new Date(result.data.updated)
        }
      } else {
        // Offline mode - generate local ID
        proposedEvent.id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        result = { success: true, data: proposedEvent }
      }

      // Cache the proposed event
      await this.cacheProposedEvent(proposedEvent)
      
      return { success: true, data: proposedEvent }
    } catch (error) {
      console.error('Error creating proposed event:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all proposed events
   */
  async getAll(filters = {}) {
    try {
      let events = []

      // Try PocketBase first
      if (pocketbaseService.isAuthenticated()) {
        const currentUser = pocketbaseService.getCurrentUser()
        let filter = `user_id = "${currentUser.id}"`
        
        // Add status filter
        if (filters.status && Array.isArray(filters.status)) {
          const statusFilter = filters.status.map(s => `status = "${s}"`).join(' || ')
          filter += ` && (${statusFilter})`
        } else if (filters.status) {
          filter += ` && status = "${filters.status}"`
        }
        
        const result = await pocketbaseService.getAll(this.collection, filter, '-created')
        
        if (result.success) {
          events = result.data.map(record => ProposedEvent.fromPocketBase(record))
          await this.cacheProposedEvents(events)
        }
      }

      // Fallback to cache if PocketBase fails or offline
      if (events.length === 0) {
        const cachedEvents = await cacheService.get(this.cacheKey) || []
        events = cachedEvents.map(eventData => this.deserializeProposedEvent(eventData))
      }

      // Apply additional filters
      events = this.applyFilters(events, filters)

      return { success: true, data: events }
    } catch (error) {
      console.error('Error getting proposed events:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update proposed event status
   */
  async updateStatus(id, status, options = {}) {
    try {
      const updates = { status }
      
      if (status === 'archived') {
        updates.archivedAt = new Date()
      }

      // Try to update in PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith('local_')) {
        const result = await pocketbaseService.update(this.collection, id, {
          status,
          archived_at: updates.archivedAt ? updates.archivedAt.toISOString() : null
        })
        
        if (!result.success) {
          return result
        }
      }

      // Update cache
      const cachedEvents = await cacheService.get(this.cacheKey) || []
      const eventIndex = cachedEvents.findIndex(e => e.id === id)
      
      if (eventIndex >= 0) {
        Object.assign(cachedEvents[eventIndex], updates)
        await cacheService.set(this.cacheKey, cachedEvents)
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating proposed event status:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Accept a proposed event and convert to regular event
   */
  async acceptEvent(id, addRecurring = false) {
    try {
      // Get the proposed event
      const cachedEvents = await cacheService.get(this.cacheKey) || []
      const proposedEvent = cachedEvents.find(e => e.id === id)
      
      if (!proposedEvent) {
        return { success: false, error: 'Proposed event not found' }
      }

      // Convert to regular event
      const eventData = new ProposedEvent(proposedEvent).toEvent()
      
      // If it's recurring and user wants to add ongoing
      if (addRecurring && proposedEvent.isRecurring) {
        eventData.recurrence = proposedEvent.recurrence
      }

      // Update status to accepted
      await this.updateStatus(id, 'accepted')

      return { 
        success: true, 
        data: eventData,
        isRecurring: proposedEvent.isRecurring,
        addedRecurring: addRecurring
      }
    } catch (error) {
      console.error('Error accepting proposed event:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Decline a proposed event (archive it)
   */
  async declineEvent(id) {
    return this.updateStatus(id, 'declined')
  }

  // Helper methods

  buildSearchQueryString(criteria) {
    const parts = []
    if (criteria.topic) parts.push(`topic:${criteria.topic}`)
    if (criteria.location) parts.push(`location:${criteria.location}`)
    if (criteria.cost !== null) parts.push(`cost:${criteria.cost}`)
    if (criteria.isOnline !== null) parts.push(`online:${criteria.isOnline}`)
    if (criteria.category) parts.push(`category:${criteria.category}`)
    return parts.join(' ')
  }

  determineAllDay(startDate, endDate) {
    if (!startDate || !endDate) return false
    const start = new Date(startDate)
    const end = new Date(endDate)
    return start.getHours() === 0 && start.getMinutes() === 0 && 
           end.getHours() === 23 && end.getMinutes() === 59
  }

  calculateDistance(eventLocation, userLocation) {
    // Simplified distance calculation - in real implementation would use geocoding
    if (!eventLocation || !userLocation || eventLocation.toLowerCase().includes('online')) {
      return null
    }
    return Math.random() * 20 // Mock distance for now
  }

  extractTags(eventData) {
    const tags = []
    if (eventData.category) tags.push(eventData.category.toLowerCase())
    if (eventData.isOnline) tags.push('online')
    if (eventData.cost === 0) tags.push('free')
    if (eventData.isRecurring) tags.push('recurring')
    return tags
  }

  deserializeProposedEvent(eventData) {
    return new ProposedEvent({
      ...eventData,
      startDate: eventData.startDate ? new Date(eventData.startDate) : null,
      endDate: eventData.endDate ? new Date(eventData.endDate) : null,
      createdAt: eventData.createdAt ? new Date(eventData.createdAt) : null,
      updatedAt: eventData.updatedAt ? new Date(eventData.updatedAt) : null,
      archivedAt: eventData.archivedAt ? new Date(eventData.archivedAt) : null
    })
  }

  async cacheProposedEvent(event) {
    const plainEvent = {
      ...event,
      startDate: event.startDate ? event.startDate.toISOString() : null,
      endDate: event.endDate ? event.endDate.toISOString() : null,
      createdAt: event.createdAt ? event.createdAt.toISOString() : null,
      updatedAt: event.updatedAt ? event.updatedAt.toISOString() : null,
      archivedAt: event.archivedAt ? event.archivedAt.toISOString() : null
    }
    
    await cacheService.set(`${this.cacheKey}_${event.id}`, plainEvent)
    
    const cachedEvents = await cacheService.get(this.cacheKey) || []
    const existingIndex = cachedEvents.findIndex(e => e.id === event.id)
    
    if (existingIndex >= 0) {
      cachedEvents[existingIndex] = plainEvent
    } else {
      cachedEvents.push(plainEvent)
    }
    
    await cacheService.set(this.cacheKey, cachedEvents)
  }

  async cacheProposedEvents(events) {
    const plainEvents = events.map(event => ({
      ...event,
      startDate: event.startDate ? event.startDate.toISOString() : null,
      endDate: event.endDate ? event.endDate.toISOString() : null,
      createdAt: event.createdAt ? event.createdAt.toISOString() : null,
      updatedAt: event.updatedAt ? event.updatedAt.toISOString() : null,
      archivedAt: event.archivedAt ? event.archivedAt.toISOString() : null
    }))
    
    await cacheService.set(this.cacheKey, plainEvents)
    
    for (const plainEvent of plainEvents) {
      await cacheService.set(`${this.cacheKey}_${plainEvent.id}`, plainEvent)
    }
  }

  applyFilters(events, filters) {
    let filteredEvents = [...events]

    if (filters.status && !Array.isArray(filters.status)) {
      filteredEvents = filteredEvents.filter(event => event.status === filters.status)
    }

    if (filters.category) {
      filteredEvents = filteredEvents.filter(event => 
        event.category.toLowerCase().includes(filters.category.toLowerCase())
      )
    }

    if (filters.isUpcoming) {
      filteredEvents = filteredEvents.filter(event => event.isUpcoming())
    }

    // Sort by confidence and date
    filteredEvents.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence
      }
      return (a.startDate || new Date()) - (b.startDate || new Date())
    })

    return filteredEvents
  }
}

export const aiEventSearchService = new AIEventSearchService()
export default aiEventSearchService