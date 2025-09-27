/**
 * Chat Command Service
 * Coordinates task and event management through natural language commands
 */
import { chatTaskService } from './ChatTaskService.js'
import { chatEventService } from './ChatEventService.js'
import { aiService } from './AIService.js'

class ChatCommandService {
  constructor() {
    this.chatTaskService = chatTaskService
    this.chatEventService = chatEventService
    this.aiService = aiService
  }

  /**
   * Process a user message for task/event commands
   */
  async processMessage(message, userId, conversationId = null) {
    try {
      // Parse both task and event intents
      const taskIntent = this.chatTaskService.parseTaskIntent(message)
      const eventIntent = this.chatEventService.parseEventIntent(message)
      
      // Determine which intent is more confident
      let result = null
      
      if (taskIntent.confidence > eventIntent.confidence && taskIntent.confidence > 0.6) {
        result = await this.processTaskCommand(taskIntent, message, userId)
      } else if (eventIntent.confidence > 0.6) {
        result = await this.processEventCommand(eventIntent, message, userId)
      } else if (taskIntent.confidence > 0.4 || eventIntent.confidence > 0.4) {
        // Lower confidence - ask for clarification
        result = await this.requestClarification(taskIntent, eventIntent, message)
      } else {
        // No clear command detected - return null to let normal AI processing continue
        return null
      }
      
      // If we processed a command, return the result
      if (result) {
        return {
          isCommand: true,
          success: result.success,
          message: result.message,
          data: result.task || result.event || result.tasks || result.events,
          needsClarification: result.needsClarification,
          clarificationOptions: result.tasks || result.events
        }
      }
      
      return null
    } catch (error) {
      console.error('Error processing chat command:', error)
      return {
        isCommand: true,
        success: false,
        message: `❌ Error processing command: ${error.message}`
      }
    }
  }

  /**
   * Process task-related commands
   */
  async processTaskCommand(taskIntent, message, userId) {
    const { intent, entities, isMultiple } = taskIntent
    
    switch (intent) {
      case 'create_task':
        if (isMultiple && Array.isArray(entities)) {
          // Handle multiple tasks
          if (entities.length === 0) {
            return {
              success: false,
              message: '❓ I couldn\'t identify any specific tasks to create. Please provide task titles.',
              needsClarification: true
            }
          }
          return await this.chatTaskService.processTaskCreation(entities, userId)
        } else {
          // Handle single task
          if (!entities.title) {
            return {
              success: false,
              message: '❓ What task would you like me to create? Please provide a task title.',
              needsClarification: true
            }
          }
          return await this.chatTaskService.processTaskCreation(entities, userId)
        }
        
      case 'complete_task':
        if (!entities.title) {
          return {
            success: false,
            message: '❓ Which task would you like to mark as complete? Please specify the task name.',
            needsClarification: true
          }
        }
        return await this.chatTaskService.processTaskCompletion(entities.title, userId)
        
      case 'delete_task':
        if (!entities.title) {
          return {
            success: false,
            message: '❓ Which task would you like to delete? Please specify the task name.',
            needsClarification: true
          }
        }
        return await this.chatTaskService.processTaskDeletion(entities.title, userId)
        
      case 'list_tasks':
      case 'query_deadlines':
      case 'query_priority_tasks':
        return await this.chatTaskService.queryTasks(intent, userId)
        
      default:
        return null
    }
  }

  /**
   * Process event-related commands
   */
  async processEventCommand(eventIntent, message, userId) {
    const { intent, entities } = eventIntent
    
    switch (intent) {
      case 'create_event':
        if (!entities.title) {
          return {
            success: false,
            message: '❓ What event would you like me to create? Please provide an event title.',
            needsClarification: true
          }
        }
        return await this.chatEventService.processEventCreation(entities, userId)
        
      case 'delete_event':
        if (!entities.title) {
          return {
            success: false,
            message: '❓ Which event would you like to delete? Please specify the event name.',
            needsClarification: true
          }
        }
        return await this.chatEventService.processEventDeletion(entities.title, userId)
        
      case 'list_events':
      case 'query_today_events':
      case 'query_upcoming_events':
        return await this.chatEventService.queryEvents(intent, userId)
        
      default:
        return null
    }
  }

