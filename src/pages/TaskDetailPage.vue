<template>
  <q-page class="q-pa-lg">
    <div v-if="!task" class="text-center q-py-xl">
      <q-icon name="error" size="64px" color="grey-4" />
      <div class="text-h6 text-grey-6 q-mt-md">Task not found</div>
      <q-btn 
        color="primary" 
        label="Back to Tasks" 
        @click="$router.push('/tasks')"
        class="q-mt-md"
        unelevated
      />
    </div>

    <div v-else>
      <!-- Header -->
      <div class="row items-center justify-between q-mb-xl">
        <div class="col">
          <q-btn 
            flat 
            icon="arrow_back" 
            label="Back to Tasks"
            @click="$router.push('/tasks')"
            class="q-mb-md"
          />
          <h4 class="text-h4 q-my-none">{{ editing ? 'Edit Task' : 'Task Details' }}</h4>
        </div>
        <div class="col-auto">
          <q-btn-group v-if="!editing" unelevated>
            <q-btn 
              color="primary" 
              icon="edit" 
              label="Edit"
              @click="startEditing"
            />
            <q-btn 
              color="negative" 
              icon="delete" 
              label="Delete"
              @click="confirmDelete"
            />
          </q-btn-group>
          <q-btn-group v-else unelevated>
            <q-btn 
              color="positive" 
              icon="save" 
              label="Save"
              @click="saveTask"
            />
            <q-btn 
              color="grey" 
              icon="cancel" 
              label="Cancel"
              @click="cancelEditing"
            />
          </q-btn-group>
        </div>
      </div>

      <div class="row q-gutter-lg">
        <!-- Main Task Details -->
        <div class="col-12 col-md-8">
          <q-card>
            <q-card-section>
              <!-- Title -->
              <div class="q-mb-md">
                <label class="text-subtitle2 text-grey-7">Title</label>
                <div v-if="!editing" class="text-h5 q-mt-xs">{{ task.title }}</div>
                <q-input 
                  v-else
                  v-model="editForm.title"
                  outlined
                  dense
                  class="q-mt-xs"
                />
              </div>

              <!-- Description -->
              <div class="q-mb-md">
                <label class="text-subtitle2 text-grey-7">Description</label>
                <div v-if="!editing" class="text-body1 q-mt-xs" style="white-space: pre-wrap;">
                  {{ task.description || 'No description provided' }}
                </div>
                <q-input 
                  v-else
                  v-model="editForm.description"
                  type="textarea"
                  outlined
                  rows="4"
                  class="q-mt-xs"
                />
              </div>

              <!-- Priority, Value, Status Row -->
              <div class="row q-gutter-md q-mb-md">
                <div class="col">
                  <label class="text-subtitle2 text-grey-7">Priority</label>
                  <div v-if="!editing" class="q-mt-xs">
                    <q-chip 
                      :color="getPriorityColor(task.priority)"
                      text-color="white"
                      :icon="getPriorityIcon(task.priority)"
                      :label="formatPriority(task.priority)"
                    />
                  </div>
                  <q-select 
                    v-else
                    v-model="editForm.priority"
                    :options="priorityOptions"
                    outlined
                    dense
                    emit-value
                    map-options
                    class="q-mt-xs"
                  />
                </div>
                <div class="col">
                  <label class="text-subtitle2 text-grey-7">Value</label>
                  <div v-if="!editing" class="text-h6 q-mt-xs">
                    <q-icon name="star" color="amber" size="sm" />
                    {{ task.value }}
                  </div>
                  <q-input 
                    v-else
                    v-model.number="editForm.value"
                    type="number"
                    outlined
                    dense
                    min="0"
                    max="100"
                    class="q-mt-xs"
                  />
                </div>
                <div class="col">
                  <label class="text-subtitle2 text-grey-7">Status</label>
                  <div v-if="!editing" class="q-mt-xs">
                    <q-chip 
                      :color="getStatusColor(task.status)"
                      text-color="white"
                      :label="formatStatus(task.status)"
                    />
                  </div>
                  <q-select 
                    v-else
                    v-model="editForm.status"
                    :options="statusOptions"
                    outlined
                    dense
                    emit-value
                    map-options
                    class="q-mt-xs"
                  />
                </div>
              </div>

              <!-- Due Date -->
              <div class="q-mb-md">
                <label class="text-subtitle2 text-grey-7">Due Date</label>
                <div v-if="!editing" class="text-h6 q-mt-xs" :class="getDueDateClass(task.dueDate)">
                  <q-icon name="schedule" size="sm" />
                  {{ task.dueDate ? formatDueDate(task.dueDate) : 'No due date set' }}
                </div>
                <q-input 
                  v-else
                  v-model="editForm.dueDate"
                  type="date"
                  outlined
                  dense
                  class="q-mt-xs"
                />
              </div>
            </q-card-section>
          </q-card>

          <!-- Subtasks Section -->
          <q-card class="q-mt-lg">
            <q-card-section>
              <div class="row items-center justify-between q-mb-md">
                <div class="text-h6">Subtasks</div>
                <q-btn 
                  color="primary" 
                  icon="add" 
                  label="Add Subtask"
                  size="sm"
                  @click="showAddSubtask = true"
                  unelevated
                />
              </div>

              <div v-if="task.subtasks.length === 0" class="text-center q-py-lg">
                <q-icon name="checklist" size="48px" color="grey-4" />
                <div class="text-body1 text-grey-6 q-mt-md">No subtasks yet</div>
                <div class="text-body2 text-grey-5">Break this task into smaller steps</div>
              </div>

              <q-list v-else separator>
                <q-item 
                  v-for="subtask in task.subtasks" 
                  :key="subtask.id"
                  class="q-pa-md"
                >
                  <q-item-section avatar>
                    <q-checkbox 
                      :model-value="subtask.status === 'completed'"
                      @update:model-value="(val) => toggleSubtaskStatus(subtask, val)"
                      color="positive"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label 
                      :class="{ 'text-strike text-grey-6': subtask.status === 'completed' }"
                    >
                      {{ subtask.title }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn 
                      flat 
                      round 
                      icon="delete" 
                      size="sm"
                      @click="deleteSubtask(subtask.id)"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <!-- Sidebar -->
        <div class="col-12 col-md-4">
          <q-card>
            <q-card-section>
              <div class="text-h6 q-mb-md">Task Information</div>
              
              <q-list>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Created</q-item-label>
                    <q-item-label>{{ formatDateTime(task.createdAt) }}</q-item-label>
                  </q-item-section>
                </q-item>
                
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Last Updated</q-item-label>
                    <q-item-label>{{ formatDateTime(task.updatedAt) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label caption>Progress</q-item-label>
                    <q-item-label>
                      {{ completedSubtasks }}/{{ task.subtasks.length }} subtasks completed
                    </q-item-label>
                    <q-linear-progress 
                      :value="progressPercentage" 
                      color="positive" 
                      class="q-mt-sm"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Add Subtask Dialog -->
    <q-dialog v-model="showAddSubtask">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add Subtask</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newSubtaskTitle"
            label="Subtask title"
            outlined
            autofocus
            @keyup.enter="addSubtask"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showAddSubtask = false" />
          <q-btn 
            color="primary" 
            label="Add" 
            @click="addSubtask"
            :disable="!newSubtaskTitle.trim()"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="showDeleteConfirm">
      <q-card>
        <q-card-section>
          <div class="text-h6">Delete Task</div>
        </q-card-section>

        <q-card-section>
          Are you sure you want to delete this task? This action cannot be undone.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showDeleteConfirm = false" />
          <q-btn color="negative" label="Delete" @click="deleteTask" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar, date } from 'quasar'
import { useTaskStore } from 'src/stores/tasks'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const taskStore = useTaskStore()

// Reactive data
const task = ref(null)
const editing = ref(false)
const editForm = ref({})
const showAddSubtask = ref(false)
const showDeleteConfirm = ref(false)
const newSubtaskTitle = ref('')

// Options
const priorityOptions = [
  { label: 'High Priority', value: 'high' },
  { label: 'Medium Priority', value: 'medium' },
  { label: 'Low Priority', value: 'low' }
]

const statusOptions = [
  { label: 'To Do', value: 'todo' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' }
]

// Computed properties
const completedSubtasks = computed(() => {
  return task.value?.subtasks?.filter(subtask => subtask.status === 'completed').length || 0
})

const progressPercentage = computed(() => {
  if (!task.value?.subtasks?.length) return 0
  return completedSubtasks.value / task.value.subtasks.length
})

// Methods
const loadTask = () => {
  const taskId = route.params.id
  task.value = taskStore.getTaskById(taskId)
}

const startEditing = () => {
  editing.value = true
  editForm.value = { ...task.value }
}

const cancelEditing = () => {
  editing.value = false
  editForm.value = {}
}

const saveTask = () => {
  const updated = taskStore.updateTask(task.value.id, editForm.value)
  if (updated) {
    task.value = updated
    editing.value = false
    $q.notify({
      type: 'positive',
      message: 'Task updated successfully',
      position: 'top'
    })
  }
}

const confirmDelete = () => {
  showDeleteConfirm.value = true
}

const deleteTask = () => {
  if (taskStore.deleteTask(task.value.id)) {
    $q.notify({
      type: 'positive',
      message: 'Task deleted successfully',
      position: 'top'
    })
    router.push('/tasks')
  }
}

const addSubtask = () => {
  if (newSubtaskTitle.value.trim()) {
    taskStore.addSubtask(task.value.id, { title: newSubtaskTitle.value.trim() })
    loadTask() // Reload to get updated task
    newSubtaskTitle.value = ''
    showAddSubtask.value = false
    $q.notify({
      type: 'positive',
      message: 'Subtask added successfully',
      position: 'top'
    })
  }
}

const toggleSubtaskStatus = (subtask, isCompleted) => {
  const newStatus = isCompleted ? 'completed' : 'todo'
  taskStore.updateSubtask(task.value.id, subtask.id, { status: newStatus })
  loadTask() // Reload to get updated task
}

const deleteSubtask = (subtaskId) => {
  taskStore.deleteSubtask(task.value.id, subtaskId)
  loadTask() // Reload to get updated task
  $q.notify({
    type: 'positive',
    message: 'Subtask deleted successfully',
    position: 'top'
  })
}

// Utility functions
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high': return 'negative'
    case 'medium': return 'warning'
    case 'low': return 'info'
    default: return 'grey'
  }
}

const getPriorityIcon = (priority) => {
  switch (priority) {
    case 'high': return 'priority_high'
    case 'medium': return 'remove'
    case 'low': return 'keyboard_arrow_down'
    default: return 'remove'
  }
}

const formatPriority = (priority) => {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'positive'
    case 'in-progress': return 'warning'
    case 'todo': return 'info'
    default: return 'grey'
  }
}

const formatStatus = (status) => {
  switch (status) {
    case 'in-progress': return 'In Progress'
    case 'todo': return 'To Do'
    case 'completed': return 'Completed'
    default: return status
  }
}

const formatDueDate = (dueDate) => {
  return date.formatDate(dueDate, 'MMMM DD, YYYY')
}

const formatDateTime = (dateTime) => {
  return date.formatDate(dateTime, 'MMMM DD, YYYY at h:mm A')
}

const getDueDateClass = (dueDate) => {
  if (!dueDate) return 'text-grey-6'
  
  const today = new Date()
  const due = new Date(dueDate)
  const diffDays = date.getDateDiff(due, today, 'days')
  
  if (diffDays < 0) return 'text-negative'
  if (diffDays <= 1) return 'text-warning'
  return 'text-grey-6'
}

// Lifecycle
onMounted(() => {
  loadTask()
})
</script>

<style scoped>
.text-strike {
  text-decoration: line-through;
}
</style>