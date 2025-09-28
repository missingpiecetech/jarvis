<template>
  <q-page class="q-pa-lg">
    <!-- Page Header -->
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <h4 class="text-h4 q-my-none">Tasks</h4>
        <p class="text-grey-6 q-mb-none">Manage your tasks and stay organized</p>
      </div>
      <q-btn 
        color="primary" 
        icon="add" 
        label="New Task" 
        @click="showCreateDialog = true"
      />
    </div>

    <!-- Task Stats Cards -->
    <div class="row q-gutter-md q-mb-lg">
      <div class="col-md-3 col-sm-6 col-xs-12">
        <q-card>
          <q-card-section class="text-center">
            <q-icon name="assignment" size="48px" color="primary" />
            <div class="text-h6 q-mt-sm">Total Tasks</div>
            <div class="text-h4 text-primary">{{ taskStats.total }}</div>
          </q-card-section>
        </q-card>
      </div>
      
      <div class="col-md-3 col-sm-6 col-xs-12">
        <q-card>
          <q-card-section class="text-center">
            <q-icon name="schedule" size="48px" color="orange" />
            <div class="text-h6 q-mt-sm">Pending</div>
            <div class="text-h4 text-orange">{{ taskStats.pending }}</div>
          </q-card-section>
        </q-card>
      </div>
      
      <div class="col-md-3 col-sm-6 col-xs-12">
        <q-card>
          <q-card-section class="text-center">
            <q-icon name="check_circle" size="48px" color="green" />
            <div class="text-h6 q-mt-sm">Completed</div>
            <div class="text-h4 text-green">{{ taskStats.completed }}</div>
          </q-card-section>
        </q-card>
      </div>
      
      <div class="col-md-3 col-sm-6 col-xs-12">
        <q-card>
          <q-card-section class="text-center">
            <q-icon name="error" size="48px" color="red" />
            <div class="text-h6 q-mt-sm">Overdue</div>
            <div class="text-h4 text-red">{{ taskStats.overdue }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Tasks List -->
    <q-card>
      <q-card-section>
        <div class="row items-center q-mb-md">
          <div class="text-h6">Recent Tasks</div>
          <q-space />
          <q-btn-toggle
            v-model="currentFilter"
            toggle-color="primary"
            :options="filterOptions"
            @update:model-value="loadTasks"
          />
        </div>
        
        <q-list separator>
          <q-item v-if="loading" class="text-center">
            <q-item-section>
              <q-spinner size="48px" color="primary" />
            </q-item-section>
          </q-item>
          
          <q-item 
            v-for="task in tasks" 
            :key="task.id"
            class="task-item"
            clickable
            @click="selectTask(task)"
          >
            <q-item-section avatar>
              <q-checkbox 
                :model-value="task.status === 'completed'"
                @update:model-value="toggleTaskComplete(task)"
                :color="getPriorityColor(task.priority)"
              />
            </q-item-section>
            
            <q-item-section>
              <q-item-label :class="{ 'text-strike': task.status === 'completed' }">
                {{ task.title }}
              </q-item-label>
              <q-item-label caption v-if="task.description">
                {{ task.description }}
              </q-item-label>
              <q-item-label caption class="row items-center q-gutter-sm q-mt-xs">
                <q-chip 
                  :color="getPriorityColor(task.priority)" 
                  text-color="white" 
                  size="sm"
                >
                  {{ task.priority.toUpperCase() }}
                </q-chip>
                <span v-if="task.dueDate" class="text-grey-6">
                  Due: {{ formatDate(task.dueDate) }}
                </span>
                <span v-if="task.tags.length > 0" class="text-grey-6">
                  Tags: {{ task.tags.join(', ') }}
                </span>
              </q-item-label>
            </q-item-section>
            
            <q-item-section side>
              <div class="text-grey-8 q-gutter-xs">
                <q-btn 
                  flat 
                  dense 
                  round 
                  icon="edit" 
                  @click.stop="editTask(task)"
                />
                <q-btn 
                  flat 
                  dense 
                  round 
                  icon="delete" 
                  @click.stop="deleteTask(task)"
                />
              </div>
            </q-item-section>
          </q-item>
          
          <q-item v-if="!loading && tasks.length === 0">
            <q-item-section class="text-center text-grey-6">
              <div>
                <q-icon name="assignment" size="64px" />
                <div class="text-h6 q-mt-md">No tasks found</div>
                <div>Create your first task to get started!</div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- Create/Edit Task Dialog -->
    <q-dialog v-model="showCreateDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ editingTask ? 'Edit Task' : 'Create New Task' }}</div>
        </q-card-section>
        
        <q-card-section class="q-pt-none">
          <q-form @submit="saveTask" class="q-gutter-md">
            <q-input
              v-model="taskForm.title"
              label="Title *"
              filled
              :rules="[val => !!val || 'Title is required']"
            />
            
            <q-input
              v-model="taskForm.description"
              label="Description"
              type="textarea"
              filled
              rows="3"
            />
            
            <div class="row q-gutter-md">
              <q-select
                v-model="taskForm.priority"
                label="Priority"
                filled
                :options="priorityOptions"
                class="col"
              />
              
              <q-input
                v-model.number="taskForm.value"
                label="Value (0-100)"
                type="number"
                filled
                min="0"
                max="100"
                class="col"
              />
            </div>
            
            <q-input
              v-model="taskForm.dueDate"
              label="Due Date"
              type="datetime-local"
              filled
            />
            
            <q-input
              v-model="taskForm.tags"
              label="Tags (comma separated)"
              filled
              hint="e.g. work, urgent, project"
            />
          </q-form>
        </q-card-section>
        
        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="closeDialog" />
          <q-btn 
            color="primary" 
            label="Save" 
            @click="saveTask"
            :loading="saving"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { taskService } from 'src/services'
import { Task } from 'src/models'

const $q = useQuasar()

// Reactive data
const tasks = ref([])
const loading = ref(false)
const saving = ref(false)
const showCreateDialog = ref(false)
const editingTask = ref(null)
const currentFilter = ref('all')

// Task form
const taskForm = ref({
  title: '',
  description: '',
  priority: 'medium',
  value: 50,
  dueDate: '',
  tags: ''
})

// Options
const priorityOptions = ['low', 'medium', 'high', 'urgent']
const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Overdue', value: 'overdue' }
]

