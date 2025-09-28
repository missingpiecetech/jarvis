<template>
  <q-card 
    class="task-card cursor-pointer q-hoverable"
    :class="{
      'border-left-urgent': task.priority === 'urgent',
      'border-left-high': task.priority === 'high',
      'border-left-medium': task.priority === 'medium', 
      'border-left-low': task.priority === 'low'
    }"
    @click="$emit('click', task)"
  >
    <q-card-section>
      <div class="row items-start justify-between q-mb-sm">
        <div class="col">
          <div class="text-h6 q-mb-xs">{{ task.title }}</div>
          <div v-if="task.description" class="text-body2 text-grey-7 line-clamp-2">
            {{ task.description }}
          </div>
        </div>
        <div class="col-auto q-ml-md">
          <div class="row items-center q-gutter-xs">
            <q-chip 
              :color="getStatusColor(task.status)" 
              text-color="white" 
              size="sm"
              :label="formatStatus(task.status)"
            />
            <!-- Quick action buttons -->
            <div class="task-actions">
              <q-btn
                v-if="task.status !== 'completed'"
                flat
                round
                dense
                size="sm"
                icon="check"
                color="positive"
                @click.stop="$emit('complete', task)"
                class="q-ml-xs"
              >
                <q-tooltip>Mark as complete</q-tooltip>
              </q-btn>
              <q-btn
                flat
                round
                dense
                size="sm"
                icon="delete"
                color="negative"
                @click.stop="confirmDelete"
                class="q-ml-xs"
              >
                <q-tooltip>Delete task</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>
      </div>

      <div class="row items-center justify-between">
        <div class="col-auto">
          <div class="row items-center q-gutter-sm">
            <!-- Priority -->
            <q-chip 
              :color="getPriorityColor(task.priority)"
              text-color="white"
              size="sm"
              :icon="getPriorityIcon(task.priority)"
              :label="formatPriority(task.priority)"
            />
            
            <!-- Value -->
            <div class="text-body2 text-grey-6">
              <q-icon name="star" color="amber" size="xs" />
              {{ task.value }}
            </div>

            <!-- Subtasks count -->
            <div v-if="task.subtasks && task.subtasks.length > 0" class="text-body2 text-grey-6">
              <q-icon name="checklist" size="xs" />
              {{ completedSubtasks }}/{{ task.subtasks.length }}
            </div>
          </div>
        </div>

        <div class="col-auto">
          <!-- Due date -->
          <div v-if="task.dueDate" class="text-body2" :class="getDueDateClass(task.dueDate)">
            <q-icon name="schedule" size="xs" />
            {{ formatDueDate(task.dueDate) }}
          </div>
        </div>
      </div>
    </q-card-section>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="showDeleteDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">Delete Task</div>
        </q-card-section>
        <q-card-section>
          <div class="text-body1">
            Are you sure you want to delete "<strong>{{ task.title }}</strong>"?
          </div>
          <div class="text-body2 text-grey-6 q-mt-sm">
            This action cannot be undone.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showDeleteDialog = false" />
          <q-btn 
            flat 
            label="Delete" 
            color="negative" 
            @click="handleDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { date } from 'quasar'

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['click', 'delete', 'complete'])

const showDeleteDialog = ref(false)

const completedSubtasks = computed(() => {
  return props.task.subtasks?.filter(subtask => subtask.status === 'completed').length || 0
})

const confirmDelete = () => {
  showDeleteDialog.value = true
}

const handleDelete = () => {
  showDeleteDialog.value = false
  emit('delete', props.task)
}

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'positive'
    case 'in_progress': return 'warning'
    case 'pending': return 'info'
    default: return 'grey'
  }
}

const formatStatus = (status) => {
  switch (status) {
    case 'in_progress': return 'In Progress'
    case 'pending': return 'To Do'
    case 'completed': return 'Completed'
    default: return status
  }
}

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'urgent': return 'deep-orange'
    case 'high': return 'negative'
    case 'medium': return 'warning'
    case 'low': return 'info'
    default: return 'grey'
  }
}

const getPriorityIcon = (priority) => {
  switch (priority) {
    case 'urgent': return 'warning'
    case 'high': return 'priority_high'
    case 'medium': return 'remove'
    case 'low': return 'keyboard_arrow_down'
    default: return 'remove'
  }
}

const formatPriority = (priority) => {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

const formatDueDate = (dueDate) => {
  return date.formatDate(dueDate, 'MMM DD')
}

const getDueDateClass = (dueDate) => {
  const today = new Date()
  const due = new Date(dueDate)
  const diffDays = date.getDateDiff(due, today, 'days')
  
  if (diffDays < 0) return 'text-negative'
  if (diffDays <= 1) return 'text-warning'
  return 'text-grey-6'
}
</script>

<style scoped>
.task-card {
  transition: all 0.2s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.task-card:hover .task-actions {
  opacity: 1;
  visibility: visible;
}

.task-actions {
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
}

.border-left-urgent {
  border-left: 4px solid #ff5722;
}

.border-left-high {
  border-left: 4px solid #f44336;
}

.border-left-medium {
  border-left: 4px solid #ff9800;
}

.border-left-low {
  border-left: 4px solid #2196f3;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>