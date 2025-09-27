/**
 * Chat Event Service
 * Handles event management through natural language commands in chat
 */
import { eventService } from './EventService.js'
import { Event } from 'src/models'

class ChatEventService {
  constructor() {
    this.eventService = eventService
  }

  /**
   * Parse a user message for event-related intents and entities
   */
  parseEventIntent(message) {
    const lowerMessage = message.toLowerCase()
    
    // Intent patterns
    const createPatterns = [
      /(?:create|add|schedule|make|book)\s+(?:an?\s+)?(?:event|meeting|appointment)/i,
      /(?:i\s+have\s+a|schedule\s+a|set\s+up\s+a)\s+(?:meeting|appointment|event)/i,
      /(?:meeting\s+(?:with|at)|appointment\s+(?:with|at))/i
    ]
    
    const editPatterns = [
      /(?:edit|update|modify|change|reschedule)\s+(?:the\s+)?(?:event|meeting|appointment)/i,
      /(?:move|change\s+time)\s+(?:my\s+)?(?:meeting|appointment|event)/i
    ]
    
    const deletePatterns = [
      /(?:delete|remove|cancel)\s+(?:the\s+)?(?:event|meeting|appointment)/i,
      /(?:cancel\s+my)\s+(?:meeting|appointment|event)/i
    ]
    
    const listPatterns = [
      /(?:show|list|get|see)\s+(?:my\s+)?(?:events|meetings|appointments|calendar|schedule)/i,
      /(?:what's\s+on\s+my\s+(?:calendar|schedule))/i,
      /(?:what\s+(?:events|meetings|appointments)\s+do\s+i\s+have)/i
    ]
    
    const todayPatterns = [
      /(?:what's\s+(?:on\s+my\s+calendar|scheduled)\s+today)/i,
      /(?:today's\s+(?:schedule|events|meetings|appointments))/i,
      /(?:what\s+do\s+i\s+have\s+today)/i
    ]
    
    const upcomingPatterns = [
      /(?:upcoming\s+(?:events|meetings|appointments))/i,
      /(?:what's\s+coming\s+up|next\s+on\s+my\s+calendar)/i,
      /(?:future\s+(?:events|meetings|appointments))/i
    ]

    // Determine intent
    let intent = 'unknown'
    if (createPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'create_event'
    } else if (editPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'edit_event'
    } else if (deletePatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'delete_event'
    } else if (listPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'list_events'
    } else if (todayPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'query_today_events'
    } else if (upcomingPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'query_upcoming_events'
    }

    // Extract entities
    const entities = this.extractEventEntities(message)

    return {
      intent,
      entities,
      confidence: this.calculateConfidence(intent, entities, message)
    }
  }

  /**
   * Extract event entities from message (title, time, location, etc.)
   */
  extractEventEntities(message) {
    const entities = {}
    
    // Extract times
    const timePatterns = [
      { pattern: /(?:at\s+)?(\d{1,2}:\d{2}\s*(?:am|pm))/gi, type: 'time' },
      { pattern: /(?:at\s+)?(\d{1,2}\s*(?:am|pm))/gi, type: 'time' },
      { pattern: /(?:at\s+)?(\d{1,2}:\d{2})/gi, type: 'time' }
    ]
    
    for (const timePattern of timePatterns) {
      const matches = Array.from(message.matchAll(timePattern.pattern))
      if (matches.length > 0) {
        entities.startTime = matches[0][1]
        if (matches.length > 1) {
          entities.endTime = matches[1][1]
        }
        break
      }
    }
    
    // Extract dates
    const datePatterns = [
      { pattern: /(?:today)/i, value: 'today' },
      { pattern: /(?:tomorrow)/i, value: 'tomorrow' },
      { pattern: /(?:this\s+week)/i, value: 'this_week' },
      { pattern: /(?:next\s+week)/i, value: 'next_week' },
      { pattern: /(?:on\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i, value: 'specific_date' },
      { pattern: /(?:on\s+)?(\d{1,2}-\d{1,2}(?:-\d{2,4})?)/i, value: 'specific_date' },
      { pattern: /(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, value: 'day_of_week' }
    ]
    
    for (const datePattern of datePatterns) {
      const match = message.match(datePattern.pattern)
      if (match) {
        if (datePattern.value === 'specific_date' || datePattern.value === 'day_of_week') {
          entities.date = match[1]
        } else {
          entities.date = datePattern.value
        }
        break
      }
    }
    
    // Extract location
    const locationPatterns = [
      /(?:at|in|@)\s+([^,.!?]+?)(?:\s+(?:on|at|for|with)|$)/i,
      /(?:location:|venue:)\s*([^,.!?]+)/i
    ]
    
    for (const locationPattern of locationPatterns) {
      const match = message.match(locationPattern)
      if (match && match[1].trim().length > 0) {
        const location = match[1].trim()
        // Filter out time-related words that might be captured
        if (!/^\d+|\b(?:am|pm|o'clock|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(location)) {
          entities.location = location
          break
        }
      }
    }
    
    // Extract participants/attendees
    const participantPatterns = [
      /(?:with|attendees?:|participants?:)\s+([^,.!?]+)/i,
      /(?:meeting\s+with|appointment\s+with)\s+([^,.!?]+)/i
    ]
    
    for (const participantPattern of participantPatterns) {
      const match = message.match(participantPattern)
      if (match && match[1].trim().length > 0) {
        entities.participants = match[1].trim().split(/\s+and\s+|\s*,\s*/)
        break
      }
    }
    
    // Extract duration
    const durationPatterns = [
      /(?:for|lasting)\s+(\d+)\s*(?:hour|hr)s?/i,
      /(?:for|lasting)\s+(\d+)\s*(?:minute|min)s?/i,
      /(?:for|lasting)\s+(\d+\.\d+|\d+)\s*hours?/i
    ]
    
    for (const durationPattern of durationPatterns) {
      const match = message.match(durationPattern)
      if (match) {
        entities.duration = match[1]
        entities.durationUnit = match[0].includes('hour') || match[0].includes('hr') ? 'hours' : 'minutes'
        break
      }
    }
    
    // Extract event title (remaining text after removing command words and entities)
    let title = message
      .replace(/(?:create|add|schedule|make|book|i\s+have\s+a|schedule\s+a|set\s+up\s+a)\s+(?:an?\s+)?(?:event|meeting|appointment)/gi, '')
      .replace(/(?:at\s+)?(\d{1,2}:\d{2}\s*(?:am|pm))/gi, '')
      .replace(/(?:at\s+)?(\d{1,2}\s*(?:am|pm))/gi, '')
      .replace(/(?:at\s+)?(\d{1,2}:\d{2})/gi, '')
      .replace(/(?:today|tomorrow|this\s+week|next\s+week)/gi, '')
      .replace(/(?:on\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/gi, '')
      .replace(/(?:on\s+)?(\d{1,2}-\d{1,2}(?:-\d{2,4})?)/gi, '')
      .replace(/(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '')
      .replace(/(?:at|in|@)\s+([^,.!?]+?)(?:\s+(?:on|at|for|with)|$)/gi, '')
      .replace(/(?:with|attendees?:|participants?:)\s+([^,.!?]+)/gi, '')
      .replace(/(?:for|lasting)\s+(\d+)\s*(?:hour|hr|minute|min)s?/gi, '')
      .trim()
    
    if (title && title.length > 0) {
      entities.title = title
    }
    
    return entities
  }

  /**
   * Calculate confidence score for parsed intent
   */
  calculateConfidence(intent, entities, message) {
    let confidence = 0.5 // Base confidence
    
    if (intent !== 'unknown') {
      confidence += 0.3
    }
    
    if (entities.title) {
      confidence += 0.2
    }
    
    if (entities.startTime || entities.date) {
      confidence += 0.2
    }
    
    if (entities.location || entities.participants) {
      confidence += 0.1
    }
    
    return Math.min(confidence, 1.0)
  }

  /**
   * Process event creation from chat
   */
  async processEventCreation(entities, userId) {
    try {
      // Prepare event data
      const eventData = {
        title: entities.title || 'New Event',
        description: this.generateEventDescription(entities),
        location: entities.location || '',
        userId: userId,
        status: 'confirmed',
        visibility: 'private'
      }

      // Process date and time
      const dateTime = this.parseDateTime(entities.date, entities.startTime, entities.endTime, entities.duration, entities.durationUnit)
      
      if (dateTime.startDate) {
        eventData.startDate = dateTime.startDate
        eventData.endDate = dateTime.endDate
        eventData.isAllDay = dateTime.isAllDay
      } else {
        // Default to 1 hour event starting now
        const now = new Date()
        eventData.startDate = now
        eventData.endDate = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour later
        eventData.isAllDay = false
      }

      // Create the event
      const result = await this.eventService.create(eventData)
      
      if (result.success) {
        return {
          success: true,
          event: result.data,
          message: `📅 Created event: "${eventData.title}"${eventData.startDate ? ` on ${this.formatDateTime(eventData.startDate, eventData.endDate, eventData.isAllDay)}` : ''}`
        }
      } else {
        return {
          success: false,
          message: `❌ Failed to create event: ${result.error}`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error creating event: ${error.message}`
      }
    }
  }

  /**
   * Process event deletion from chat
   */
  async processEventDeletion(eventTitle, userId) {
    try {
      // Find events by title
      const eventsResult = await this.eventService.getAll()
      
      if (!eventsResult.success) {
        return {
          success: false,
          message: '❌ Failed to retrieve events'
        }
      }

      const events = eventsResult.data.filter(event => 
        event.userId === userId && 
        event.title.toLowerCase().includes(eventTitle.toLowerCase())
      )

      if (events.length === 0) {
        return {
          success: false,
          message: `❌ No event found matching "${eventTitle}"`
        }
      }

      if (events.length > 1) {
        const eventList = events.map(e => `• ${e.title} - ${this.formatDateTime(e.startDate, e.endDate, e.isAllDay)}`).join('\n')
        return {
          success: false,
          message: `❓ Multiple events found. Please be more specific:\n${eventList}`,
          needsClarification: true,
          events: events
        }
      }

      // Delete the event
      const event = events[0]
      const result = await this.eventService.delete(event.id)
      
      if (result.success) {
        return {
          success: true,
          message: `🗑️ Deleted event: "${event.title}"`
        }
      } else {
        return {
          success: false,
          message: `❌ Failed to delete event: ${result.error}`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error deleting event: ${error.message}`
      }
    }
  }

  /**
   * Query events by various criteria
   */
  async queryEvents(intent, userId) {
    try {
      let title = ''
      let filterFn = null

      switch (intent) {
        case 'list_events':
          title = '📅 Your events:'
          break
        case 'query_today_events':
          title = '📅 Today\'s events:'
          filterFn = (event) => {
            const today = new Date()
            const eventDate = new Date(event.startDate)
            return eventDate.toDateString() === today.toDateString()
          }
          break
        case 'query_upcoming_events':
          title = '📅 Upcoming events:'
          filterFn = (event) => {
            const now = new Date()
            const eventDate = new Date(event.startDate)
            return eventDate > now
          }
          break
      }

      const eventsResult = await this.eventService.getAll()
      
      if (!eventsResult.success) {
        return {
          success: false,
          message: '❌ Failed to retrieve events'
        }
      }

      let events = eventsResult.data.filter(event => event.userId === userId)

      // Apply specific filter
      if (filterFn) {
        events = events.filter(filterFn)
      }

      // Sort by start date
      events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

      if (events.length === 0) {
        const emptyMessages = {
          'list_events': '📅 No events scheduled.',
          'query_today_events': '📅 No events scheduled for today.',
          'query_upcoming_events': '📅 No upcoming events.'
        }
        return {
          success: true,
          message: emptyMessages[intent] || 'No events found.',
          events: []
        }
      }

      // Format event list
      const eventList = events.map(event => {
        let eventStr = `• **${event.title}**`
        eventStr += ` - ${this.formatDateTime(event.startDate, event.endDate, event.isAllDay)}`
        if (event.location) {
          eventStr += ` at ${event.location}`
        }
        return eventStr
      }).join('\n')

      return {
        success: true,
        message: `${title}\n\n${eventList}`,
        events: events
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error querying events: ${error.message}`
      }
    }
  }

  /**
   * Parse date and time from various formats
   */
  parseDateTime(dateStr, startTimeStr, endTimeStr, duration, durationUnit) {
    let startDate = null
    let endDate = null
    let isAllDay = false

    // Parse base date
    const baseDate = this.parseDate(dateStr)
    
    if (!baseDate) {
      return { startDate: null, endDate: null, isAllDay: false }
    }

    // Parse start time
    if (startTimeStr) {
      const startTime = this.parseTime(startTimeStr)
      if (startTime) {
        startDate = new Date(baseDate)
        startDate.setHours(startTime.hours, startTime.minutes, 0, 0)
      }
    }

    if (!startDate) {
      // If no time specified, make it all-day
      startDate = new Date(baseDate)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(baseDate)
      endDate.setHours(23, 59, 59, 999)
      isAllDay = true
      return { startDate, endDate, isAllDay }
    }

    // Parse end time or calculate from duration
    if (endTimeStr) {
      const endTime = this.parseTime(endTimeStr)
      if (endTime) {
        endDate = new Date(baseDate)
        endDate.setHours(endTime.hours, endTime.minutes, 0, 0)
      }
    } else if (duration) {
      const durationMs = this.parseDuration(duration, durationUnit)
      endDate = new Date(startDate.getTime() + durationMs)
    } else {
      // Default 1 hour duration
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
    }

    return { startDate, endDate, isAllDay }
  }

  /**
   * Parse date from various formats
   */
  parseDate(dateStr) {
    if (!dateStr) return new Date() // Default to today

    const now = new Date()
    
    switch (dateStr.toLowerCase()) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate())
      case 'tomorrow':
        const tomorrow = new Date(now)
        tomorrow.setDate(now.getDate() + 1)
        return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
      case 'this_week':
        const thisWeekEnd = new Date(now)
        thisWeekEnd.setDate(now.getDate() + (7 - now.getDay()))
        return thisWeekEnd
      case 'next_week':
        const nextWeek = new Date(now)
        nextWeek.setDate(now.getDate() + 7)
        return nextWeek
      default:
        // Try to parse day of week
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const dayIndex = daysOfWeek.indexOf(dateStr.toLowerCase())
        if (dayIndex !== -1) {
          const targetDate = new Date(now)
          const daysUntilTarget = (dayIndex - now.getDay() + 7) % 7
          targetDate.setDate(now.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget))
          return targetDate
        }
        
        // Try to parse as specific date
        const parsed = new Date(dateStr)
        return isNaN(parsed.getTime()) ? null : parsed
    }
  }

  /**
   * Parse time from various formats
   */
  parseTime(timeStr) {
    const timePatterns = [
      /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i,
      /^(\d{1,2})\s*(am|pm)$/i
    ]

    for (const pattern of timePatterns) {
      const match = timeStr.trim().match(pattern)
      if (match) {
        let hours = parseInt(match[1])
        const minutes = match[2] ? parseInt(match[2]) : 0
        const ampm = match[3] ? match[3].toLowerCase() : null

        if (ampm === 'pm' && hours !== 12) {
          hours += 12
        } else if (ampm === 'am' && hours === 12) {
          hours = 0
        }

        return { hours, minutes }
      }
    }

    return null
  }

  /**
   * Parse duration to milliseconds
   */
  parseDuration(duration, unit) {
    const durationNum = parseFloat(duration)
    
    switch (unit) {
      case 'hours':
        return durationNum * 60 * 60 * 1000
      case 'minutes':
        return durationNum * 60 * 1000
      default:
        return 60 * 60 * 1000 // Default 1 hour
    }
  }

  /**
   * Generate event description from entities
   */
  generateEventDescription(entities) {
    const parts = []
    
    if (entities.participants && entities.participants.length > 0) {
      parts.push(`Attendees: ${entities.participants.join(', ')}`)
    }
    
    if (entities.duration && entities.durationUnit) {
      parts.push(`Duration: ${entities.duration} ${entities.durationUnit}`)
    }
    
    return parts.join('\n')
  }

  /**
   * Format date and time for display
   */
  formatDateTime(startDate, endDate, isAllDay) {
    if (!startDate) return ''
    
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : null
    
    if (isAllDay) {
      return start.toLocaleDateString()
    }
    
    let formatted = start.toLocaleDateString() + ' at ' + start.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
    
    if (end && end.getTime() !== start.getTime()) {
      if (end.toDateString() === start.toDateString()) {
        // Same day
        formatted += ' - ' + end.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      } else {
        // Different day
        formatted += ' - ' + end.toLocaleDateString() + ' at ' + end.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      }
    }
    
    return formatted
  }

  /**
   * Generate enhanced prompt context for AI
   */
  async getEventContext(userId) {
    try {
      const eventsResult = await this.eventService.getAll()
      
      if (!eventsResult.success) {
        return ''
      }

      const events = eventsResult.data.filter(event => event.userId === userId)
      
      if (events.length === 0) {
        return 'The user currently has no scheduled events.'
      }

      const now = new Date()
      const todayEvents = events.filter(event => 
        new Date(event.startDate).toDateString() === now.toDateString()
      )

      const upcomingEvents = events.filter(event => 
        new Date(event.startDate) > now
      ).length

      let context = `Current event summary: ${events.length} total events`
      
      if (todayEvents.length > 0) {
        context += `, ${todayEvents.length} today`
      }
      
      if (upcomingEvents > 0) {
        context += `, ${upcomingEvents} upcoming`
      }

      return context + '.'
    } catch (error) {
      console.error('Error getting event context:', error)
      return ''
    }
  }
}

export const chatEventService = new ChatEventService()
export default chatEventService