// Computed
const taskStats = computed(() => {
  const stats = {
    total: tasks.value.length,
    pending: 0,
    completed: 0,
    overdue: 0
  }
  
  tasks.value.forEach(task => {
    if (task.status === 'completed') {
      stats.completed++
    } else if (task.status === 'pending') {
      stats.pending++
      if (task.isOverdue()) {
        stats.overdue++
      }
    }
  })
  
  return stats
})

// Methods
const loadTasks = async () => {
  loading.value = true
  try {
    let result
    
    switch (currentFilter.value) {
      case 'pending':
        result = await taskService.getAll({ filter: 'status = "pending"' })
        break
      case 'completed':
        result = await taskService.getAll({ filter: 'status = "completed"' })
        break
      case 'overdue':
        // Get overdue tasks (due date in the past and not completed)
        const now = new Date().toISOString()
        result = await taskService.getAll({ 
          filter: `due_date < "${now}" && status != "completed"` 
        })
        break
      default:
        result = await taskService.getAll()
    }
    
    if (result.success) {
      tasks.value = result.data
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to load tasks: ' + result.error
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error loading tasks: ' + error.message
    })
  } finally {
    loading.value = false
  }
}

const saveTask = async () => {
  if (!taskForm.value.title) {
    $q.notify({
      type: 'negative',
      message: 'Title is required'
    })
    return
  }
  
  saving.value = true
  try {
    const taskData = {
      ...taskForm.value,
      dueDate: taskForm.value.dueDate ? new Date(taskForm.value.dueDate) : null,
      tags: taskForm.value.tags ? taskForm.value.tags.split(',').map(tag => tag.trim()) : []
    }
    
    let result
    if (editingTask.value) {
      result = await taskService.update(editingTask.value.id, taskData)
    } else {
      result = await taskService.create(taskData)
    }
    
    if (result.success) {
      $q.notify({
        type: 'positive',
        message: editingTask.value ? 'Task updated successfully' : 'Task created successfully'
      })
      closeDialog()
      loadTasks()
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to save task: ' + result.error
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error saving task: ' + error.message
    })
  } finally {
    saving.value = false
  }
}

const editTask = (task) => {
  editingTask.value = task
  taskForm.value = {
    title: task.title,
    description: task.description,
    priority: task.priority,
    value: task.value,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 16) : '',
    tags: task.tags.join(', ')
  }
  showCreateDialog.value = true
}

const deleteTask = async (task) => {
  const confirmed = await new Promise(resolve => {
    $q.dialog({
      title: 'Confirm Delete',
      message: `Are you sure you want to delete "${task.title}"?`,
      cancel: true,
      persistent: true
    }).onOk(() => resolve(true)).onCancel(() => resolve(false))
  })
  
  if (!confirmed) return
  
  try {
    const result = await taskService.delete(task.id)
    if (result.success) {
      $q.notify({
        type: 'positive',
        message: 'Task deleted successfully'
      })
      loadTasks()
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to delete task: ' + result.error
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error deleting task: ' + error.message
    })
  }
}

const toggleTaskComplete = async (task) => {
  try {
    const result = task.status === 'completed' 
      ? await taskService.update(task.id, { status: 'pending', completedAt: null })
      : await taskService.complete(task.id)
    
    if (result.success) {
      loadTasks()
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to update task: ' + result.error
      })
    }
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error updating task: ' + error.message
    })
  }
}

const selectTask = (task) => {
  // Could navigate to task detail page or show detail dialog
  console.log('Selected task:', task)
}

const closeDialog = () => {
  showCreateDialog.value = false
  editingTask.value = null
  taskForm.value = {
    title: '',
    description: '',
    priority: 'medium',
    value: 50,
    dueDate: '',
    tags: ''
  }
}

const getPriorityColor = (priority) => {
  const colors = {
    low: 'grey',
    medium: 'blue',
    high: 'orange',
    urgent: 'red'
  }
  return colors[priority] || 'grey'
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString()
}

// Lifecycle
onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.task-item:hover {
  background-color: var(--q-color-grey-1);
}

.text-strike {
  text-decoration: line-through;
  opacity: 0.6;
}
</style>