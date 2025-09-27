/**
 * Google Calendar Provider
 * Handles integration with Google Calendar API
 */
import { Event } from 'src/models'

export class GoogleCalendarProvider {
  constructor() {
    this.name = 'google'
    this.displayName = 'Google Calendar'
    this.icon = 'event'
    this.baseUrl = 'https://www.googleapis.com/calendar/v3'
    this.authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    this.tokenUrl = 'https://oauth2.googleapis.com/token'
    this.scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ]
    this.clientId = null
    this.clientSecret = null
    this.accessToken = null
    this.refreshToken = null
  }

  /**
   * Get provider display name
   */
  getDisplayName() {
    return this.displayName
  }

  /**
   * Get provider icon
   */
  getIcon() {
    return this.icon
  }

  /**
   * Connect to Google Calendar
   */
  async connect(config = {}) {
    try {
      // In a real implementation, this would handle OAuth flow
      // For now, we'll simulate a connection with provided tokens
      this.clientId = config.clientId || process.env.GOOGLE_CLIENT_ID
      this.clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET
      this.accessToken = config.accessToken
      this.refreshToken = config.refreshToken

      if (!this.clientId || !this.clientSecret) {
        return {
          success: false,
          error: 'Google Calendar client ID and secret are required. Please configure them in settings.',
          requiresSetup: true
        }
      }

      if (!this.accessToken) {
        // Return OAuth URL for user to authorize
        const authUrl = this.buildAuthUrl()
        return {
          success: false,
          error: 'Authorization required',
          authUrl,
          requiresAuth: true
        }
      }

      // Test the connection
      const testResult = await this.testConnection()
      if (testResult.success) {
        return {
          success: true,
          data: {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            clientId: this.clientId,
            connectedAt: new Date().toISOString()
          }
        }
      } else {
        return testResult
      }
    } catch (error) {
      console.error('Google Calendar connection error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Disconnect from Google Calendar
   */
  async disconnect() {
    try {
      // Revoke the access token if possible
      if (this.accessToken) {
        await this.revokeToken()
      }
      
      this.accessToken = null
      this.refreshToken = null
      
      return { success: true }
    } catch (error) {
      console.error('Google Calendar disconnect error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Validate existing connection
   */
  async validateConnection(connectionData) {
    try {
      this.accessToken = connectionData.accessToken
      this.refreshToken = connectionData.refreshToken
      this.clientId = connectionData.clientId
      
      const result = await this.testConnection()
      return result.success
    } catch (error) {
      console.error('Connection validation error:', error)
      return false
    }
  }

  /**
   * Restore connection from cached data
   */
  async restoreConnection(connectionData) {
    this.accessToken = connectionData.accessToken
    this.refreshToken = connectionData.refreshToken
    this.clientId = connectionData.clientId
  }

  /**
   * Test the connection
   */
  async testConnection() {
    try {
      const response = await this.makeRequest('/calendars/primary')
      return { success: true, data: response }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Sync events from Google Calendar
   */
  async syncEvents(options = {}) {
    try {
      const {
        calendarId = 'primary',
        timeMin = new Date().toISOString(),
        maxResults = 250
      } = options

      const params = new URLSearchParams({
        timeMin,
        maxResults: maxResults.toString(),
        singleEvents: 'true',
        orderBy: 'startTime'
      })

      const response = await this.makeRequest(`/calendars/${calendarId}/events?${params}`)
      
      return {
        success: true,
        events: response.items || []
      }
    } catch (error) {
      console.error('Google Calendar sync error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Create event in Google Calendar
   */
  async createEvent(event, calendarId = 'primary') {
    try {
      const response = await this.makeRequest(
        `/calendars/${calendarId}/events`,
        'POST',
        event
      )
      
      return { success: true, data: response }
    } catch (error) {
      console.error('Google Calendar create event error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update event in Google Calendar
   */
  async updateEvent(eventId, event, calendarId = 'primary') {
    try {
      const response = await this.makeRequest(
        `/calendars/${calendarId}/events/${eventId}`,
        'PUT',
        event
      )
      
      return { success: true, data: response }
    } catch (error) {
      console.error('Google Calendar update event error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete event from Google Calendar
   */
  async deleteEvent(eventId, calendarId = 'primary') {
    try {
      await this.makeRequest(
        `/calendars/${calendarId}/events/${eventId}`,
        'DELETE'
      )
      
      return { success: true }
    } catch (error) {
      console.error('Google Calendar delete event error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Convert Google Calendar event to internal Event model
   */
  convertToInternalEvent(googleEvent) {
    const startDate = this.parseGoogleDateTime(googleEvent.start)
    const endDate = this.parseGoogleDateTime(googleEvent.end)
    const isAllDay = !googleEvent.start.dateTime && !googleEvent.end.dateTime

    return new Event({
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description || '',
      startDate,
      endDate,
      isAllDay,
      location: googleEvent.location || '',
      status: this.mapGoogleStatus(googleEvent.status),
      visibility: this.mapGoogleVisibility(googleEvent.visibility),
      color: googleEvent.colorId ? `#${googleEvent.colorId}` : '#1976d2',
      externalId: googleEvent.id,
      provider: 'google',
      attendees: (googleEvent.attendees || []).map(attendee => ({
        email: attendee.email,
        name: attendee.displayName || attendee.email,
        status: attendee.responseStatus || 'needsAction'
      })),
      reminders: this.mapGoogleReminders(googleEvent.reminders),
      calendarId: googleEvent.organizer?.email,
      createdAt: googleEvent.created ? new Date(googleEvent.created) : new Date(),
      updatedAt: googleEvent.updated ? new Date(googleEvent.updated) : new Date()
    })
  }

  /**
   * Convert internal Event to Google Calendar format
   */
  convertFromInternalEvent(event) {
    const googleEvent = {
      summary: event.title,
      description: event.description,
      location: event.location,
      status: this.mapToGoogleStatus(event.status),
      visibility: this.mapToGoogleVisibility(event.visibility)
    }

    if (event.isAllDay) {
      googleEvent.start = { date: event.startDate.toISOString().split('T')[0] }
      googleEvent.end = { date: event.endDate.toISOString().split('T')[0] }
    } else {
      googleEvent.start = {
        dateTime: event.startDate.toISOString(),
        timeZone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      }
      googleEvent.end = {
        dateTime: event.endDate.toISOString(),
        timeZone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }

    if (event.attendees && event.attendees.length > 0) {
      googleEvent.attendees = event.attendees.map(attendee => ({
        email: attendee.email,
        displayName: attendee.name,
        responseStatus: attendee.status || 'needsAction'
      }))
    }

    if (event.reminders && event.reminders.length > 0) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: event.reminders.map(reminder => ({
          method: 'popup',
          minutes: reminder.minutes
        }))
      }
    }

    return googleEvent
  }

  /**
   * Build OAuth authorization URL
   */
  buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${window.location.origin}/auth/google/callback`,
      scope: this.scopes.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent'
    })

    return `${this.authUrl}?${params}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, redirectUri) {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error_description || data.error)
      }

      this.accessToken = data.access_token
      this.refreshToken = data.refresh_token

      return {
        success: true,
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in
        }
      }
    } catch (error) {
      console.error('Token exchange error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token'
        })
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error_description || data.error)
      }

      this.accessToken = data.access_token
      
      return {
        success: true,
        data: {
          accessToken: data.access_token,
          expiresIn: data.expires_in
        }
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      throw error
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken() {
    if (!this.accessToken) return

    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
        method: 'POST'
      })
    } catch (error) {
      console.warn('Token revocation error:', error)
    }
  }

  /**
   * Make authenticated request to Google API
   */
  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      
      if (response.status === 401) {
        // Try to refresh token and retry
        await this.refreshAccessToken()
        options.headers['Authorization'] = `Bearer ${this.accessToken}`
        const retryResponse = await fetch(url, options)
        
        if (!retryResponse.ok) {
          throw new Error(`HTTP ${retryResponse.status}: ${retryResponse.statusText}`)
        }
        
        return method === 'DELETE' ? null : await retryResponse.json()
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return method === 'DELETE' ? null : await response.json()
    } catch (error) {
      console.error('Google API request error:', error)
      throw error
    }
  }

  /**
   * Parse Google Calendar date/time
   */
  parseGoogleDateTime(dateTimeObj) {
    if (dateTimeObj.dateTime) {
      return new Date(dateTimeObj.dateTime)
    } else if (dateTimeObj.date) {
      return new Date(dateTimeObj.date + 'T00:00:00')
    }
    return null
  }

  /**
   * Map Google Calendar status to internal status
   */
  mapGoogleStatus(googleStatus) {
    switch (googleStatus) {
      case 'confirmed':
        return 'confirmed'
      case 'tentative':
        return 'tentative'
      case 'cancelled':
        return 'cancelled'
      default:
        return 'confirmed'
    }
  }

  /**
   * Map internal status to Google Calendar status
   */
  mapToGoogleStatus(internalStatus) {
    switch (internalStatus) {
      case 'confirmed':
        return 'confirmed'
      case 'tentative':
        return 'tentative'
      case 'cancelled':
        return 'cancelled'
      default:
        return 'confirmed'
    }
  }

  /**
   * Map Google Calendar visibility to internal visibility
   */
  mapGoogleVisibility(googleVisibility) {
    switch (googleVisibility) {
      case 'public':
        return 'public'
      case 'private':
        return 'private'
      default:
        return 'private'
    }
  }

  /**
   * Map internal visibility to Google Calendar visibility
   */
  mapToGoogleVisibility(internalVisibility) {
    switch (internalVisibility) {
      case 'public':
        return 'public'
      case 'private':
        return 'private'
      default:
        return 'private'
    }
  }

  /**
   * Map Google Calendar reminders to internal format
   */
  mapGoogleReminders(googleReminders) {
    if (!googleReminders || !googleReminders.overrides) {
      return []
    }

    return googleReminders.overrides.map(reminder => ({
      minutes: reminder.minutes,
      method: reminder.method
    }))
  }
}

export default GoogleCalendarProvider