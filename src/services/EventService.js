/**
 * Event Service
 * Handles CRUD operations for events with PocketBase backend and local caching
 */
import { Event } from "src/models";
import { pocketbaseService } from "./pocketbase.js";
import { cacheService } from "./cache.js";
import { useAuthStore } from "src/stores/auth";

class EventService {
  constructor() {
    this.collection = "events";
    this.cacheKey = "jarvis_events";
  }

  /**
   * Create a new event
   */
  async create(eventData) {
    try {
      const event = new Event(eventData);
      const errors = event.validate();

      if (errors.length > 0) {
        return { success: false, error: errors.join(", ") };
      }

      // Try to create in PocketBase first
      let result;
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(
          this.collection,
          event.toPocketBase()
        );

        if (result.success) {
          event.id = result.data.id;
          event.createdAt = new Date(result.data.created);
          event.updatedAt = new Date(result.data.updated);
        }
      } else {
        // Offline mode - generate local ID
        event.id = "local_" + Date.now();
        result = { success: true, data: event };
      }

      // Cache the event locally
      await this.cacheEvent(event);

      return { success: true, data: event };
    } catch (error) {
      console.error("Error creating event:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get event by ID
   */
  async get(id) {
    try {
      // Try cache first
      const cachedEvent = await cacheService.get(`${this.cacheKey}_${id}`);
      if (cachedEvent) {
        return { success: true, data: new Event(cachedEvent) };
      }

      // Try PocketBase
      if (pocketbaseService.isAuthenticated()) {
        const result = await pocketbaseService.get(this.collection, id);
        if (result.success) {
          const event = Event.fromPocketBase(result.data);
          await this.cacheEvent(event);
          return { success: true, data: event };
        }
      }

      return { success: false, error: "Event not found" };
    } catch (error) {
      console.error("Error getting event:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all events for current user
   */
  async getAll(filters = {}) {
    try {
      let events = [];

      // Try PocketBase first
      if (pocketbaseService.isAuthenticated()) {
        const authStore = useAuthStore();
        const currentUser = authStore.user;
        const filter = `user_id = "${currentUser?.id}"`;
        const result = await pocketbaseService.getAll(
          this.collection,
          filter,
          "-start_date"
        );

        if (result.success) {
          events = result.data.map((record) => Event.fromPocketBase(record));
          // Update cache
          await this.cacheEvents(events);
        }
      }

      // Fallback to cache if PocketBase fails or offline
      if (events.length === 0) {
        const cachedEvents = (await cacheService.get(this.cacheKey)) || [];
        events = cachedEvents.map((eventData) => new Event(eventData));
      }

      // Apply filters
      events = this.applyFilters(events, filters);

      return { success: true, data: events };
    } catch (error) {
      console.error("Error getting events:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update event
   */
  async update(id, updates) {
    try {
      // Get existing event
      const existingResult = await this.get(id);
      if (!existingResult.success) {
        return existingResult;
      }

      const event = existingResult.data;
      Object.assign(event, updates);
      event.updatedAt = new Date();

      const errors = event.validate();
      if (errors.length > 0) {
        return { success: false, error: errors.join(", ") };
      }

      // Try to update in PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith("local_")) {
        const result = await pocketbaseService.update(
          this.collection,
          id,
          event.toPocketBase()
        );
        if (result.success) {
          event.updatedAt = new Date(result.data.updated);
        }
      }

      // Update cache
      await this.cacheEvent(event);

      return { success: true, data: event };
    } catch (error) {
      console.error("Error updating event:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete event
   */
  async delete(id) {
    try {
      // Try to delete from PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith("local_")) {
        await pocketbaseService.delete(this.collection, id);
      }

      // Remove from cache
      await cacheService.remove(`${this.cacheKey}_${id}`);

      // Remove from events list cache
      const cachedEvents = (await cacheService.get(this.cacheKey)) || [];
      const updatedEvents = cachedEvents.filter((event) => event.id !== id);
      await cacheService.set(this.cacheKey, updatedEvents);

      return { success: true };
    } catch (error) {
      console.error("Error deleting event:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get events for a specific date range
   */
  async getByDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const result = await this.getAll();
    if (result.success) {
      const rangeEvents = result.data.filter((event) => {
        if (!event.startDate) return false;
        return event.startDate >= start && event.startDate <= end;
      });
      return { success: true, data: rangeEvents };
    }
    return result;
  }

  /**
   * Get events for today
   */
  async getToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getByDateRange(today, tomorrow);
  }

  /**
   * Get upcoming events
   */
  async getUpcoming(days = 7) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return this.getByDateRange(now, future);
  }

  /**
   * Get conflicting events for a time slot
   */
  async getConflicts(startDate, endDate, excludeId = null) {
    const result = await this.getAll();
    if (result.success) {
      const conflicts = result.data.filter((event) => {
        if (excludeId && event.id === excludeId) return false;

        const testEvent = new Event({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        });

        return event.conflictsWith(testEvent);
      });
      return { success: true, data: conflicts };
    }
    return result;
  }

  /**
   * Cache a single event
   */
  async cacheEvent(event) {
    await cacheService.set(`${this.cacheKey}_${event.id}`, event);

    // Also update the events list cache
    const cachedEvents = (await cacheService.get(this.cacheKey)) || [];
    const existingIndex = cachedEvents.findIndex((e) => e.id === event.id);

    if (existingIndex >= 0) {
      cachedEvents[existingIndex] = event;
    } else {
      cachedEvents.push(event);
    }

    await cacheService.set(this.cacheKey, cachedEvents);
  }

  /**
   * Cache multiple events
   */
  async cacheEvents(events) {
    await cacheService.set(this.cacheKey, events);

    // Also cache individual events
    for (const event of events) {
      await cacheService.set(`${this.cacheKey}_${event.id}`, event);
    }
  }

  /**
   * Apply filters to event list
   */
  applyFilters(events, filters) {
    let filteredEvents = [...events];

    if (filters.status) {
      filteredEvents = filteredEvents.filter(
        (event) => event.status === filters.status
      );
    }

    if (filters.provider) {
      filteredEvents = filteredEvents.filter(
        (event) => event.provider === filters.provider
      );
    }

    if (filters.startAfter) {
      const afterDate = new Date(filters.startAfter);
      filteredEvents = filteredEvents.filter(
        (event) => event.startDate && event.startDate >= afterDate
      );
    }

    if (filters.startBefore) {
      const beforeDate = new Date(filters.startBefore);
      filteredEvents = filteredEvents.filter(
        (event) => event.startDate && event.startDate <= beforeDate
      );
    }

    if (filters.isAllDay !== undefined) {
      filteredEvents = filteredEvents.filter(
        (event) => event.isAllDay === filters.isAllDay
      );
    }

    if (filters.visibility) {
      filteredEvents = filteredEvents.filter(
        (event) => event.visibility === filters.visibility
      );
    }

    // Sort by start date by default
    filteredEvents.sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate - b.startDate;
    });

    return filteredEvents;
  }

  /**
   * Sync local changes with PocketBase
   */
  async sync() {
    try {
      if (!pocketbaseService.isAuthenticated()) {
        return { success: false, error: "Not authenticated" };
      }

      const cachedEvents = (await cacheService.get(this.cacheKey)) || [];
      const localEvents = cachedEvents.filter((event) =>
        event.id.startsWith("local_")
      );

      const results = [];

      for (const localEvent of localEvents) {
        // Remove local ID and create in PocketBase
        const eventData = { ...localEvent };
        delete eventData.id;

        const result = await pocketbaseService.create(
          this.collection,
          new Event(eventData).toPocketBase()
        );

        if (result.success) {
          // Update cache with new ID
          const newEvent = Event.fromPocketBase(result.data);
          await this.cacheEvent(newEvent);

          // Remove old local cache entry
          await cacheService.remove(`${this.cacheKey}_${localEvent.id}`);

          results.push({
            localId: localEvent.id,
            newId: newEvent.id,
            success: true,
          });
        } else {
          results.push({
            localId: localEvent.id,
            success: false,
            error: result.error,
          });
        }
      }

      return { success: true, data: results };
    } catch (error) {
      console.error("Error syncing events:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search events based on search parameters
   */
  async searchEvents(userId, searchParams) {
    try {
      const result = await this.getAll();
      if (!result.success) {
        return [];
      }

      let events = result.data;

      // Filter by search parameters
      if (searchParams.title) {
        events = events.filter(event => 
          event.title.toLowerCase().includes(searchParams.title.toLowerCase())
        );
      }

      if (searchParams.status) {
        events = events.filter(event => event.status === searchParams.status);
      }

      if (searchParams.location) {
        events = events.filter(event => 
          event.location && event.location.toLowerCase().includes(searchParams.location.toLowerCase())
        );
      }

      if (searchParams.startDate) {
        const targetDate = new Date(searchParams.startDate);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        events = events.filter(event => {
          if (!event.startDate) return false;
          const eventDate = new Date(event.startDate);
          return eventDate >= targetDate && eventDate < nextDay;
        });
      }

      if (searchParams.startBefore) {
        const beforeDate = new Date(searchParams.startBefore);
        events = events.filter(event => 
          event.startDate && new Date(event.startDate) < beforeDate
        );
      }

      if (searchParams.startAfter) {
        const afterDate = new Date(searchParams.startAfter);
        events = events.filter(event => 
          event.startDate && new Date(event.startDate) > afterDate
        );
      }

      return events;
    } catch (error) {
      console.error('Error searching events:', error);
      return [];
    }
  }

  /**
   * Update multiple events based on search parameters
   */
  async updateEventsBySearch(userId, searchParams, updates) {
    try {
      const matchingEvents = await this.searchEvents(userId, searchParams);
      const results = [];

      for (const event of matchingEvents) {
        const result = await this.update(event.id, updates);
        results.push({
          event,
          result,
          success: result.success
        });
      }

      return {
        success: true,
        data: results,
        count: results.length
      };
    } catch (error) {
      console.error('Error updating events by search:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete multiple events based on search parameters
   */
  async deleteEventsBySearch(userId, searchParams) {
    try {
      const matchingEvents = await this.searchEvents(userId, searchParams);
      const results = [];

      for (const event of matchingEvents) {
        const result = await this.delete(event.id);
        results.push({
          event,
          result,
          success: result.success
        });
      }

      return {
        success: true,
        data: results,
        count: results.length
      };
    } catch (error) {
      console.error('Error deleting events by search:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build PocketBase filter string from search parameters
   */
  buildFilter(searchParams) {
    const conditions = [];
    
    if (searchParams.status) {
      conditions.push(`status = "${searchParams.status}"`);
    }
    
    if (searchParams.title) {
      conditions.push(`title ~ "${searchParams.title}"`);
    }
    
    if (searchParams.location) {
      conditions.push(`location ~ "${searchParams.location}"`);
    }
    
    if (searchParams.startDate) {
      const date = new Date(searchParams.startDate);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(`start_date >= "${startOfDay.toISOString()}" && start_date <= "${endOfDay.toISOString()}"`);
    }
    
    if (searchParams.startBefore) {
      conditions.push(`start_date < "${new Date(searchParams.startBefore).toISOString()}"`);
    }
    
    if (searchParams.startAfter) {
      conditions.push(`start_date > "${new Date(searchParams.startAfter).toISOString()}"`);
    }
    
    if (searchParams.provider) {
      conditions.push(`provider = "${searchParams.provider}"`);
    }
    
    if (searchParams.visibility) {
      conditions.push(`visibility = "${searchParams.visibility}"`);
    }
    
    return conditions.length > 0 ? ` && ${conditions.join(' && ')}` : '';
  }

  /**
   * Get events for a specific user (overload for better API)
   */
  async getEvents(userId, options = {}) {
    const filters = { ...options };
    if (userId) {
      filters.userId = userId;
    }
    return this.getAll(filters);
  }
}

export const eventService = new EventService();
export default eventService;
