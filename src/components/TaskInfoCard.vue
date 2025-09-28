<template>
  <q-card 
    class="task-info-card cursor-pointer"
    :class="priorityClass"
    @click="navigateToTask"
    flat
    bordered
  >
    <q-card-section class="q-pa-sm">
      <div class="row items-center no-wrap">
        <q-icon 
          name="task_alt" 
          :color="priorityColor" 
          size="18px" 
          class="q-mr-sm"
        />
        <div class="col text-subtitle2 ellipsis">
          {{ task.title }}
        </div>
        <q-icon 
          name="open_in_new" 
          color="grey-6" 
          size="14px" 
          class="q-ml-sm"
        />
      </div>
      
      <div class="row items-center q-mt-xs text-caption text-grey-6">
        <span class="priority-badge" :class="priorityClass">
          {{ task.priority }}
        </span>
        <span v-if="task.dueDate" class="q-ml-sm">
          <q-icon name="schedule" size="12px" class="q-mr-xs"/>
          {{ formatDueDate(task.dueDate) }}
        </span>
        <span v-if="task.status" class="q-ml-sm">
          <q-icon :name="statusIcon" size="12px" class="q-mr-xs"/>
          {{ task.status }}
        </span>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

const router = useRouter()

const priorityClass = computed(() => {
  const priority = props.task.priority || 'medium'
  return `priority-${priority}`
})

const priorityColor = computed(() => {
  switch (props.task.priority) {
    case 'urgent': return 'red'
    case 'high': return 'orange'
    case 'medium': return 'blue'
    case 'low': return 'grey'
    default: return 'blue'
  }
})

const statusIcon = computed(() => {
  switch (props.task.status) {
    case 'completed': return 'check_circle'
    case 'in_progress': return 'radio_button_partial'
    case 'pending': return 'radio_button_unchecked'
    default: return 'radio_button_unchecked'
  }
})

const formatDueDate = (date) => {
  if (!date) return ''
  const dueDate = new Date(date)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (dueDate.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (dueDate.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  }
  
  return dueDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: dueDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  })
}

const navigateToTask = () => {
  router.push(`/tasks/${props.task.id}`)
}
</script>

<style scoped>
.task-info-card {
  transition: all 0.2s;
  max-width: 300px;
}

.task-info-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.priority-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 8px;
}

.priority-urgent {
  border-left: 3px solid #f44336;
}

.priority-urgent .priority-badge {
  background: #ffebee;
  color: #c62828;
}

.priority-high {
  border-left: 3px solid #ff9800;
}

.priority-high .priority-badge {
  background: #fff3e0;
  color: #e65100;
}

.priority-medium {
  border-left: 3px solid #2196f3;
}

.priority-medium .priority-badge {
  background: #e3f2fd;
  color: #1565c0;
}

.priority-low {
  border-left: 3px solid #9e9e9e;
}

.priority-low .priority-badge {
  background: #f5f5f5;
  color: #424242;
}
</style>