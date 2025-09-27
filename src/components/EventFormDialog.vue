<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="column full-height">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none bg-primary text-white">
        <div class="text-h6">{{ isEditing ? 'Edit Event' : 'New Event' }}</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="cancel" />
      </q-card-section>

      <!-- Form Content -->
      <q-card-section class="col scroll">
        <q-form @submit="onSubmit" class="q-gutter-md">
          <!-- Event Title -->
          <q-input
            v-model="formData.title"
            label="Event Title *"
            outlined
            :rules="[val => !!val || 'Title is required']"
            autofocus
          />

          <!-- Date and Time -->
          <div class="row q-gutter-md">
            <div class="col-12">
              <q-toggle
                v-model="formData.isAllDay"
                label="All-day event"
                color="primary"
              />
            </div>
          </div>

          <div class="row q-gutter-md">
            <!-- Start Date -->
            <div class="col-md-6 col-sm-12">
              <q-input
                v-model="formData.startDateStr"
                label="Start Date *"
                outlined
                :rules="[val => !!val || 'Start date is required']"
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="formData.startDateStr" mask="YYYY-MM-DD">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <!-- Start Time -->
            <div v-if="!formData.isAllDay" class="col-md-6 col-sm-12">
              <q-input
                v-model="formData.startTimeStr"
                label="Start Time *"
                outlined
                :rules="[val => !!val || 'Start time is required']"
              >
                <template v-slot:append>
                  <q-icon name="access_time" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-time v-model="formData.startTimeStr" format24h>
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-time>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>

          <div class="row q-gutter-md">
            <!-- End Date -->
            <div class="col-md-6 col-sm-12">
              <q-input
                v-model="formData.endDateStr"
                label="End Date *"
                outlined
                :rules="[val => !!val || 'End date is required']"
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="formData.endDateStr" mask="YYYY-MM-DD">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <!-- End Time -->
            <div v-if="!formData.isAllDay" class="col-md-6 col-sm-12">
              <q-input
                v-model="formData.endTimeStr"
                label="End Time *"
                outlined
                :rules="[val => !!val || 'End time is required']"
              >
                <template v-slot:append>
                  <q-icon name="access_time" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-time v-model="formData.endTimeStr" format24h>
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-time>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>

          <!-- Description -->
          <q-input
            v-model="formData.description"
            label="Description"
            outlined
            type="textarea"
            rows="3"
          />

          <!-- Location -->
          <q-input
            v-model="formData.location"
            label="Location"
            outlined
          />

          <!-- Status and Visibility -->
          <div class="row q-gutter-md">
            <div class="col-md-6 col-sm-12">
              <q-select
                v-model="formData.status"
                label="Status"
                outlined
                :options="statusOptions"
                map-options
                emit-value
              />
            </div>
            <div class="col-md-6 col-sm-12">
              <q-select
                v-model="formData.visibility"
                label="Visibility"
                outlined
                :options="visibilityOptions"
                map-options
                emit-value
              />
            </div>
          </div>

          <!-- Color -->
          <div class="row q-gutter-md">
            <div class="col-md-6 col-sm-12">
              <q-input
                v-model="formData.color"
                label="Color"
                outlined
              >
                <template v-slot:append>
                  <q-icon name="palette" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="formData.color" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
                <template v-slot:prepend>
                  <div
                    class="color-preview"
                    :style="{ backgroundColor: formData.color }"
                  ></div>
                </template>
              </q-input>
            </div>
          </div>

          <!-- Recurrence -->
          <div class="text-h6 q-mt-lg q-mb-md">Recurrence</div>
          <div class="row q-gutter-md">
            <div class="col-12">
              <q-toggle
                v-model="formData.isRecurring"
                label="Recurring event"
                color="primary"
              />
            </div>
          </div>

          <div v-if="formData.isRecurring" class="q-mt-md">
            <div class="row q-gutter-md">
              <div class="col-md-6 col-sm-12">
                <q-select
                  v-model="formData.recurrenceType"
                  label="Repeat"
                  outlined
                  :options="recurrenceOptions"
                  map-options
                  emit-value
                />
              </div>
              <div class="col-md-6 col-sm-12">
                <q-input
                  v-model.number="formData.recurrenceInterval"
                  label="Every"
                  outlined
                  type="number"
                  min="1"
                  :suffix="getRecurrenceIntervalSuffix()"
                />
              </div>
            </div>

            <div class="row q-gutter-md q-mt-md" v-if="formData.recurrenceType === 'weekly'">
              <div class="col-12">
                <q-select
                  v-model="formData.recurrenceDays"
                  label="Repeat on"
                  outlined
                  multiple
                  :options="weekDayOptions"
                  use-chips
                />
              </div>
            </div>

            <div class="row q-gutter-md q-mt-md">
              <div class="col-md-6 col-sm-12">
                <q-select
                  v-model="formData.recurrenceEnd"
                  label="End"
                  outlined
                  :options="recurrenceEndOptions"
                  map-options
                  emit-value
                />
              </div>
              <div class="col-md-6 col-sm-12" v-if="formData.recurrenceEnd === 'on'">
                <q-input
                  v-model="formData.recurrenceEndDate"
                  label="End Date"
                  outlined
                >
                  <template v-slot:append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="formData.recurrenceEndDate" mask="YYYY-MM-DD">
                          <div class="row items-center justify-end">
                            <q-btn v-close-popup label="Close" color="primary" flat />
                          </div>
                        </q-date>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="col-md-6 col-sm-12" v-if="formData.recurrenceEnd === 'after'">
                <q-input
                  v-model.number="formData.recurrenceCount"
                  label="Number of occurrences"
                  outlined
                  type="number"
                  min="1"
                />
              </div>
            </div>
          </div>

          <!-- Reminders -->
          <div class="text-h6 q-mt-lg q-mb-md">Reminders</div>
          <div v-for="(reminder, index) in formData.reminders" :key="index" class="row q-gutter-md items-end q-mb-sm">
            <div class="col">
              <q-input
                v-model.number="reminder.minutes"
                label="Minutes before"
                outlined
                type="number"
                min="0"
              />
            </div>
            <div class="col-auto">
              <q-btn
                icon="remove"
                color="negative"
                flat
                round
                @click="removeReminder(index)"
              />
            </div>
          </div>
          <q-btn
            icon="add"
            label="Add Reminder"
            color="primary"
            flat
            @click="addReminder"
          />
        </q-form>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="q-pa-md">
        <q-btn
          label="Cancel"
          color="grey"
          flat
          @click="cancel"
        />
        <q-btn
          :label="isEditing ? 'Update' : 'Create'"
          color="primary"
          @click="onSubmit"
          :loading="loading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useQuasar } from 'quasar'
