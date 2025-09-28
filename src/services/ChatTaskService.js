/**
 * Chat Task Service
 * Simplified service for task-related operations in chat context
 * Now primarily handles legacy parsing while new action system takes over
 */
import { taskService } from './TaskService.js'
import { Task } from 'src/models'

class ChatTaskService {
  constructor() {
    this.taskService = taskService
  }

  /**
   * Legacy method - kept for backward compatibility
   * New implementation uses modular action system in ChatCommandService
   */
  async parseTaskIntentWithLLM(message, aiService) {
    const prompt = `Analyze this message for task management intent. Return JSON only:

Message: "${message}"

{
  "intent": "create_task" | "edit_task" | "delete_task" | "list_tasks" | "complete_task" | "unknown",
  "confidence": 0.0-1.0,
  "tasks": [
    {
      "title": "clear task title",
      "priority": "low|medium|high|urgent",
      "dueDate": "YYYY-MM-DD or null"
    }
  ]
}`

    try {
      const response = await aiService.sendMessage([{
        role: 'user',
        content: prompt
      }], {
        model: 'gemini-2.5-pro',
        temperature: 0.2,
        maxTokens: 500
      })

      if (response.success) {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          return {
            intent: result.intent,
            confidence: result.confidence || 0.5,
            tasks: result.tasks || [],
            entities: result.tasks?.[0] || null,
            isMultiple: result.tasks?.length > 1
          }
        }
      }
    } catch (error) {
      console.error('Error parsing task intent:', error)
    }

    return {
      intent: 'unknown',
      confidence: 0.1,
      tasks: [],
      entities: null,
      isMultiple: false
    }
  }

  /**
   * Legacy task creation method
   */
  async processTaskCreation(taskData, userId) {
    try {
      if (Array.isArray(taskData)) {
        // Multiple tasks
        const results = []
        const successTasks = []
        
        for (const task of taskData) {
          const result = await this.taskService.create({
            ...task,
            userId,
            status: 'pending'
          })
          
          results.push(result)
          if (result.success) {
            successTasks.push(result.data)
          }
        }
        
        const successCount = results.filter(r => r.success).length
        
        return {
          success: successCount > 0,
          message: `✅ Created ${successCount} of ${taskData.length} tasks`,
          tasks: successTasks,
          visualElements: this.generateTaskCards(successTasks)
        }
      } else {
        // Single task
        const result = await this.taskService.create({
          ...taskData,
          userId,
          status: 'pending'
        })
        
        if (result.success) {
          return {
            success: true,
            message: `✅ Created task: "${result.data.title}"`,
            task: result.data,
            visualElements: this.generateTaskCards([result.data])
          }
        } else {
          return {
            success: false,
            message: `❌ Failed to create task: ${result.error}`
          }
        }
      }
    } catch (error) {
      console.error('Error creating tasks:', error)
      return {
        success: false,
        message: `❌ Error creating tasks: ${error.message}`
      }
    }
  }

  /**
   * Generate visual task cards for display
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
      clickAction: `/tasks/${task.id}`
    }))
  }
}

export const chatTaskService = new ChatTaskService()
export default chatTaskService
