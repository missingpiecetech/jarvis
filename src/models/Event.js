/**
 * Event data model
 * Calendar-agnostic event representation that can sync with various calendar providers
 */
export class Event {
  constructor(data = {}) {
    this.id = data.id || null
    this.title = data.title || ''
    this.description = data.description || ''
    this.startDate = data.startDate ? new Date(data.startDate) : null
    this.endDate = data.endDate ? new Date(data.endDate) : null
    this.isAllDay = data.isAllDay || false
    this.location = data.location || ''
    this.recurrence = data.recurrence || null // Recurrence rule object
    this.reminders = data.reminders || [] // Array of reminder objects
    this.attendees = data.attendees || [] // Array of attendee objects
    this.status = data.status || 'confirmed' // confirmed, tentative, cancelled
    this.visibility = data.visibility || 'private' // private, public
    this.color = data.color || '#1976d2' // Event color
    this.userId = data.userId || null
    this.calendarId = data.calendarId || null // External calendar ID
    this.externalId = data.externalId || null // External event ID (Google, Outlook, etc.)
    this.provider = data.provider || null // google, outlook, apple, etc.
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date()
    this.timezone = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  }

  /**
   * Create an Event instance from PocketBase record
   */
  static fromPocketBase(record) {
    return new Event({
      id: record.id,
      title: record.title,
      description: record.description,
      startDate: record.start_date,
      endDate: record.end_date,
      isAllDay: record.is_all_day,
      location: record.location,
      recurrence: record.recurrence ? JSON.parse(record.recurrence) : null,
      reminders: record.reminders ? JSON.parse(record.reminders) : [],
      attendees: record.attendees ? JSON.parse(record.attendees) : [],
      status: record.status,
      visibility: record.visibility,
      color: record.color,
      userId: record.user_id,
      calendarId: record.calendar_id,
      externalId: record.external_id,
      provider: record.provider,
      createdAt: record.created,
      updatedAt: record.updated,
      timezone: record.timezone
    })
  }

  /**
   * Convert Event instance to PocketBase format
   */
  toPocketBase() {
    return {
      title: this.title,
      description: this.description,
      start_date: this.startDate ? this.startDate.toISOString() : null,
      end_date: this.endDate ? this.endDate.toISOString() : null,
      is_all_day: this.isAllDay,
      location: this.location,
      recurrence: this.recurrence ? JSON.stringify(this.recurrence) : null,
      reminders: JSON.stringify(this.reminders),
      attendees: JSON.stringify(this.attendees),
      status: this.status,
      visibility: this.visibility,
      color: this.color,
      user_id: this.userId,
      calendar_id: this.calendarId,
      external_id: this.externalId,
      provider: this.provider,
      timezone: this.timezone
    }
  }

  /**
   * Get event duration in minutes
   */
  getDuration() {
    if (!this.startDate || !this.endDate) return 0
    return Math.round((this.endDate - this.startDate) / (1000 * 60))
  }

  /**
   * Check if event is currently happening
   */
  isCurrentlyActive() {
    const now = new Date()
    return this.startDate <= now && now <= this.endDate
  }

  /**
   * Check if event is in the past
   */
  isPast() {
    return this.endDate && this.endDate < new Date()
  }

  /**
   * Check if event is upcoming (in the future)
   */
  isUpcoming() {
    return this.startDate && this.startDate > new Date()
  }

  /**
   * Check if event conflicts with another event
   */
  conflictsWith(otherEvent) {
    if (!this.startDate || !this.endDate || !otherEvent.startDate || !otherEvent.endDate) {
      return false
    }
    
    return (
      (this.startDate < otherEvent.endDate && this.endDate > otherEvent.startDate) ||
      (otherEvent.startDate < this.endDate && otherEvent.endDate > this.startDate)
    )
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
      minute: this.isAllDay ? undefined : '2-digit',
      timeZone: this.timezone
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
          minute: '2-digit',
          timeZone: this.timezone
        })
        return `${startStr} - ${endTime}`
      }
    }
    
    return `${startStr} - ${endStr}`
  }

  /**
   * Convert to calendar provider format (Google Calendar, Outlook, etc.)
   */
  toProviderFormat(provider) {
    const baseEvent = {
      summary: this.title,
      description: this.description,
      location: this.location,
      start: {
        dateTime: this.startDate?.toISOString(),
        timeZone: this.timezone
      },
      end: {
        dateTime: this.endDate?.toISOString(),
        timeZone: this.timezone
      }
    }

    if (this.isAllDay) {
      baseEvent.start = { date: this.startDate?.toISOString().split('T')[0] }
      baseEvent.end = { date: this.endDate?.toISOString().split('T')[0] }
    }

    switch (provider) {
      case 'google':
        return {
          ...baseEvent,
          status: this.status,
          visibility: this.visibility,
          colorId: this.color,
          reminders: {
            useDefault: false,
            overrides: this.reminders
          },
          attendees: this.attendees
        }
      case 'outlook':
        return {
          subject: this.title,
          body: { content: this.description, contentType: 'text' },
          start: baseEvent.start,
          end: baseEvent.end,
          location: { displayName: this.location },
          attendees: this.attendees,
          showAs: this.status,
          sensitivity: this.visibility
        }
      default:
        return baseEvent
    }
  }

  /**
   * Validate event data
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
    
    const validStatuses = ['confirmed', 'tentative', 'cancelled']
    if (!validStatuses.includes(this.status)) {
      errors.push('Status must be one of: ' + validStatuses.join(', '))
    }
    
    const validVisibilities = ['private', 'public']
    if (!validVisibilities.includes(this.visibility)) {
      errors.push('Visibility must be one of: ' + validVisibilities.join(', '))
    }
    
    return errors
  }
}