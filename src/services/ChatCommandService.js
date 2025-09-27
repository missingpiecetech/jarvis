/**
 * Chat Command Service
 * Processes natural language into modular actions that can be confirmed and executed
 * Returns arrays of actions for CRUD operations on tasks and events
 */
import { chatTaskService } from './ChatTaskService.js'
import { chatEventService } from './ChatEventService.js'
import { aiService } from './AIService.js'
import { taskService } from './TaskService.js'
import { eventService } from './EventService.js'

class ChatCommandService {
  constructor() {
    this.chatTaskService = chatTaskService
    this.chatEventService = chatEventService
    this.aiService = aiService
    this.taskService = taskService
    this.eventService = eventService
  }

  /**
   * Process user message and return array of actions to be confirmed and executed
   */
  async processMessage(message, userId, conversationId = null) {
    try {
      // Use only gemini-2.5-pro for all processing
      const actionsPrompt = this.generateActionsPrompt(message, userId)
      
      const response = await this.aiService.sendMessage([{
        role: 'user',
        content: actionsPrompt
      }], {
        model: 'gemini-2.5-pro',
        temperature: 0.2,
        maxTokens: 2048
      })

      if (response.success) {
        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0])
            
            if (result.actions && Array.isArray(result.actions)) {
              // Enhance actions with additional context if needed
              const enhancedActions = await this.enhanceActions(result.actions, userId)
              
              return {
                success: true,
                actions: enhancedActions,
                response: result.response || "I've prepared the following actions for you to review:",
                needsConfirmation: true
              }
            } else if (result.response) {
              // No actions needed, just a response
              return {
                success: true,
                actions: [],
                response: result.response,
                needsConfirmation: false
              }
            }
          }
        } catch (parseError) {
          console.error('Error parsing actions response:', parseError)
        }
      }

      return {
        success: false,
        actions: [],
        response: "I couldn't understand your request. Please try rephrasing it.",
        needsConfirmation: false
      }
    } catch (error) {
      console.error('Error processing message:', error)
      return {
        success: false,
        actions: [],
        response: "An error occurred while processing your request.",
        needsConfirmation: false
      }
    }
  }

  /**
   * Generate prompt for extracting modular actions from user message
   */
  generateActionsPrompt(message, userId) {
    return `Analyze the user's message and extract actionable items. Return a JSON response with actions to be confirmed and executed.

User message: "${message}"

Response format:
{
  "actions": [
    {
      "action": "CREATE" | "READ" | "UPDATE" | "DELETE",
      "object": "TASK" | "EVENT",
      "params": {
        // For CREATE TASK:
        "title": "Clear task title",
        "description": "Optional description",
        "priority": "low" | "medium" | "high" | "urgent",
        "dueDate": "YYYY-MM-DD" | null,
        "tags": ["tag1", "tag2"]
        
        // For UPDATE/DELETE TASK (include search criteria):
        "searchParams": {
          "title": "partial title match",
          "status": "pending" | "in_progress" | "completed",
          "priority": "low" | "medium" | "high" | "urgent",
          "dueDate": "YYYY-MM-DD",
          "dueBefore": "YYYY-MM-DD",
          "dueAfter": "YYYY-MM-DD"
        },
        // Update fields (for UPDATE only):
        "updates": {
          "title": "new title",
          "priority": "new priority",
          // ... other fields to update
        }
        
        // For CREATE EVENT:
        "title": "Event title",
        "startDate": "YYYY-MM-DD HH:mm",
        "endDate": "YYYY-MM-DD HH:mm",
        "location": "Optional location",
        "description": "Optional description"
        
        // For READ operations:
        "filters": {
          "status": "pending",
          "priority": "high",
          "dueDate": "today" | "tomorrow" | "YYYY-MM-DD"
        }
      }
    }
  ],
  "response": "Natural language response to the user explaining what actions will be taken"
}

Rules:
1. Extract ALL actionable items from the message - return multiple actions if needed
2. For updates/deletes, include searchParams to find the correct items
3. Use clear, actionable language in responses
4. For ambiguous requests, create actions with broad search params to show options
5. If no actions are needed (general questions), return empty actions array with just response
6. Always include a helpful response explaining what will happen

Examples:
"Create a task to call John tomorrow and delete my grocery task"
→ Returns CREATE TASK action + DELETE TASK action with search params

"Update all my urgent tasks to be due next week"  
→ Returns UPDATE TASK action with searchParams for urgent tasks and updates for due date

"Show me my high priority tasks"
→ Returns READ TASK action with priority filter`
  }

  /**
   * Enhance actions with additional context from database
   */
  async enhanceActions(actions, userId) {
    const enhancedActions = []
    
    for (const action of actions) {
      const enhanced = { ...action }
      
      // For UPDATE and DELETE operations, fetch matching items to show user what will be affected
      if ((action.action === 'UPDATE' || action.action === 'DELETE') && action.object === 'TASK') {
        if (action.params.searchParams) {
          const matchingTasks = await this.findMatchingTasks(action.params.searchParams, userId)
          enhanced.matchingItems = matchingTasks
          enhanced.itemCount = matchingTasks.length
          enhanced.description = this.getActionDescription(enhanced)
        }
      } else if ((action.action === 'UPDATE' || action.action === 'DELETE') && action.object === 'EVENT') {
        if (action.params.searchParams) {
          const matchingEvents = await this.findMatchingEvents(action.params.searchParams, userId)
          enhanced.matchingItems = matchingEvents
          enhanced.itemCount = matchingEvents.length
          enhanced.description = this.getActionDescription(enhanced)
        }
      }
      
      // Set description for all actions
      if (!enhanced.description) {
        enhanced.description = this.getActionDescription(enhanced)
      }
      
      enhancedActions.push(enhanced)
    }
    
    return enhancedActions
  }

  /**
   * Find tasks matching search parameters
   */
  async findMatchingTasks(searchParams, userId) {
    try {
      const allTasksResult = await this.taskService.getAll()
      if (!allTasksResult.success) return []
      
      const tasks = allTasksResult.data
      let matches = tasks
      
      // Apply filters
      if (searchParams.title) {
        const titleLower = searchParams.title.toLowerCase()
        matches = matches.filter(task => 
          task.title.toLowerCase().includes(titleLower)
        )
      }
      
      if (searchParams.status) {
        matches = matches.filter(task => task.status === searchParams.status)
      }
      
      if (searchParams.priority) {
        matches = matches.filter(task => task.priority === searchParams.priority)
      }
      
      if (searchParams.dueDate) {
        const targetDate = new Date(searchParams.dueDate)
        matches = matches.filter(task => {
          if (!task.dueDate) return false
          const taskDate = new Date(task.dueDate)
          return taskDate.toDateString() === targetDate.toDateString()
        })
      }
      
      if (searchParams.dueBefore) {
        const beforeDate = new Date(searchParams.dueBefore)
        matches = matches.filter(task => {
          if (!task.dueDate) return false
          return new Date(task.dueDate) < beforeDate
        })
      }
      
      if (searchParams.dueAfter) {
        const afterDate = new Date(searchParams.dueAfter)
        matches = matches.filter(task => {
          if (!task.dueDate) return false
          return new Date(task.dueDate) > afterDate
        })
      }
      
      return matches.slice(0, 10) // Limit to first 10 matches
    } catch (error) {
      console.error('Error finding matching tasks:', error)
      return []
    }
  }

  /**
   * Find events matching search parameters
   */
  async findMatchingEvents(searchParams, userId) {
    try {
      const allEventsResult = await this.eventService.getAll()
      if (!allEventsResult.success) return []
      
      // TODO: Implement event filtering based on searchParams
      return []
    } catch (error) {
      console.error('Error finding matching events:', error)
      return []
    }
  }

  /**
   * Execute confirmed actions
   */
  async executeActions(actions, userId) {
    const results = []
    
    for (const action of actions) {
      try {
        let result
        
        switch (`${action.action}_${action.object}`) {
          case 'CREATE_TASK':
            result = await this.taskService.create({
              ...action.params,
              userId
            })
            break
            
          case 'UPDATE_TASK':
            if (action.matchingItems && action.matchingItems.length > 0) {
              const updateResults = []
              for (const task of action.matchingItems) {
                const updateResult = await this.taskService.update(task.id, action.params.updates)
                updateResults.push(updateResult)
              }
              result = {
                success: updateResults.every(r => r.success),
                data: updateResults.map(r => r.data).filter(Boolean),
                updatedCount: updateResults.filter(r => r.success).length
              }
            }
            break
            
          case 'DELETE_TASK':
            if (action.matchingItems && action.matchingItems.length > 0) {
              const deleteResults = []
              for (const task of action.matchingItems) {
                const deleteResult = await this.taskService.delete(task.id)
                deleteResults.push(deleteResult)
              }
              result = {
                success: deleteResults.every(r => r.success),
                deletedCount: deleteResults.filter(r => r.success).length
              }
            }
            break
            
          case 'READ_TASK':
            result = await this.taskService.getAll(action.params.filters || {})
            break
            
          case 'CREATE_EVENT':
            result = await this.eventService.create({
              ...action.params,
              userId
            })
            break
            
          // Add other event operations as needed
        }
        
        results.push({
          action,
          result,
          success: result?.success || false
        })
      } catch (error) {
        console.error(`Error executing action ${action.action}_${action.object}:`, error)
        results.push({
          action,
          result: { success: false, error: error.message },
          success: false
        })
      }
    }
    
    return results
  }

  /**
   * Get human-readable description of an action
   */
  getActionDescription(action) {
    const { action: verb, object, params } = action
    
    switch (`${verb}_${object}`) {
      case 'CREATE_TASK':
        return `Create task: "${params.title}"`
      case 'UPDATE_TASK':
        return `Update ${action.itemCount || 0} task(s)${params.searchParams?.title ? ` matching "${params.searchParams.title}"` : ''}`
      case 'DELETE_TASK':
        return `Delete ${action.itemCount || 0} task(s)${params.searchParams?.title ? ` matching "${params.searchParams.title}"` : ''}`
      case 'READ_TASK':
        return `Show tasks with filters`
      case 'CREATE_EVENT':
        return `Create event: "${params.title}"`
      default:
        return `${verb} ${object}`
    }
  }
}

export const chatCommandService = new ChatCommandService()
export default chatCommandService
