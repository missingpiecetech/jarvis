/**
 * Task Service
 * Handles CRUD operations for tasks with PocketBase backend and local caching
 */
import { Task } from 'src/models'
import { pocketbaseService } from './pocketbase.js'
import { cacheService } from './cache.js'

class TaskService {
  constructor() {
    this.collection = 'tasks'
    this.cacheKey = 'jarvis_tasks'
  }

  /**
   * Create a new task
   */
  async create(taskData) {
    try {
      const task = new Task(taskData)
      const errors = task.validate()
      
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to create in PocketBase first
      let result
      if (pocketbaseService.isAuthenticated()) {
        result = await pocketbaseService.create(this.collection, task.toPocketBase())
        
        if (result.success) {
          task.id = result.data.id
          task.createdAt = new Date(result.data.created)
          task.updatedAt = new Date(result.data.updated)
        }
      } else {
        // Offline mode - generate local ID
        task.id = 'local_' + Date.now()
        result = { success: true, data: task }
      }

      // Cache the task locally
      await this.cacheTask(task)
      
      return { success: true, data: task }
    } catch (error) {
      console.error('Error creating task:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get task by ID
   */
  async get(id) {
    try {
      // Try cache first
      const cachedTask = await cacheService.get(`${this.cacheKey}_${id}`)
      if (cachedTask) {
        return { success: true, data: new Task(cachedTask) }
      }

      // Try PocketBase
      if (pocketbaseService.isAuthenticated()) {
        const result = await pocketbaseService.get(this.collection, id)
        if (result.success) {
          const task = Task.fromPocketBase(result.data)
          await this.cacheTask(task)
          return { success: true, data: task }
        }
      }

      return { success: false, error: 'Task not found' }
    } catch (error) {
      console.error('Error getting task:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get all tasks for current user
   */
  async getAll(filters = {}) {
    try {
      let tasks = []

      // Try PocketBase first
      if (pocketbaseService.isAuthenticated()) {
        const currentUser = pocketbaseService.getCurrentUser()
        const filter = `user_id = "${currentUser.id}"`
        const result = await pocketbaseService.getAll(this.collection, filter, '-created')
        
        if (result.success) {
          tasks = result.data.map(record => Task.fromPocketBase(record))
          // Update cache
          await this.cacheTasks(tasks)
        }
      }

      // Fallback to cache if PocketBase fails or offline
      if (tasks.length === 0) {
        const cachedTasks = await cacheService.get(this.cacheKey) || []
        tasks = cachedTasks.map(taskData => new Task(taskData))
      }

      // Apply filters
      tasks = this.applyFilters(tasks, filters)

      return { success: true, data: tasks }
    } catch (error) {
      console.error('Error getting tasks:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Update task
   */
  async update(id, updates) {
    try {
      // Get existing task
      const existingResult = await this.get(id)
      if (!existingResult.success) {
        return existingResult
      }

      const task = existingResult.data
      Object.assign(task, updates)
      task.updatedAt = new Date()

      const errors = task.validate()
      if (errors.length > 0) {
        return { success: false, error: errors.join(', ') }
      }

      // Try to update in PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith('local_')) {
        const result = await pocketbaseService.update(this.collection, id, task.toPocketBase())
        if (result.success) {
          task.updatedAt = new Date(result.data.updated)
        }
      }

      // Update cache
      await this.cacheTask(task)

      return { success: true, data: task }
    } catch (error) {
      console.error('Error updating task:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete task
   */
  async delete(id) {
    try {
      // Try to delete from PocketBase
      if (pocketbaseService.isAuthenticated() && !id.startsWith('local_')) {
        await pocketbaseService.delete(this.collection, id)
      }

      // Remove from cache
      await cacheService.remove(`${this.cacheKey}_${id}`)
      
      // Remove from tasks list cache
      const cachedTasks = await cacheService.get(this.cacheKey) || []
      const updatedTasks = cachedTasks.filter(task => task.id !== id)
      await cacheService.set(this.cacheKey, updatedTasks)

      return { success: true }
    } catch (error) {
      console.error('Error deleting task:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Complete task
   */
  async complete(id) {
    return this.update(id, { 
      status: 'completed', 
      completedAt: new Date() 
    })
  }

  /**
   * Get tasks by status
   */
  async getByStatus(status) {
    const result = await this.getAll({ status })
    return result
  }

  /**
   * Get overdue tasks
   */
  async getOverdue() {
    const result = await this.getAll()
    if (result.success) {
      const overdueTasks = result.data.filter(task => task.isOverdue())
      return { success: true, data: overdueTasks }
    }
    return result
  }

  /**
   * Get tasks due today
   */
  async getDueToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const result = await this.getAll()
    if (result.success) {
      const dueTodayTasks = result.data.filter(task => 
        task.dueDate && task.dueDate >= today && task.dueDate < tomorrow
      )
      return { success: true, data: dueTodayTasks }
    }
    return result
  }

  /**
   * Get subtasks for a parent task
   */
  async getSubtasks(parentTaskId) {
    return this.getAll({ parentTaskId })
  }

  /**
   * Cache a single task
   */
  async cacheTask(task) {
    await cacheService.set(`${this.cacheKey}_${task.id}`, task)
    
    // Also update the tasks list cache
    const cachedTasks = await cacheService.get(this.cacheKey) || []
    const existingIndex = cachedTasks.findIndex(t => t.id === task.id)
    
    if (existingIndex >= 0) {
      cachedTasks[existingIndex] = task
    } else {
      cachedTasks.push(task)
    }
    
    await cacheService.set(this.cacheKey, cachedTasks)
  }

  /**
   * Cache multiple tasks
   */
  async cacheTasks(tasks) {
    await cacheService.set(this.cacheKey, tasks)
    
    // Also cache individual tasks
    for (const task of tasks) {
      await cacheService.set(`${this.cacheKey}_${task.id}`, task)
    }
  }

  /**
   * Apply filters to task list
   */
  applyFilters(tasks, filters) {
    let filteredTasks = [...tasks]

    if (filters.status) {
      filteredTasks = filteredTasks.filter(task => task.status === filters.status)
    }

    if (filters.priority) {
      filteredTasks = filteredTasks.filter(task => task.priority === filters.priority)
    }

    if (filters.parentTaskId) {
      filteredTasks = filteredTasks.filter(task => task.parentTaskId === filters.parentTaskId)
    }

    if (filters.tags && filters.tags.length > 0) {
      filteredTasks = filteredTasks.filter(task => 
        filters.tags.some(tag => task.tags.includes(tag))
      )
    }

    if (filters.dueBefore) {
      const beforeDate = new Date(filters.dueBefore)
      filteredTasks = filteredTasks.filter(task => 
        task.dueDate && task.dueDate <= beforeDate
      )
    }

    if (filters.dueAfter) {
      const afterDate = new Date(filters.dueAfter)
      filteredTasks = filteredTasks.filter(task => 
        task.dueDate && task.dueDate >= afterDate
      )
    }

    // Sort by priority score by default
    filteredTasks.sort((a, b) => b.getPriorityScore() - a.getPriorityScore())

    return filteredTasks
  }

  /**
   * Sync local changes with PocketBase
   */
  async sync() {
    try {
      if (!pocketbaseService.isAuthenticated()) {
        return { success: false, error: 'Not authenticated' }
      }

      const cachedTasks = await cacheService.get(this.cacheKey) || []
      const localTasks = cachedTasks.filter(task => task.id.startsWith('local_'))
      
      const results = []
      
      for (const localTask of localTasks) {
        // Remove local ID and create in PocketBase
        const taskData = { ...localTask }
        delete taskData.id
        
        const result = await pocketbaseService.create(this.collection, new Task(taskData).toPocketBase())
        
        if (result.success) {
          // Update cache with new ID
          const newTask = Task.fromPocketBase(result.data)
          await this.cacheTask(newTask)
          
          // Remove old local cache entry
          await cacheService.remove(`${this.cacheKey}_${localTask.id}`)
          
          results.push({ localId: localTask.id, newId: newTask.id, success: true })
        } else {
          results.push({ localId: localTask.id, success: false, error: result.error })
        }
      }

      return { success: true, data: results }
    } catch (error) {
      console.error('Error syncing tasks:', error)
      return { success: false, error: error.message }
    }
  }
}

export const taskService = new TaskService()
export default taskService