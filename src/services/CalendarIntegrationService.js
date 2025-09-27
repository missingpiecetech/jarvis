/**
 * Calendar Integration Service
 * Manages external calendar providers using a provider pattern
 */
import { GoogleCalendarProvider } from './calendar-providers/GoogleCalendarProvider.js'
import { cacheService } from './cache.js'
import { eventService } from './EventService.js'

class CalendarIntegrationService {
  constructor() {
    this.providers = new Map()
    this.activeProviders = new Set()
    this.cacheKey = 'jarvis_calendar_integrations'
    
    // Register available providers
    this.registerProvider('google', new GoogleCalendarProvider())
    // Future providers can be added here:
    // this.registerProvider('outlook', new OutlookCalendarProvider())
    // this.registerProvider('apple', new AppleCalendarProvider())
  }

  /**
   * Register a calendar provider
   */
  registerProvider(name, provider) {
    this.providers.set(name, provider)
  }

  /**
   * Get available calendar providers
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys()).map(name => ({
      id: name,
      name: this.providers.get(name).getDisplayName(),
      icon: this.providers.get(name).getIcon(),
      isConnected: this.activeProviders.has(name)
    }))
  }

  /**
   * Connect to a calendar provider
   */
  async connectProvider(providerId, config = {}) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    try {
      const connectionResult = await provider.connect(config)
      
      if (connectionResult.success) {
        this.activeProviders.add(providerId)
        
        // Cache the connection info
        await this.cacheProviderConnection(providerId, connectionResult.data)
        
        // Initial sync
        await this.syncProvider(providerId)
        
        return { success: true, provider: providerId }
      } else {
        return { success: false, error: connectionResult.error }
      }
    } catch (error) {
      console.error(`Error connecting to ${providerId}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Disconnect from a calendar provider
   */
  async disconnectProvider(providerId) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    try {
      await provider.disconnect()
      this.activeProviders.delete(providerId)
      
      // Remove cached connection
      await this.removeCachedProviderConnection(providerId)
      
      // Remove events from this provider
      await this.removeProviderEvents(providerId)
      
      return { success: true }
    } catch (error) {
      console.error(`Error disconnecting from ${providerId}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Sync events from a specific provider
   */
  async syncProvider(providerId) {
    const provider = this.providers.get(providerId)
    if (!provider || !this.activeProviders.has(providerId)) {
      return { success: false, error: 'Provider not connected' }
    }

    try {
      const syncResult = await provider.syncEvents()
      
      if (syncResult.success) {
        // Convert external events to our Event model and store them
        const events = syncResult.events.map(externalEvent => 
          provider.convertToInternalEvent(externalEvent)
        )
        
        // Update local events with provider events
        await this.updateProviderEvents(providerId, events)
        
        return { success: true, eventCount: events.length }
      } else {
        return { success: false, error: syncResult.error }
      }
    } catch (error) {
      console.error(`Error syncing ${providerId}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Sync all active providers
   */
  async syncAllProviders() {
    const results = []
    
    for (const providerId of this.activeProviders) {
      const result = await this.syncProvider(providerId)
      results.push({ provider: providerId, ...result })
    }
    
    return results
  }

  /**
   * Create event in external provider
   */
  async createEventInProvider(providerId, event) {
    const provider = this.providers.get(providerId)
    if (!provider || !this.activeProviders.has(providerId)) {
      return { success: false, error: 'Provider not connected' }
    }

    try {
      const externalEvent = provider.convertFromInternalEvent(event)
      const result = await provider.createEvent(externalEvent)
      
      if (result.success) {
        // Update the local event with external ID
        event.externalId = result.data.id
        event.provider = providerId
        
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error(`Error creating event in ${providerId}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update event in external provider
   */
  async updateEventInProvider(providerId, event) {
    const provider = this.providers.get(providerId)
    if (!provider || !this.activeProviders.has(providerId)) {
      return { success: false, error: 'Provider not connected' }
    }

    if (!event.externalId) {
      return { success: false, error: 'Event has no external ID' }
    }

    try {
      const externalEvent = provider.convertFromInternalEvent(event)
      const result = await provider.updateEvent(event.externalId, externalEvent)
      
      return result
    } catch (error) {
      console.error(`Error updating event in ${providerId}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete event from external provider
   */
  async deleteEventFromProvider(providerId, externalId) {
    const provider = this.providers.get(providerId)
    if (!provider || !this.activeProviders.has(providerId)) {
      return { success: false, error: 'Provider not connected' }
    }

    try {
      const result = await provider.deleteEvent(externalId)
      return result
    } catch (error) {
      console.error(`Error deleting event from ${providerId}:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Initialize connections from cache
   */
  async initialize() {
    try {
      const cachedConnections = await cacheService.get(this.cacheKey) || {}
      
      for (const [providerId, connectionData] of Object.entries(cachedConnections)) {
        const provider = this.providers.get(providerId)
        if (provider) {
          try {
            const isValid = await provider.validateConnection(connectionData)
            if (isValid) {
              this.activeProviders.add(providerId)
              await provider.restoreConnection(connectionData)
            } else {
              // Remove invalid connection
              await this.removeCachedProviderConnection(providerId)
            }
          } catch (error) {
            console.warn(`Failed to restore connection to ${providerId}:`, error)
            await this.removeCachedProviderConnection(providerId)
          }
        }
      }
    } catch (error) {
      console.error('Error initializing calendar integrations:', error)
    }
  }

  /**
   * Cache provider connection data
   */
  async cacheProviderConnection(providerId, connectionData) {
    const cachedConnections = await cacheService.get(this.cacheKey) || {}
    cachedConnections[providerId] = connectionData
    await cacheService.set(this.cacheKey, cachedConnections)
  }

  /**
   * Remove cached provider connection
   */
  async removeCachedProviderConnection(providerId) {
    const cachedConnections = await cacheService.get(this.cacheKey) || {}
    delete cachedConnections[providerId]
    await cacheService.set(this.cacheKey, cachedConnections)
  }

  /**
   * Update local events with provider events
   */
  async updateProviderEvents(providerId, events) {
    // Get existing events from this provider
    const existingResult = await eventService.getAll({ provider: providerId })
    const existingEvents = existingResult.success ? existingResult.data : []
    
    // Create a map of existing events by external ID
    const existingEventsMap = new Map(
      existingEvents.map(event => [event.externalId, event])
    )
    
    // Process each external event
    for (const event of events) {
      const existingEvent = existingEventsMap.get(event.externalId)
      
      if (existingEvent) {
        // Update existing event if it has changed
        const hasChanges = this.hasEventChanges(existingEvent, event)
        if (hasChanges) {
          await eventService.update(existingEvent.id, event)
        }
        existingEventsMap.delete(event.externalId)
      } else {
        // Create new event
        await eventService.create(event)
      }
    }
    
    // Delete events that no longer exist in the external provider
    for (const [externalId, event] of existingEventsMap) {
      await eventService.delete(event.id)
    }
  }

  /**
   * Remove all events from a provider
   */
  async removeProviderEvents(providerId) {
    const result = await eventService.getAll({ provider: providerId })
    if (result.success) {
      for (const event of result.data) {
        await eventService.delete(event.id)
      }
    }
  }

  /**
   * Check if an event has changes
   */
  hasEventChanges(existingEvent, newEvent) {
    const fieldsToCompare = [
      'title', 'description', 'startDate', 'endDate', 'location', 
      'isAllDay', 'status', 'visibility'
    ]
    
    return fieldsToCompare.some(field => {
      const existing = existingEvent[field]
      const updated = newEvent[field]
      
      // Handle date comparisons
      if (field === 'startDate' || field === 'endDate') {
        return existing?.getTime() !== updated?.getTime()
      }
      
      return existing !== updated
    })
  }

  /**
   * Get connection status for all providers
   */
  getConnectionStatus() {
    return Object.fromEntries(
      Array.from(this.providers.keys()).map(providerId => [
        providerId,
        {
          connected: this.activeProviders.has(providerId),
          name: this.providers.get(providerId).getDisplayName()
        }
      ])
    )
  }
}

export const calendarIntegrationService = new CalendarIntegrationService()
export default calendarIntegrationService