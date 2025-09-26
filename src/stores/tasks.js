import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTaskStore = defineStore('tasks', () => {
  // Mock data for tasks
  const tasks = ref([
    {
      id: '1',
      title: 'Complete project proposal',
      description: 'Write and submit the Q4 project proposal for the new client dashboard',
      priority: 'high',
      value: 85,
      dueDate: '2024-01-15',
      status: 'in-progress',
      subtasks: [
        {
          id: '1-1',
          title: 'Research client requirements',
          status: 'completed',
          parentTaskId: '1'
        },
        {
          id: '1-2', 
          title: 'Draft initial proposal',
          status: 'in-progress',
          parentTaskId: '1'
        },
        {
          id: '1-3',
          title: 'Review with team',
          status: 'todo',
          parentTaskId: '1'
        }
      ],
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-10T14:30:00Z'
    },
    {
      id: '2',
      title: 'Plan team meeting',
      description: 'Organize the weekly team sync and prepare agenda',
      priority: 'medium',
      value: 30,
      dueDate: '2024-01-12',
      status: 'todo',
      subtasks: [
        {
          id: '2-1',
          title: 'Book conference room',
          status: 'todo',
          parentTaskId: '2'
        },
        {
          id: '2-2',
          title: 'Send calendar invites',
          status: 'todo',
          parentTaskId: '2'
        }
      ],
      createdAt: '2024-01-05T09:00:00Z',
      updatedAt: '2024-01-05T09:00:00Z'
    },
    {
      id: '3',
      title: 'Update documentation',
      description: 'Revise API documentation and user guides',
      priority: 'low',
      value: 15,
      dueDate: '2024-01-20',
      status: 'completed',
      subtasks: [],
      createdAt: '2023-12-20T16:00:00Z',
      updatedAt: '2024-01-08T11:15:00Z'
    },
    {
      id: '4',
      title: 'Code review for authentication',
      description: 'Review the new authentication system implementation',
      priority: 'high',
      value: 70,
      dueDate: '2024-01-14',
      status: 'todo',
      subtasks: [
        {
          id: '4-1',
          title: 'Test login functionality',
          status: 'todo',
          parentTaskId: '4'
        },
        {
          id: '4-2',
          title: 'Check security measures',
          status: 'todo',
          parentTaskId: '4'
        },
        {
          id: '4-3',
          title: 'Validate error handling',
          status: 'todo',
          parentTaskId: '4'
        }
      ],
      createdAt: '2024-01-07T13:00:00Z',
      updatedAt: '2024-01-07T13:00:00Z'
    }
  ])

  const nextId = ref(5)

  // Computed properties
  const todoTasks = computed(() => tasks.value.filter(task => task.status === 'todo'))
  const inProgressTasks = computed(() => tasks.value.filter(task => task.status === 'in-progress'))
  const completedTasks = computed(() => tasks.value.filter(task => task.status === 'completed'))

  const highPriorityTasks = computed(() => tasks.value.filter(task => task.priority === 'high'))
  const mediumPriorityTasks = computed(() => tasks.value.filter(task => task.priority === 'medium'))
  const lowPriorityTasks = computed(() => tasks.value.filter(task => task.priority === 'low'))

  // Actions
  const getTaskById = (id) => {
    return tasks.value.find(task => task.id === id)
  }

  const addTask = (taskData) => {
    const newTask = {
      id: String(nextId.value++),
      title: taskData.title,
      description: taskData.description || '',
      priority: taskData.priority || 'medium',
      value: taskData.value || 0,
      dueDate: taskData.dueDate || null,
      status: 'todo',
      subtasks: taskData.subtasks || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    tasks.value.push(newTask)
    return newTask
  }

  const updateTask = (id, updates) => {
    const taskIndex = tasks.value.findIndex(task => task.id === id)
    if (taskIndex !== -1) {
      tasks.value[taskIndex] = {
        ...tasks.value[taskIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      return tasks.value[taskIndex]
    }
    return null
  }

  const deleteTask = (id) => {
    const taskIndex = tasks.value.findIndex(task => task.id === id)
    if (taskIndex !== -1) {
      tasks.value.splice(taskIndex, 1)
      return true
    }
    return false
  }

  const addSubtask = (parentTaskId, subtaskData) => {
    const parentTask = getTaskById(parentTaskId)
    if (parentTask) {
      const newSubtask = {
        id: `${parentTaskId}-${parentTask.subtasks.length + 1}`,
        title: subtaskData.title,
        status: 'todo',
        parentTaskId: parentTaskId
      }
      parentTask.subtasks.push(newSubtask)
      parentTask.updatedAt = new Date().toISOString()
      return newSubtask
    }
    return null
  }

  const updateSubtask = (parentTaskId, subtaskId, updates) => {
    const parentTask = getTaskById(parentTaskId)
    if (parentTask) {
      const subtaskIndex = parentTask.subtasks.findIndex(subtask => subtask.id === subtaskId)
      if (subtaskIndex !== -1) {
        parentTask.subtasks[subtaskIndex] = {
          ...parentTask.subtasks[subtaskIndex],
          ...updates
        }
        parentTask.updatedAt = new Date().toISOString()
        return parentTask.subtasks[subtaskIndex]
      }
    }
    return null
  }

  const deleteSubtask = (parentTaskId, subtaskId) => {
    const parentTask = getTaskById(parentTaskId)
    if (parentTask) {
      const subtaskIndex = parentTask.subtasks.findIndex(subtask => subtask.id === subtaskId)
      if (subtaskIndex !== -1) {
        parentTask.subtasks.splice(subtaskIndex, 1)
        parentTask.updatedAt = new Date().toISOString()
        return true
      }
    }
    return false
  }

  return {
    tasks,
    todoTasks,
    inProgressTasks,
    completedTasks,
    highPriorityTasks,
    mediumPriorityTasks,
    lowPriorityTasks,
    getTaskById,
    addTask,
    updateTask,
    deleteTask,
    addSubtask,
    updateSubtask,
    deleteSubtask
  }
})