import { Event } from 'src/models'

const props = defineProps({
  modelValue: Boolean,
  event: Object,
  isEditing: Boolean
})

const emit = defineEmits(['update:modelValue', 'save'])

const $q = useQuasar()

// Reactive data
const loading = ref(false)
const formData = ref({
  title: '',
  description: '',
  startDateStr: '',
  startTimeStr: '09:00',
  endDateStr: '',
  endTimeStr: '10:00',
  isAllDay: false,
  location: '',
  status: 'confirmed',
  visibility: 'private',
  color: '#1976d2',
  reminders: [],
  isRecurring: false,
  recurrenceType: 'daily',
  recurrenceInterval: 1,
  recurrenceDays: [],
  recurrenceEnd: 'never',
  recurrenceEndDate: '',
  recurrenceCount: 10
})

// Options
const statusOptions = [
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Tentative', value: 'tentative' },
  { label: 'Cancelled', value: 'cancelled' }
]

const visibilityOptions = [
  { label: 'Private', value: 'private' },
  { label: 'Public', value: 'public' }
]

const recurrenceOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' }
]

const recurrenceEndOptions = [
  { label: 'Never', value: 'never' },
  { label: 'On date', value: 'on' },
  { label: 'After', value: 'after' }
]

const weekDayOptions = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

// Computed
const currentDate = computed(() => {
  const now = new Date()
  return now.toISOString().split('T')[0]
})

// Methods
const resetForm = () => {
  const now = new Date()
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
  
  formData.value = {
    title: '',
    description: '',
    startDateStr: currentDate.value,
    startTimeStr: now.toTimeString().slice(0, 5),
    endDateStr: currentDate.value,
    endTimeStr: oneHourLater.toTimeString().slice(0, 5),
    isAllDay: false,
    location: '',
    status: 'confirmed',
    visibility: 'private',
    color: '#1976d2',
    reminders: [],
    isRecurring: false,
    recurrenceType: 'daily',
    recurrenceInterval: 1,
    recurrenceDays: [],
    recurrenceEnd: 'never',
    recurrenceEndDate: '',
    recurrenceCount: 10
  }
}

const loadEventData = (event) => {
  if (!event) {
    resetForm()
    return
  }

  const recurrence = event.recurrence || {}
  
  formData.value = {
    title: event.title || '',
    description: event.description || '',
    startDateStr: event.startDate ? event.startDate.toISOString().split('T')[0] : currentDate.value,
    startTimeStr: event.startDate ? event.startDate.toTimeString().slice(0, 5) : '09:00',
    endDateStr: event.endDate ? event.endDate.toISOString().split('T')[0] : currentDate.value,
    endTimeStr: event.endDate ? event.endDate.toTimeString().slice(0, 5) : '10:00',
    isAllDay: event.isAllDay || false,
    location: event.location || '',
    status: event.status || 'confirmed',
    visibility: event.visibility || 'private',
    color: event.color || '#1976d2',
    reminders: [...(event.reminders || [])],
    isRecurring: !!recurrence.type,
    recurrenceType: recurrence.type || 'daily',
    recurrenceInterval: recurrence.interval || 1,
    recurrenceDays: recurrence.days || [],
    recurrenceEnd: recurrence.end?.type || 'never',
    recurrenceEndDate: recurrence.end?.date || '',
    recurrenceCount: recurrence.end?.count || 10
  }
}

