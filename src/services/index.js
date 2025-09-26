/**
 * Services index
 * Exports all services for the Jarvis application
 */

export { pocketbaseService } from './pocketbase.js'
export { cacheService } from './cache.js'
export { taskService } from './TaskService.js'
export { eventService } from './EventService.js'
export { documentService } from './DocumentService.js'
export { conversationService } from './ConversationService.js'
export { userPreferencesService } from './UserPreferencesService.js'
export { syncService } from './SyncService.js'
export { aiService } from './AIService.js'

// Re-export for convenience
export * from './pocketbase.js'
export * from './cache.js'
export * from './TaskService.js'
export * from './EventService.js'
export * from './DocumentService.js'
export * from './ConversationService.js'
export * from './UserPreferencesService.js'
export * from './SyncService.js'
export * from './AIService.js'