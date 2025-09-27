/**
 * Chat Command Service
 * Coordinates task and event management through natural language commands
 * Enhanced with intelligent model selection and task update capabilities
 */
import { chatTaskService } from './ChatTaskService.js'
import { chatEventService } from './ChatEventService.js'
import { aiService } from './AIService.js'
import { taskService } from './TaskService.js'

class ChatCommandService {
  constructor() {
    this.chatTaskService = chatTaskService
    this.chatEventService = chatEventService
    this.aiService = aiService
    this.taskService = taskService
  }

  /**
   * Classify user request intent using fast model
   */
  async classifyRequest(message) {
    const classificationPrompt = `Classify this user request into one of these categories. Return ONLY the category name:

Categories:
- CREATE_TASK: User wants to create new tasks
- UPDATE_TASK: User wants to modify existing tasks
- DELETE_TASK: User wants to remove tasks
- QUERY_TASKS: User wants to see/list tasks
- CREATE_EVENT: User wants to create events
- GENERAL_QUESTION: User is asking questions or having conversation
- OTHER: Anything else

User message: "${message}"

Classification:`

    try {
      const response = await this.aiService.sendMessage([{
        role: 'user',
        content: classificationPrompt
      }], {
        model: 'gemini-2.0-flash-lite', // Use fast model for classification
        temperature: 0.1,
        maxTokens: 50
      })

      if (response.success) {
        const classification = response.content.trim().toUpperCase()
        return {
          intent: classification,
          confidence: 0.9
        }
      }
    } catch (error) {
      console.error('Error classifying request:', error)
    }

    return { intent: 'OTHER', confidence: 0.1 }
  }

  /**
   * Get relevant task context for updates
   */
  async getTaskUpdateContext(message, userId) {
    try {
      // Get recent tasks and search for relevant ones
      const tasksResult = await this.taskService.getAll()
      if (!tasksResult.success) return null

      const tasks = tasksResult.data
      
      // Find tasks mentioned in the message or recent tasks
      const relevantTasks = []
      
      // Simple keyword matching for task titles
      const messageWords = message.toLowerCase().split(/\s+/)
      
      for (const task of tasks.slice(0, 20)) { // Limit to recent 20 tasks
        const titleWords = task.title.toLowerCase().split(/\s+/)
        const overlap = titleWords.some(word => 
          messageWords.some(msgWord => 
            msgWord.includes(word) || word.includes(msgWord)
          )
        )
        
        if (overlap) {
          relevantTasks.push({
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate
          })
        }
      }

      // If no keyword matches, include most recent tasks
      if (relevantTasks.length === 0) {
        relevantTasks.push(...tasks.slice(0, 5).map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          dueDate: task.dueDate
        })))
      }

      return relevantTasks
    } catch (error) {
      console.error('Error getting task context:', error)
      return null
    }
  }

  /**
   * Process a user message with intelligent routing
   */
  async processMessage(message, userId, conversationId = null) {
    try {
      // First, classify the request using fast model
      const classification = await this.classifyRequest(message)
      
      let result = null
      
      switch (classification.intent) {
        case 'CREATE_TASK':
          // Use LLM parsing for task creation
          const taskIntent = await this.chatTaskService.parseTaskIntentWithLLM(message, this.aiService)
          if (taskIntent.confidence > 0.6) {
            result = await this.processTaskCommand(taskIntent, message, userId)
          }
          break
          
        case 'UPDATE_TASK':
          result = await this.processTaskUpdate(message, userId)
          break
          
        case 'DELETE_TASK':
          const deleteIntent = await this.chatTaskService.parseTaskIntentWithLLM(message, this.aiService)
          if (deleteIntent.intent === 'delete_task') {
            result = await this.processTaskCommand(deleteIntent, message, userId)
          }
          break
          
        case 'QUERY_TASKS':
          const queryIntent = await this.chatTaskService.parseTaskIntentWithLLM(message, this.aiService)
          if (queryIntent.confidence > 0.6) {
            result = await this.processTaskCommand(queryIntent, message, userId)
          }
          break
          
        case 'CREATE_EVENT':
          const eventIntent = this.chatEventService.parseEventIntent(message)
          if (eventIntent.confidence > 0.6) {
            result = await this.processEventCommand(eventIntent, message, userId)
          }
          break
          
        case 'GENERAL_QUESTION':
        case 'OTHER':
          // Let normal AI processing handle these
          return null
      }
      
      // If we processed a command, return the result with visual elements
      if (result) {
        return {
          isCommand: true,
          success: result.success,
          message: result.message,
          data: result.task || result.event || result.tasks || result.events,
          needsClarification: result.needsClarification,
          clarificationOptions: result.tasks || result.events,
          visualElements: result.visualElements || null
        }
      }
      
      return null
    } catch (error) {
      console.error('Error processing chat command:', error)
      return {
        isCommand: true,
        success: false,
        message: '❌ Error processing request. Please try again.'
      }
    }
  }

  /**
   * Process task update requests
   */
  async processTaskUpdate(message, userId) {
    try {
      // Get relevant task context
      const taskContext = await this.getTaskUpdateContext(message, userId)
      
      if (!taskContext || taskContext.length === 0) {
        return {
          success: false,
          message: "I couldn't find any tasks to update. Please be more specific about which task you want to modify."
        }
      }

      const updatePrompt = `You are helping update existing tasks. Analyze the user's request and determine what changes to make.

Current tasks context: ${JSON.stringify(taskContext, null, 2)}

User request: "${message}"

Return a JSON response with the updates needed:
{
  "taskId": "id_of_task_to_update",
  "updates": {
    "title": "new title if changed",
    "description": "new description if changed", 
    "priority": "low|medium|high|urgent if changed",
    "dueDate": "YYYY-MM-DD or null if changed",
    "status": "pending|in_progress|completed if changed"
  },
  "confidence": 0.0-1.0
}

If multiple tasks could be updated, choose the most relevant one. Only include fields that should be changed.`

      const response = await this.aiService.sendMessage([{
        role: 'user',
        content: updatePrompt
      }], {
        model: 'gemini-2.5-pro', // Use pro model for complex task updates
        temperature: 0.2,
        maxTokens: 500
      })

      if (response.success) {
        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const updateData = JSON.parse(jsonMatch[0])
            
            if (updateData.confidence > 0.6 && updateData.taskId && updateData.updates) {
              // Apply the updates
              const updateResult = await this.taskService.update(updateData.taskId, updateData.updates)
              
              if (updateResult.success) {
                return {
                  success: true,
                  message: `✅ Updated task: "${updateResult.data.title}"`,
                  task: updateResult.data,
                  visualElements: this.generateTaskCards([updateResult.data])
                }
              } else {
                return {
                  success: false,
                  message: `❌ Failed to update task: ${updateResult.error}`
                }
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing update response:', parseError)
        }
      }

      return {
        success: false,
        message: "I couldn't understand what changes you want to make. Please be more specific."
      }
    } catch (error) {
      console.error('Error processing task update:', error)
      return {
        success: false,
        message: `❌ Error updating task: ${error.message}`
      }
    }
  }

  /**
   * Generate visual task cards for chat display
   */
  generateTaskCards(tasks) {
    if (!Array.isArray(tasks)) {
      tasks = [tasks]
    }

    return tasks.map(task => ({
      type: 'task_card',
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      status: task.status,
      clickAction: `/tasks/${task.id}` // Route to task detail page
    }))
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