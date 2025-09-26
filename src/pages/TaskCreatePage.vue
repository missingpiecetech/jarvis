<template>
  <q-page class="q-pa-lg">
    <!-- Header -->
    <div class="row items-center q-mb-xl">
      <div class="col">
        <q-btn 
          flat 
          icon="arrow_back" 
          label="Back to Tasks"
          @click="$router.push('/tasks')"
          class="q-mb-md"
        />
        <h4 class="text-h4 q-my-none">Create New Task</h4>
        <p class="text-subtitle1 text-grey-6 q-my-none">
          Add a new task to your list and break it down into manageable steps
        </p>
      </div>
    </div>

    <div class="row justify-center">
      <div class="col-12 col-md-8 col-lg-6">
        <q-form @submit="createTask" class="q-gutter-md">
          <q-card>
            <q-card-section>
              <div class="text-h6 q-mb-md">Task Details</div>

              <!-- Title -->
              <q-input
                v-model="form.title"
                label="Task Title *"
                outlined
                :rules="[val => !!val || 'Title is required']"
                lazy-rules
              />

              <!-- Description -->
              <q-input
                v-model="form.description"
                label="Description"
                type="textarea"
                outlined
                rows="4"
                hint="Provide a detailed description of the task"
              />

              <!-- Priority and Value Row -->
              <div class="row q-gutter-md">
                <div class="col">
                  <q-select
                    v-model="form.priority"
                    label="Priority *"
                    :options="priorityOptions"
                    outlined
                    emit-value
                    map-options
                    :rules="[val => !!val || 'Priority is required']"
                    lazy-rules
                  >
                    <template v-slot:option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section avatar>
                          <q-icon 
                            :name="getPriorityIcon(scope.opt.value)" 
                            :color="getPriorityColor(scope.opt.value)"
                          />
                        </q-item-section>
                        <q-item-section>
                          <q-item-label>{{ scope.opt.label }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                    <template v-slot:selected-item="scope">
                      <q-chip 
                        :color="getPriorityColor(scope.opt.value)"
                        text-color="white"
                        :icon="getPriorityIcon(scope.opt.value)"
                        :label="scope.opt.label"
                        removable
                        @remove="scope.removeAtIndex(scope.index)"
                      />
                    </template>
                  </q-select>
                </div>
                <div class="col">
                  <q-input
                    v-model.number="form.value"
                    label="Value (0-100)"
                    type="number"
                    outlined
                    min="0"
                    max="100"
                    hint="How valuable is this task to you?"
                    :rules="[
                      val => val >= 0 || 'Value must be at least 0',
                      val => val <= 100 || 'Value must be at most 100'
                    ]"
                    lazy-rules
                  >
                    <template v-slot:prepend>
                      <q-icon name="star" color="amber" />
                    </template>
                  </q-input>
                </div>
              </div>

              <!-- Due Date -->
              <q-input
                v-model="form.dueDate"
                label="Due Date"
                type="date"
                outlined
                hint="When should this task be completed?"
              >
                <template v-slot:prepend>
                  <q-icon name="schedule" />
                </template>
              </q-input>
            </q-card-section>
          </q-card>

          <!-- Subtasks Section -->
          <q-card>
            <q-card-section>
              <div class="row items-center justify-between q-mb-md">
                <div class="text-h6">Subtasks</div>
                <q-btn 
                  color="primary" 
                  icon="add" 
                  label="Add Subtask"
                  size="sm"
                  @click="addSubtask"
                  outline
                />
              </div>

              <div v-if="form.subtasks.length === 0" class="text-center q-py-lg">
                <q-icon name="checklist" size="48px" color="grey-4" />
                <div class="text-body1 text-grey-6 q-mt-md">No subtasks added yet</div>
                <div class="text-body2 text-grey-5">Break your task into smaller, manageable steps</div>
              </div>

              <div v-else class="q-gutter-md">
                <q-card 
                  v-for="(subtask, index) in form.subtasks" 
                  :key="index"
                  flat
                  bordered
                  class="subtask-card"
                >
                  <q-card-section class="row items-center q-gutter-md">
                    <div class="col">
                      <q-input
                        v-model="subtask.title"
                        placeholder="Subtask title"
                        outlined
                        dense
                        :rules="[val => !!val || 'Subtask title is required']"
                        lazy-rules
                      />
                    </div>
                    <div class="col-auto">
                      <q-btn 
                        flat 
                        round 
                        icon="delete" 
                        size="sm"
                        color="negative"
                        @click="removeSubtask(index)"
                      />
                    </div>
                  </q-card-section>
                </q-card>
              </div>
              
              <div v-if="form.subtasks.length > 0" class="text-body2 text-grey-6 q-mt-md">
                {{ form.subtasks.length }} subtask{{ form.subtasks.length !== 1 ? 's' : '' }} added
              </div>
            </q-card-section>
          </q-card>

          <!-- Action Buttons -->
          <div class="row justify-end q-gutter-md q-mt-lg">
            <q-btn 
              flat 
              label="Cancel" 
              @click="$router.push('/tasks')"
              color="grey"
            />
            <q-btn 
              type="submit" 
              label="Create Task" 
              color="primary"
              icon="add_task"
              :loading="creating"
              unelevated
            />
          </div>
        </q-form>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useTaskStore } from 'src/stores/tasks'

const router = useRouter()
const $q = useQuasar()
const taskStore = useTaskStore()

// Reactive data
const creating = ref(false)
const form = ref({
  title: '',
  description: '',
  priority: 'medium',
  value: 50,
  dueDate: '',
  subtasks: []
})

// Options
const priorityOptions = [
  { label: 'High Priority', value: 'high' },
  { label: 'Medium Priority', value: 'medium' },
  { label: 'Low Priority', value: 'low' }
]

// Methods
const addSubtask = () => {
  form.value.subtasks.push({
    title: '',
    status: 'todo'
  })
}

const removeSubtask = (index) => {
  form.value.subtasks.splice(index, 1)
}

const createTask = async () => {
  creating.value = true
  
  try {
    // Filter out empty subtasks
    const validSubtasks = form.value.subtasks.filter(subtask => subtask.title.trim())
    
    const taskData = {
      ...form.value,
      subtasks: validSubtasks
    }
    
    const newTask = taskStore.addTask(taskData)
    
    $q.notify({
      type: 'positive',
      message: 'Task created successfully!',
      position: 'top'
    })
    
    // Navigate to the new task detail page
    router.push(`/tasks/${newTask.id}`)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to create task. Please try again.',
      position: 'top'
    })
  } finally {
    creating.value = false
  }
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
</script>

<style scoped>
.subtask-card {
  transition: all 0.2s ease;
}

.subtask-card:hover {
  background-color: #f5f5f5;
}
</style>