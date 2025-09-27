<template>
  <div class="chat-task-card q-mb-sm">
    <q-card 
      flat 
      bordered
      class="cursor-pointer q-hoverable"
      :class="{
        'border-left-urgent': task.priority === 'urgent',
        'border-left-high': task.priority === 'high',
        'border-left-medium': task.priority === 'medium', 
        'border-left-low': task.priority === 'low'
      }"
      @click="navigateToTask"
    >
      <q-card-section class="q-pa-md">
        <div class="row items-center justify-between">
          <div class="col">
            <div class="row items-center q-gutter-sm">
              <q-icon name="task_alt" color="primary" size="sm" />
              <div class="text-subtitle2">{{ task.title }}</div>
            </div>
            <div v-if="task.description" class="text-body2 text-grey-7 q-mt-xs">
              {{ task.description }}
            </div>
          </div>
          <div class="col-auto">
            <div class="row items-center q-gutter-xs">
              <q-chip 
                :color="getPriorityColor(task.priority)"
                text-color="white"
                size="sm"
                :label="formatPriority(task.priority)"
              />
              <q-icon name="open_in_new" color="grey-5" size="sm" />
            </div>
          </div>
        </div>
        
        <div v-if="task.dueDate" class="row items-center q-mt-sm">
          <q-icon name="schedule" size="xs" class="q-mr-xs" />
          <div class="text-body2" :class="getDueDateClass(task.dueDate)">
            Due {{ formatDueDate(task.dueDate) }}
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { date } from 'quasar'

const router = useRouter()

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

const navigateToTask = () => {
  router.push(`/tasks/${props.task.id}`)
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

const formatPriority = (priority) => {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

const formatDueDate = (dueDate) => {
  return date.formatDate(dueDate, 'MMM DD, YYYY')
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
.chat-task-card {
  max-width: 400px;
}

.q-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.border-left-urgent {
  border-left: 3px solid #ff5722;
}

.border-left-high {
  border-left: 3px solid #f44336;
}

.border-left-medium {
  border-left: 3px solid #ff9800;
}

.border-left-low {
  border-left: 3px solid #2196f3;
}
</style>