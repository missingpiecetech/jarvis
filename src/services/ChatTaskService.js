/**
 * Chat Task Service
 * Handles task management through natural language commands in chat
 */
import { taskService } from './TaskService.js'
import { Task } from 'src/models'

class ChatTaskService {
  constructor() {
    this.taskService = taskService
  }

  /**
   * Parse a user message for task-related intents and entities
   * Enhanced to detect multiple tasks in a single message
   */
  parseTaskIntent(message) {
    const lowerMessage = message.toLowerCase()
    
    // Intent patterns
    const createPatterns = [
      /(?:create|add|make|new)\s+(?:a\s+)?task/i,
      /(?:i\s+need\s+to|i\s+have\s+to|i\s+should|todo|to\s+do)/i,
      /(?:remind\s+me\s+to|don't\s+forget\s+to)/i
    ]
    
    const editPatterns = [
      /(?:edit|update|modify|change)\s+(?:the\s+)?task/i,
      /(?:update|change)\s+(?:my\s+)?(?:task|todo)/i
    ]
    
    const deletePatterns = [
      /(?:delete|remove|cancel)\s+(?:the\s+)?task/i,
      /(?:get\s+rid\s+of|throw\s+away)\s+(?:the\s+)?task/i
    ]
    
    const completePatterns = [
      /(?:complete|finish|done\s+with|mark\s+as\s+done)\s+(?:the\s+)?task/i,
      /(?:i\s+(?:finished|completed|did))/i,
      /(?:task\s+is\s+(?:done|complete|finished))/i
    ]
    
    const listPatterns = [
      /(?:show|list|get|see)\s+(?:my\s+)?(?:tasks|todos|task\s+list)/i,
      /(?:what\s+(?:tasks|todos)\s+do\s+i\s+have)/i,
      /(?:what's\s+on\s+my\s+(?:task\s+list|todo\s+list))/i
    ]
    
    const deadlinePatterns = [
      /(?:what|when)\s+(?:are\s+my\s+)?(?:deadlines|due\s+dates)/i,
      /(?:what's\s+due\s+(?:today|tomorrow|this\s+week))/i,
      /(?:upcoming\s+deadlines)/i
    ]
    
    const priorityPatterns = [
      /(?:high\s+priority|urgent|important)\s+tasks/i,
      /(?:what\s+(?:tasks|todos)\s+are\s+(?:urgent|high\s+priority|important))/i
    ]

    // Check for multiple task creation patterns
    const multipleTaskPatterns = [
      /(?:i\s+need\s+to|i\s+have\s+to|remind\s+me\s+to|don't\s+forget\s+to)/gi,
      /(?:also|and\s+then|then|next|after\s+that)/gi,
      /(?:\d+\.\s+|\d+\)\s+|[-•]\s+)/g // numbered or bulleted lists
    ]

    // Determine intent
    let intent = 'unknown'
    let isMultipleTaskIntent = false
    
    if (createPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'create_task'
      // Check if this looks like multiple tasks
      isMultipleTaskIntent = multipleTaskPatterns.some(pattern => 
        (lowerMessage.match(pattern) || []).length > 1
      )
    } else if (editPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'edit_task'
    } else if (deletePatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'delete_task'
    } else if (completePatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'complete_task'
    } else if (listPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'list_tasks'
    } else if (deadlinePatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'query_deadlines'
    } else if (priorityPatterns.some(pattern => pattern.test(lowerMessage))) {
      intent = 'query_priority_tasks'
    }

    // Extract entities (single or multiple)
    const entities = isMultipleTaskIntent ? 
      this.extractMultipleTaskEntities(message) : 
      this.extractTaskEntities(message)

    return {
      intent,
      entities,
      isMultiple: isMultipleTaskIntent,
      confidence: this.calculateConfidence(intent, entities, message)
    }
  }

  /**
   * Extract multiple task entities from message
   */
  extractMultipleTaskEntities(message) {
    // Split message into potential task segments
    const segments = this.splitIntoTaskSegments(message)
    const tasks = []
    
    for (const segment of segments) {
      const taskEntity = this.extractTaskEntities(segment)
      if (taskEntity.title && taskEntity.title.trim()) {
        tasks.push(taskEntity)
      }
    }
    
    // If no multiple tasks found, fall back to single task extraction
    if (tasks.length === 0) {
      const singleTask = this.extractTaskEntities(message)
      return singleTask.title ? [singleTask] : []
    }
    
    return tasks
  }

  /**
   * Split message into individual task segments
   */
  splitIntoTaskSegments(message) {
    // Remove task creation prefixes for cleaner splitting
    let cleanMessage = message
      .replace(/(?:create|add|make|new)\s+(?:a\s+)?task(?:s)?\s+(?:to\s+|for\s+)?/gi, '')
      .replace(/(?:i\s+need\s+to|i\s+have\s+to|i\s+should|remind\s+me\s+to|don't\s+forget\s+to)\s+/gi, '')
    
    // Split by common delimiters for multiple tasks
    const delimiters = [
      /\s+and\s+(?:also\s+)?(?:i\s+need\s+to|i\s+have\s+to|i\s+should|remind\s+me\s+to|don't\s+forget\s+to)\s+/gi,
      /\s+(?:also|then|next|after\s+that)\s+(?:i\s+need\s+to|i\s+have\s+to|i\s+should|remind\s+me\s+to|don't\s+forget\s+to)\s+/gi,
      /\s+(?:and|also|then|next|after\s+that)\s+/gi,
      /\s*[,;]\s*(?:and\s+)?/gi,
      /\s*\d+\.\s+/g, // numbered lists
      /\s*\d+\)\s+/g, // numbered lists with parentheses
      /\s*[-•]\s+/g   // bulleted lists
    ]
    
    let segments = [cleanMessage]
    
    // Apply each delimiter to split further
    for (const delimiter of delimiters) {
      const newSegments = []
      for (const segment of segments) {
        const split = segment.split(delimiter).filter(s => s.trim())
        newSegments.push(...split)
      }
      if (newSegments.length > segments.length) {
        segments = newSegments
        break // Found a good split, use it
      }
    }
    
    // Clean up segments
    return segments
      .map(s => s.trim())
      .filter(s => s.length > 2) // Filter out very short segments
      .slice(0, 10) // Limit to reasonable number of tasks
  }

  /**
   * Extract task entities from message (title, priority, due date, etc.)
   */
  extractTaskEntities(message) {
    const entities = {}
    
    // Extract priority
    const priorityPatterns = {
      urgent: /(?:urgent|asap|immediately|right\s+away)/i,
      high: /(?:high\s+priority|important|critical)/i,
      medium: /(?:medium\s+priority|normal)/i,
      low: /(?:low\s+priority|whenever|not\s+urgent)/i
    }
    
    for (const [priority, pattern] of Object.entries(priorityPatterns)) {
      if (pattern.test(message)) {
        entities.priority = priority
        break
      }
    }
    
    // Extract due dates
    const datePatterns = [
      { pattern: /(?:today|by\s+today)/i, value: 'today' },
      { pattern: /(?:tomorrow|by\s+tomorrow)/i, value: 'tomorrow' },
      { pattern: /(?:this\s+week|by\s+this\s+week)/i, value: 'this_week' },
      { pattern: /(?:next\s+week|by\s+next\s+week)/i, value: 'next_week' },
      { pattern: /(?:by\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i, value: 'specific_date' },
      { pattern: /(?:by\s+)?(\d{1,2}-\d{1,2}(?:-\d{2,4})?)/i, value: 'specific_date' }
    ]
    
    for (const datePattern of datePatterns) {
      const match = message.match(datePattern.pattern)
      if (match) {
        entities.dueDate = datePattern.value === 'specific_date' ? match[1] : datePattern.value
        break
      }
    }
    
    // Extract task title (remaining text after removing command words)
    let title = message
      .replace(/(?:create|add|make|new|i\s+need\s+to|i\s+have\s+to|i\s+should|todo|to\s+do|remind\s+me\s+to|don't\s+forget\s+to)\s+(?:a\s+)?(?:task\s+)?(?:called\s+|named\s+|to\s+)?/gi, '')
      .replace(/(?:urgent|asap|immediately|right\s+away|high\s+priority|important|critical|medium\s+priority|normal|low\s+priority|whenever|not\s+urgent)/gi, '')
      .replace(/(?:today|by\s+today|tomorrow|by\s+tomorrow|this\s+week|by\s+this\s+week|next\s+week|by\s+next\s+week)/gi, '')
      .replace(/(?:by\s+)?(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/gi, '')
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
    
    if (entities.priority || entities.dueDate) {
      confidence += 0.1
    }
    
    return Math.min(confidence, 1.0)
  }

  /**
   * Process task creation from chat (single or multiple tasks)
   */
  async processTaskCreation(entities, userId) {
    try {
      // Handle multiple tasks
      if (Array.isArray(entities)) {
        const results = []
        const successTasks = []
        const failedTasks = []
        
        for (const taskEntity of entities) {
          const result = await this.createSingleTask(taskEntity, userId)
          results.push(result)
          
          if (result.success) {
            successTasks.push(result.task)
          } else {
            failedTasks.push({ entity: taskEntity, error: result.message })
          }
        }
        
        // Generate summary message
        let message = ''
        if (successTasks.length > 0) {
          message += `✅ Created ${successTasks.length} task${successTasks.length > 1 ? 's' : ''}:\n`
          successTasks.forEach(task => {
            message += `• **${task.title}**${task.dueDate ? ` (due ${this.formatDate(task.dueDate)})` : ''}\n`
          })
        }
        
        if (failedTasks.length > 0) {
          message += `\n❌ Failed to create ${failedTasks.length} task${failedTasks.length > 1 ? 's' : ''}:\n`
          failedTasks.forEach(failed => {
            message += `• ${failed.entity.title || 'Unknown task'}: ${failed.error}\n`
          })
        }
        
        return {
          success: successTasks.length > 0,
          tasks: successTasks,
          message: message.trim(),
          isMultiple: true
        }
      } else {
        // Handle single task
        return await this.createSingleTask(entities, userId)
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error creating task(s): ${error.message}`
      }
    }
  }

  /**
   * Create a single task
   */
  async createSingleTask(entities, userId) {
    try {
      // Prepare task data
      const taskData = {
        title: entities.title || 'New Task',
        description: '',
        priority: entities.priority || 'medium',
        status: 'pending',
        userId: userId
      }

      // Process due date
      if (entities.dueDate) {
        taskData.dueDate = this.parseDueDate(entities.dueDate)
      }

      // Create the task
      const result = await this.taskService.create(taskData)
      
      if (result.success) {
        return {
          success: true,
          task: result.data,
          message: `✅ Created task: "${taskData.title}"${taskData.dueDate ? ` (due ${this.formatDate(taskData.dueDate)})` : ''}`
        }
      } else {
        return {
          success: false,
          message: `❌ Failed to create task: ${result.error}`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error creating task: ${error.message}`
      }
    }
  }

  /**
   * Process task completion from chat
   */
  async processTaskCompletion(taskTitle, userId) {
    try {
      // Find tasks by title
      const tasksResult = await this.taskService.getAll({ status: 'pending' })
      
      if (!tasksResult.success) {
        return {
          success: false,
          message: '❌ Failed to retrieve tasks'
        }
      }

      const tasks = tasksResult.data.filter(task => 
        task.userId === userId && 
        task.title.toLowerCase().includes(taskTitle.toLowerCase())
      )

      if (tasks.length === 0) {
        return {
          success: false,
          message: `❌ No pending task found matching "${taskTitle}"`
        }
      }

      if (tasks.length > 1) {
        const taskList = tasks.map(t => `• ${t.title}`).join('\n')
        return {
          success: false,
          message: `❓ Multiple tasks found. Please be more specific:\n${taskList}`,
          needsClarification: true,
          tasks: tasks
        }
      }

      // Complete the task
      const task = tasks[0]
      const result = await this.taskService.complete(task.id)
      
      if (result.success) {
        return {
          success: true,
          task: result.data,
          message: `✅ Completed task: "${task.title}"`
        }
      } else {
        return {
          success: false,
          message: `❌ Failed to complete task: ${result.error}`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error completing task: ${error.message}`
      }
    }
  }

  /**
   * Process task deletion from chat
   */
  async processTaskDeletion(taskTitle, userId) {
    try {
      // Find tasks by title
      const tasksResult = await this.taskService.getAll()
      
      if (!tasksResult.success) {
        return {
          success: false,
          message: '❌ Failed to retrieve tasks'
        }
      }

      const tasks = tasksResult.data.filter(task => 
        task.userId === userId && 
        task.title.toLowerCase().includes(taskTitle.toLowerCase())
      )

      if (tasks.length === 0) {
        return {
          success: false,
          message: `❌ No task found matching "${taskTitle}"`
        }
      }

      if (tasks.length > 1) {
        const taskList = tasks.map(t => `• ${t.title}`).join('\n')
        return {
          success: false,
          message: `❓ Multiple tasks found. Please be more specific:\n${taskList}`,
          needsClarification: true,
          tasks: tasks
        }
      }

      // Delete the task
      const task = tasks[0]
      const result = await this.taskService.delete(task.id)
      
      if (result.success) {
        return {
          success: true,
          message: `🗑️ Deleted task: "${task.title}"`
        }
      } else {
        return {
          success: false,
          message: `❌ Failed to delete task: ${result.error}`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error deleting task: ${error.message}`
      }
    }
  }

  /**
   * Query tasks by various criteria
   */
  async queryTasks(intent, userId) {
    try {
      let filters = { userId }
      let title = ''

      switch (intent) {
        case 'list_tasks':
          filters.status = 'pending'
          title = '📋 Your current tasks:'
          break
        case 'query_deadlines':
          filters.status = 'pending'
          title = '⏰ Upcoming deadlines:'
          break
        case 'query_priority_tasks':
          filters.status = 'pending'
          filters.priority = 'high'
          title = '🔥 High priority tasks:'
          break
      }

      const tasksResult = await this.taskService.getAll(filters)
      
      if (!tasksResult.success) {
        return {
          success: false,
          message: '❌ Failed to retrieve tasks'
        }
      }

      let tasks = tasksResult.data

      // Special filtering for deadlines
      if (intent === 'query_deadlines') {
        tasks = tasks.filter(task => task.dueDate)
        tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      }

      if (tasks.length === 0) {
        const emptyMessages = {
          'list_tasks': '🎉 No pending tasks! You\'re all caught up.',
          'query_deadlines': '📅 No upcoming deadlines.',
          'query_priority_tasks': '✨ No high priority tasks.'
        }
        return {
          success: true,
          message: emptyMessages[intent] || 'No tasks found.',
          tasks: []
        }
      }

      // Format task list
      const taskList = tasks.map(task => {
        let taskStr = `• **${task.title}**`
        if (task.priority && task.priority !== 'medium') {
          taskStr += ` (${task.priority} priority)`
        }
        if (task.dueDate) {
          taskStr += ` - Due: ${this.formatDate(task.dueDate)}`
        }
        return taskStr
      }).join('\n')

      return {
        success: true,
        message: `${title}\n\n${taskList}`,
        tasks: tasks
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Error querying tasks: ${error.message}`
      }
    }
  }

  /**
   * Parse due date from various formats
   */
  parseDueDate(dueDateStr) {
    const now = new Date()
    
    switch (dueDateStr) {
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
        const nextWeekEnd = new Date(now)
        nextWeekEnd.setDate(now.getDate() + (14 - now.getDay()))
        return nextWeekEnd
      default:
        // Try to parse as specific date
        const parsed = new Date(dueDateStr)
        return isNaN(parsed.getTime()) ? null : parsed
    }
  }

  /**
   * Format date for display
   */
  formatDate(date) {
    if (!date) return ''
    
    const d = new Date(date)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    if (d.toDateString() === today.toDateString()) {
      return 'today'
    } else if (d.toDateString() === tomorrow.toDateString()) {
      return 'tomorrow'
    } else {
      return d.toLocaleDateString()
    }
  }

  /**
   * Generate enhanced prompt context for AI
   */
  async getTaskContext(userId) {
    try {
      const tasksResult = await this.taskService.getAll({ status: 'pending' })
      
      if (!tasksResult.success) {
        return ''
      }

      const tasks = tasksResult.data.filter(task => task.userId === userId)
      
      if (tasks.length === 0) {
        return 'The user currently has no pending tasks.'
      }

      const overdueCount = tasks.filter(task => 
        task.dueDate && new Date(task.dueDate) < new Date()
      ).length

      const dueTodayCount = tasks.filter(task => 
        task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString()
      ).length

      const highPriorityCount = tasks.filter(task => 
        task.priority === 'high' || task.priority === 'urgent'
      ).length

      let context = `Current task summary: ${tasks.length} pending tasks`
      
      if (overdueCount > 0) {
        context += `, ${overdueCount} overdue`
      }
      
      if (dueTodayCount > 0) {
        context += `, ${dueTodayCount} due today`
      }
      
      if (highPriorityCount > 0) {
        context += `, ${highPriorityCount} high priority`
      }

      return context + '.'
    } catch (error) {
      console.error('Error getting task context:', error)
      return ''
    }
  }
}

export const chatTaskService = new ChatTaskService()
export default chatTaskService