  /**
   * Request clarification when intent is ambiguous
   */
  async requestClarification(taskIntent, eventIntent, message) {
    let clarificationMessage = '❓ I\'m not sure if you want to manage a task or an event. Could you be more specific?'
    
    if (taskIntent.confidence > 0.4 && eventIntent.confidence > 0.4) {
      clarificationMessage = '❓ This could be either a task or event. Please clarify:\n\n'
      clarificationMessage += '• Say "**task**" if you want to manage tasks/todos\n'
      clarificationMessage += '• Say "**event**" if you want to manage calendar events/meetings'
    } else if (taskIntent.confidence > 0.4) {
      clarificationMessage = '❓ It looks like you want to manage a task, but I need more details. Please specify:\n\n'
      clarificationMessage += '• What task do you want to create, complete, or delete?\n'
      clarificationMessage += '• Or ask to "show my tasks" to see your current tasks'
    } else if (eventIntent.confidence > 0.4) {
      clarificationMessage = '❓ It looks like you want to manage an event, but I need more details. Please specify:\n\n'
      clarificationMessage += '• What event do you want to create or delete?\n'
      clarificationMessage += '• Or ask to "show my calendar" to see your current events'
    }
    
    return {
      success: false,
      message: clarificationMessage,
      needsClarification: true
    }
  }

  /**
   * Get enhanced context for AI prompts including task/event summaries
   */
  async getEnhancedContext(userId) {
    try {
      const [taskContext, eventContext] = await Promise.all([
        this.chatTaskService.getTaskContext(userId),
        this.chatEventService.getEventContext(userId)
      ])
      
      let context = ''
      
      if (taskContext) {
        context += taskContext
      }
      
      if (eventContext) {
        context += (context ? ' ' : '') + eventContext
      }
      
      if (context) {
        context = `\n\nCurrent user status:\n${context}\n\nWhen the user mentions tasks or events, you can help them create, edit, delete, or query them using natural language. Be proactive in suggesting task/event management when appropriate.`
      }
      
      return context
    } catch (error) {
      console.error('Error getting enhanced context:', error)
      return ''
    }
  }

  /**
   * Generate enhanced system prompt with task/event management instructions
   */
  getEnhancedSystemPrompt() {
    return `You are Jarvis, a helpful personal assistant with advanced task and event management capabilities.

**Task Management:**
- Help users create tasks with natural language (e.g., "remind me to call John tomorrow")
- Mark tasks as complete when users mention finishing them
- Delete tasks when users want to remove them
- Show task lists, deadlines, and priorities when asked

**Event Management:**  
- Help users schedule events, meetings, and appointments
- Extract date, time, location, and participant information from natural language
- Delete events when users want to cancel them
- Show calendar information when requested

**Natural Language Understanding:**
- Recognize task/event intents in casual conversation
- Extract relevant details (dates, times, priorities, locations)
- Ask for clarification when information is missing
- Provide helpful summaries and confirmations

**Proactive Assistance:**
- Suggest creating tasks when users mention things they need to do
- Suggest scheduling events when users mention meetings or appointments
- Remind users of upcoming deadlines and events
- Help users stay organized and productive

Be conversational, friendly, and helpful. When you detect task or event management needs, guide users through the process naturally without being overly formal.`
  }

  /**
   * Check if a message contains potential task/event management intent
   */
  containsTaskEventIntent(message) {
    const taskIntent = this.chatTaskService.parseTaskIntent(message)
    const eventIntent = this.chatEventService.parseEventIntent(message)
    
    return taskIntent.confidence > 0.4 || eventIntent.confidence > 0.4
  }

  /**
   * Get quick suggestions based on message content
   */
  async getQuickSuggestions(message, userId) {
    try {
      const suggestions = []
      
      // Check for task creation hints
      const taskHints = [
        /(?:i\s+need\s+to|i\s+have\s+to|i\s+should|don't\s+forget|remember\s+to)/i,
        /(?:todo|to\s+do)/i
      ]
      
      if (taskHints.some(hint => hint.test(message))) {
        suggestions.push({
          type: 'task',
          action: 'create',
          text: 'Create a task for this?',
          icon: '✅'
        })
      }
      
      // Check for event creation hints
      const eventHints = [
        /(?:meeting|appointment|call|conference)/i,
        /(?:schedule|book|set\s+up)/i,
        /(?:at\s+\d|on\s+\w+day|\d:\d)/i
      ]
      
      if (eventHints.some(hint => hint.test(message))) {
        suggestions.push({
          type: 'event',
          action: 'create',
          text: 'Schedule this as an event?',
          icon: '📅'
        })
      }
      
      return suggestions
    } catch (error) {
      console.error('Error getting quick suggestions:', error)
      return []
    }
  }
}

export const chatCommandService = new ChatCommandService()
export default chatCommandService