<template>
  <q-page class="q-pa-lg">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-lg">
      <div class="col">
        <h4 class="text-h4 q-my-none">Tasks</h4>
        <p class="text-subtitle1 text-grey-6 q-my-none">
          Manage your tasks and track progress
        </p>
      </div>
      <div class="col-auto">
        <q-btn 
          color="primary" 
          icon="add" 
          label="New Task"
          @click="$router.push('/tasks/new')"
          unelevated
        />
      </div>
    </div>

    <!-- Filters and Stats -->
    <div class="row q-mb-lg">
      <!-- Filter Tabs -->
      <div class="col-12 q-mb-md">
        <q-tabs
          v-model="activeTab"
          dense
          class="text-grey"
          active-color="primary"
          indicator-color="primary"
          align="left"
        >
          <q-tab name="all" label="All Tasks" :badge="tasks?.length || 0" />
          <q-tab name="todo" label="To Do" :badge="todoTasks?.length || 0" />
          <q-tab name="in-progress" label="In Progress" :badge="inProgressTasks?.length || 0" />
          <q-tab name="completed" label="Completed" :badge="completedTasks?.length || 0" />
        </q-tabs>
      </div>

      <!-- Quick Stats -->
      <div class="col-12">
        <div class="row q-gutter-md">
          <div class="col-md-3 col-sm-6 col-xs-12">
            <q-card class="text-center bg-info text-white">
              <q-card-section class="q-py-md">
                <div class="text-h4">{{ tasks?.length || 0 }}</div>
                <div class="text-body2">Total Tasks</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-md-3 col-sm-6 col-xs-12">
            <q-card class="text-center bg-warning text-white">
              <q-card-section class="q-py-md">
                <div class="text-h4">{{ inProgressTasks?.length || 0 }}</div>
                <div class="text-body2">In Progress</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-md-3 col-sm-6 col-xs-12">
            <q-card class="text-center bg-positive text-white">
              <q-card-section class="q-py-md">
                <div class="text-h4">{{ completedTasks?.length || 0 }}</div>
                <div class="text-body2">Completed</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-md-3 col-sm-6 col-xs-12">
            <q-card class="text-center bg-negative text-white">
              <q-card-section class="q-py-md">
                <div class="text-h4">{{ highPriorityTasks?.length || 0 }}</div>
                <div class="text-body2">High Priority</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="row q-mb-lg q-gutter-md">
      <div class="col-md-6 col-xs-12">
        <q-input
          v-model="searchQuery"
          placeholder="Search tasks..."
          outlined
          dense
          clearable
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
      <div class="col-md-3 col-xs-6">
        <q-select
          v-model="priorityFilter"
          :options="priorityOptions"
          label="Priority"
          outlined
          dense
          clearable
          emit-value
          map-options
        />
      </div>
      <div class="col-md-3 col-xs-6">
        <q-select
          v-model="sortBy"
          :options="sortOptions"
          label="Sort by"
          outlined
          dense
          emit-value
          map-options
        />
      </div>
    </div>

    <!-- Task List -->
    <div class="row">
      <div class="col-12">
        <q-tab-panels v-model="activeTab" animated>
          <!-- All Tasks -->
          <q-tab-panel name="all">
            <div v-if="filteredTasks.length === 0" class="text-center q-py-xl">
              <q-icon name="task_alt" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">No tasks found</div>
              <div class="text-body2 text-grey-5">
                {{ searchQuery ? 'Try adjusting your search or filters' : 'Create your first task to get started' }}
              </div>
            </div>
            <div v-else class="row q-gutter-md">
              <div 
                v-for="task in filteredTasks" 
                :key="task.id" 
                class="col-12 col-md-6 col-lg-4"
              >
                <TaskCard 
                  :task="task" 
                  @click="$router.push(`/tasks/${task.id}`)"
                />
              </div>
            </div>
          </q-tab-panel>

          <!-- To Do Tasks -->
          <q-tab-panel name="todo">
            <div v-if="filteredTasks.filter(t => t.status === 'todo').length === 0" class="text-center q-py-xl">
              <q-icon name="assignment" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">No to-do tasks</div>
            </div>
            <div v-else class="row q-gutter-md">
              <div 
                v-for="task in filteredTasks.filter(t => t.status === 'todo')" 
                :key="task.id" 
                class="col-12 col-md-6 col-lg-4"
              >
                <TaskCard 
                  :task="task" 
                  @click="$router.push(`/tasks/${task.id}`)"
                />
              </div>
            </div>
          </q-tab-panel>

          <!-- In Progress Tasks -->
          <q-tab-panel name="in-progress">
            <div v-if="filteredTasks.filter(t => t.status === 'in-progress').length === 0" class="text-center q-py-xl">
              <q-icon name="pending" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">No tasks in progress</div>
            </div>
            <div v-else class="row q-gutter-md">
              <div 
                v-for="task in filteredTasks.filter(t => t.status === 'in-progress')" 
                :key="task.id" 
                class="col-12 col-md-6 col-lg-4"
              >
                <TaskCard 
                  :task="task" 
                  @click="$router.push(`/tasks/${task.id}`)"
                />
              </div>
            </div>
          </q-tab-panel>

          <!-- Completed Tasks -->
          <q-tab-panel name="completed">
            <div v-if="filteredTasks.filter(t => t.status === 'completed').length === 0" class="text-center q-py-xl">
              <q-icon name="task_alt" size="64px" color="grey-4" />
              <div class="text-h6 text-grey-6 q-mt-md">No completed tasks</div>
            </div>
            <div v-else class="row q-gutter-md">
              <div 
                v-for="task in filteredTasks.filter(t => t.status === 'completed')" 
                :key="task.id" 
                class="col-12 col-md-6 col-lg-4"
              >
                <TaskCard 
                  :task="task" 
                  @click="$router.push(`/tasks/${task.id}`)"
                />
              </div>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTaskStore } from 'src/stores/tasks'
import TaskCard from 'src/components/TaskCard.vue'

const taskStore = useTaskStore()

// Reactive data
const activeTab = ref('all')
const searchQuery = ref('')
const priorityFilter = ref(null)
const sortBy = ref('dueDate')

// Filter and sort options
const priorityOptions = [
  { label: 'High Priority', value: 'high' },
  { label: 'Medium Priority', value: 'medium' },
  { label: 'Low Priority', value: 'low' }
]

const sortOptions = [
  { label: 'Due Date', value: 'dueDate' },
  { label: 'Priority', value: 'priority' },
  { label: 'Value', value: 'value' },
  { label: 'Created Date', value: 'createdAt' },
  { label: 'Updated Date', value: 'updatedAt' }
]

// Computed properties from store
const tasks = computed(() => taskStore.tasks)
const todoTasks = computed(() => taskStore.todoTasks)
const inProgressTasks = computed(() => taskStore.inProgressTasks)
const completedTasks = computed(() => taskStore.completedTasks)
const highPriorityTasks = computed(() => taskStore.highPriorityTasks)

const filteredTasks = computed(() => {
  let filtered = [...(tasks.value || [])]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(task => 
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query)
    )
  }

  // Apply priority filter
  if (priorityFilter.value) {
    filtered = filtered.filter(task => task.priority === priorityFilter.value)
  }

  // Apply sorting
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'dueDate':
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate) - new Date(b.dueDate)
      
      case 'priority':
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      
      case 'value':
        return b.value - a.value
      
      case 'createdAt':
        return new Date(b.createdAt) - new Date(a.createdAt)
      
      case 'updatedAt':
        return new Date(b.updatedAt) - new Date(a.updatedAt)
      
      default:
        return 0
    }
  })

  return filtered
})
</script>