const addReminder = () => {
  formData.value.reminders.push({ minutes: 15 })
}

const removeReminder = (index) => {
  formData.value.reminders.splice(index, 1)
}

const getRecurrenceIntervalSuffix = () => {
  const type = formData.value.recurrenceType
  const interval = formData.value.recurrenceInterval
  
  if (interval === 1) {
    return type.slice(0, -2) // Remove 'ly' (daily -> day, weekly -> week, etc.)
  } else {
    switch (type) {
      case 'daily': return 'days'
      case 'weekly': return 'weeks'
      case 'monthly': return 'months'
      case 'yearly': return 'years'
      default: return ''
    }
  }
}

const validateForm = () => {
  if (!formData.value.title?.trim()) {
    $q.notify({
      type: 'negative',
      message: 'Event title is required',
      position: 'top'
    })
    return false
  }

  if (!formData.value.startDateStr) {
    $q.notify({
      type: 'negative',
      message: 'Start date is required',
      position: 'top'
    })
    return false
  }

  if (!formData.value.endDateStr) {
    $q.notify({
      type: 'negative',
      message: 'End date is required',
      position: 'top'
    })
    return false
  }

  if (!formData.value.isAllDay && (!formData.value.startTimeStr || !formData.value.endTimeStr)) {
    $q.notify({
      type: 'negative',
      message: 'Start and end times are required',
      position: 'top'
    })
    return false
  }

  // Validate date/time logic
  const startDateTime = new Date(`${formData.value.startDateStr}T${formData.value.startTimeStr || '00:00'}`)
  const endDateTime = new Date(`${formData.value.endDateStr}T${formData.value.endTimeStr || '23:59'}`)

  if (startDateTime >= endDateTime) {
    $q.notify({
      type: 'negative',
      message: 'End date/time must be after start date/time',
      position: 'top'
    })
    return false
  }

  return true
}

const onSubmit = async () => {
  if (!validateForm()) return

  loading.value = true
  try {
    // Prepare event data
    const startDateTime = formData.value.isAllDay 
      ? new Date(`${formData.value.startDateStr}T00:00:00`)
      : new Date(`${formData.value.startDateStr}T${formData.value.startTimeStr}`)
    
    const endDateTime = formData.value.isAllDay 
      ? new Date(`${formData.value.endDateStr}T23:59:59`)
      : new Date(`${formData.value.endDateStr}T${formData.value.endTimeStr}`)

    const eventData = {
      title: formData.value.title,
      description: formData.value.description,
      startDate: startDateTime,
      endDate: endDateTime,
      isAllDay: formData.value.isAllDay,
      location: formData.value.location,
      status: formData.value.status,
      visibility: formData.value.visibility,
      color: formData.value.color,
      reminders: formData.value.reminders,
      recurrence: formData.value.isRecurring ? {
        type: formData.value.recurrenceType,
        interval: formData.value.recurrenceInterval,
        days: formData.value.recurrenceType === 'weekly' ? formData.value.recurrenceDays : [],
        end: formData.value.recurrenceEnd === 'never' ? null : {
          type: formData.value.recurrenceEnd,
          date: formData.value.recurrenceEnd === 'on' ? formData.value.recurrenceEndDate : null,
          count: formData.value.recurrenceEnd === 'after' ? formData.value.recurrenceCount : null
        }
      } : null
    }

    emit('save', eventData)
  } catch (error) {
    console.error('Error preparing event data:', error)
    $q.notify({
      type: 'negative',
      message: 'Error preparing event data',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

const cancel = () => {
  emit('update:modelValue', false)
}

// Watchers
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    loadEventData(props.event)
  }
})

watch(() => props.event, loadEventData)

// Auto-set end date when start date changes
watch(() => formData.value.startDateStr, (newDate) => {
  if (newDate && !formData.value.endDateStr) {
    formData.value.endDateStr = newDate
  }
})

// Auto-adjust end time when start time changes for same-day events
watch(() => formData.value.startTimeStr, (newTime) => {
  if (newTime && formData.value.startDateStr === formData.value.endDateStr) {
    const [hours, minutes] = newTime.split(':').map(Number)
    const endDate = new Date()
    endDate.setHours(hours + 1, minutes)
    formData.value.endTimeStr = endDate.toTimeString().slice(0, 5)
  }
})
</script>

<style lang="scss" scoped>
.color-preview {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #ccc;
}
</style>