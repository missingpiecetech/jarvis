/**
 * Task data model
 * Represents a task with priority, value, due date, and subtasks
 */
export class Task {
  constructor(data = {}) {
    this.id = data.id || null
    this.title = data.title || ''
    this.description = data.description || ''
    this.priority = data.priority || 'medium' // low, medium, high, urgent
    this.value = data.value || 0 // Numerical value/importance rating (0-100)
    this.status = data.status || 'pending' // pending, in_progress, completed, cancelled
    this.dueDate = data.dueDate ? new Date(data.dueDate) : null
    this.completedAt = data.completedAt ? new Date(data.completedAt) : null
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date()
    this.userId = data.userId || null
    this.parentTaskId = data.parentTaskId || null // For subtasks
    this.subtasks = data.subtasks || [] // Array of Task instances
    this.tags = data.tags || [] // Array of strings
    this.estimatedDuration = data.estimatedDuration || null // Duration in minutes
    this.actualDuration = data.actualDuration || null // Duration in minutes
  }

  /**
   * Create a Task instance from PocketBase record
   */
  static fromPocketBase(record) {
    return new Task({
      id: record.id,
      title: record.title,
      description: record.description,
      priority: record.priority,
      value: record.value,
      status: record.status,
      dueDate: record.due_date,
      completedAt: record.completed_at,
      createdAt: record.created,
      updatedAt: record.updated,
      userId: record.user_id,
      parentTaskId: record.parent_task_id,
      tags: record.tags || [],
      estimatedDuration: record.estimated_duration,
      actualDuration: record.actual_duration
    })
  }

  /**
   * Convert Task instance to PocketBase format
   */
  toPocketBase() {
    return {
      title: this.title,
      description: this.description,
      priority: this.priority,
      value: this.value,
      status: this.status,
      due_date: this.dueDate ? this.dueDate.toISOString() : null,
      completed_at: this.completedAt ? this.completedAt.toISOString() : null,
      user_id: this.userId,
      parent_task_id: this.parentTaskId,
      tags: this.tags,
      estimated_duration: this.estimatedDuration,
      actual_duration: this.actualDuration
    }
  }

  /**
   * Check if task is overdue
   */
  isOverdue() {
    return this.dueDate && this.status !== 'completed' && new Date() > this.dueDate
  }

  /**
   * Check if task is completed
   */
  isCompleted() {
    return this.status === 'completed'
  }

  /**
   * Mark task as completed
   */
  complete() {
    this.status = 'completed'
    this.completedAt = new Date()
    this.updatedAt = new Date()
  }

  /**
   * Calculate priority score based on priority, value, and due date
   */
  getPriorityScore() {
    let score = this.value
    
    // Add priority multiplier
    const priorityMultipliers = {
      low: 1,
      medium: 1.5,
      high: 2,
      urgent: 3
    }
    score *= priorityMultipliers[this.priority] || 1

    // Add urgency based on due date
    if (this.dueDate) {
      const daysUntilDue = Math.ceil((this.dueDate - new Date()) / (1000 * 60 * 60 * 24))
      if (daysUntilDue <= 0) {
        score *= 2 // Overdue tasks get double priority
      } else if (daysUntilDue <= 3) {
        score *= 1.5 // Due soon gets 1.5x priority
      }
    }

    return score
  }

  /**
   * Validate task data
   */
  validate() {
    const errors = []
    
    if (!this.title?.trim()) {
      errors.push('Title is required')
    }
    
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    if (!validPriorities.includes(this.priority)) {
      errors.push('Priority must be one of: ' + validPriorities.join(', '))
    }
    
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled']
    if (!validStatuses.includes(this.status)) {
      errors.push('Status must be one of: ' + validStatuses.join(', '))
    }
    
    if (this.value < 0 || this.value > 100) {
      errors.push('Value must be between 0 and 100')
    }
    
    return errors
  }
}