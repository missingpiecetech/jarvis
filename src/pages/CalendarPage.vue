<template>
  <q-page class="q-pa-md">
    <!-- Header -->
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-h4">Calendar</div>
        <div class="text-subtitle1 text-grey-6">Manage your events and schedule</div>
      </div>
      <div class="col-auto">
        <q-btn
          color="primary"
          icon="add"
          label="New Event"
          @click="showEventForm = true"
          unelevated
        />
      </div>
    </div>

    <!-- Calendar Loading -->
    <q-inner-loading :showing="loading">
      <q-spinner-gears size="50px" color="primary" />
    </q-inner-loading>

    <!-- Calendar Component -->
    <div class="calendar-container">
      <VueCal
        :events="calendarEvents"
        :time-from="8 * 60"
        :time-to="22 * 60"
        :disable-views="['years']"
        :selected-date="selectedDate"
        default-view="month"
        :editable-events="true"
        @event-click="onEventClick"
        @event-create="onEventCreate"
        @event-change="onEventChange"
        @event-delete="onEventDelete"
        @view-change="onViewChange"
        class="vuecal-theme"
        style="height: 600px"
      >
        <template #event="{ event, view }">
          <div class="event-content">
            <div class="event-title">{{ event.title }}</div>
            <div v-if="event.location && view.id !== 'month'" class="event-location text-caption">
              <q-icon name="place" size="12px" /> {{ event.location }}
            </div>
          </div>
        </template>
      </VueCal>
    </div>

    <!-- Event Form Dialog -->
    <EventFormDialog
      v-model="showEventForm"
      :event="selectedEvent"
      :is-editing="isEditing"
      @save="onEventSave"
    />

    <!-- Event Detail Dialog -->
    <EventDetailDialog
      v-model="showEventDetail"
      :event="selectedEvent"
      @edit="onEventEdit"
      @delete="onEventDeleteConfirm"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import EventFormDialog from 'src/components/EventFormDialog.vue'
import EventDetailDialog from 'src/components/EventDetailDialog.vue'
import { eventService } from 'src/services/EventService'
import { Event } from 'src/models'

const $q = useQuasar()

// Reactive data
const loading = ref(false)
const events = ref([])
const selectedDate = ref(new Date())
const showEventForm = ref(false)
const showEventDetail = ref(false)
const selectedEvent = ref(null)
const isEditing = ref(false)

// Computed properties
const calendarEvents = computed(() => {
  return events.value.map(event => ({
    id: event.id,
    title: event.title,
    start: event.startDate,
    end: event.endDate,
    content: event.description,
    class: `event-${event.status}`,
    background: event.color,
    location: event.location,
    allDay: event.isAllDay,
    provider: event.provider,
    _originalEvent: event
  }))
})

// Methods
const loadEvents = async () => {
  loading.value = true
  try {
    const result = await eventService.getAll()
    if (result.success) {
      events.value = result.data
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to load events: ' + result.error,
        position: 'top'
      })
    }
  } catch (error) {
    console.error('Error loading events:', error)
    $q.notify({
      type: 'negative',
      message: 'Error loading events',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

const onEventClick = (event) => {
  selectedEvent.value = event._originalEvent
  showEventDetail.value = true
}

const onEventCreate = (event) => {
  // Create a new event from calendar click
  const newEvent = new Event({
    title: 'New Event',
    startDate: event.start,
    endDate: event.end || new Date(event.start.getTime() + 60 * 60 * 1000), // 1 hour default
    isAllDay: event.allDay || false
  })
  selectedEvent.value = newEvent
  isEditing.value = false
  showEventForm.value = true
}

const onEventChange = async (event) => {
  // Handle drag and drop changes
  const originalEvent = event._originalEvent
  if (originalEvent) {
    const updates = {
      startDate: event.start,
      endDate: event.end,
      isAllDay: event.allDay
    }
    
    const result = await eventService.update(originalEvent.id, updates)
    if (result.success) {
      await loadEvents()
      $q.notify({
        type: 'positive',
        message: 'Event updated successfully',
        position: 'top'
      })
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to update event: ' + result.error,
        position: 'top'
      })
      await loadEvents() // Reload to revert changes
    }
  }
}

const onEventDelete = async (event) => {
  const originalEvent = event._originalEvent
  if (originalEvent) {
    $q.dialog({
      title: 'Delete Event',
      message: `Are you sure you want to delete "${originalEvent.title}"?`,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      const result = await eventService.delete(originalEvent.id)
      if (result.success) {
        await loadEvents()
        $q.notify({
          type: 'positive',
          message: 'Event deleted successfully',
          position: 'top'
        })
      } else {
        $q.notify({
          type: 'negative',
          message: 'Failed to delete event: ' + result.error,
          position: 'top'
        })
      }
    })
  }
}

const onViewChange = (view) => {
  // Handle view changes if needed
  console.log('View changed to:', view)
}

const onEventSave = async (eventData) => {
  loading.value = true
  try {
    let result
    if (isEditing.value && selectedEvent.value?.id) {
      result = await eventService.update(selectedEvent.value.id, eventData)
    } else {
      result = await eventService.create(eventData)
    }

    if (result.success) {
      await loadEvents()
      showEventForm.value = false
      selectedEvent.value = null
      $q.notify({
        type: 'positive',
        message: isEditing.value ? 'Event updated successfully' : 'Event created successfully',
        position: 'top'
      })
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to save event: ' + result.error,
        position: 'top'
      })
    }
  } catch (error) {
    console.error('Error saving event:', error)
    $q.notify({
      type: 'negative',
      message: 'Error saving event',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

const onEventEdit = () => {
  isEditing.value = true
  showEventDetail.value = false
  showEventForm.value = true
}

const onEventDeleteConfirm = async () => {
  if (selectedEvent.value?.id) {
    const result = await eventService.delete(selectedEvent.value.id)
    if (result.success) {
      await loadEvents()
      showEventDetail.value = false
      selectedEvent.value = null
      $q.notify({
        type: 'positive',
        message: 'Event deleted successfully',
        position: 'top'
      })
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to delete event: ' + result.error,
        position: 'top'
      })
    }
  }
}

// Watch for dialog closes to reset state
watch(showEventForm, (newVal) => {
  if (!newVal) {
    selectedEvent.value = null
    isEditing.value = false
  }
})

watch(showEventDetail, (newVal) => {
  if (!newVal) {
    selectedEvent.value = null
  }
})

// Lifecycle
onMounted(() => {
  loadEvents()
})
</script>

<style lang="scss" scoped>
.calendar-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:deep(.vuecal__event) {
  border-radius: 4px;
  border-left: 3px solid;
  
  &.event-confirmed {
    border-left-color: #1976d2;
  }
  
  &.event-tentative {
    border-left-color: #ff9800;
    opacity: 0.8;
  }
  
  &.event-cancelled {
    border-left-color: #f44336;
    opacity: 0.6;
    text-decoration: line-through;
  }
}

.event-content {
  .event-title {
    font-weight: 500;
    margin-bottom: 2px;
  }
  
  .event-location {
    display: flex;
    align-items: center;
    gap: 2px;
    color: rgba(0, 0, 0, 0.6);
  }
}

:deep(.vuecal__title-bar) {
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

:deep(.vuecal__weekdays-headings) {
  background: #fafafa;
}

:deep(.vuecal__today) {
  background-color: rgba(25, 118, 210, 0.1);
  
  .vuecal__cell-date {
    background: #1976d2;
    color: white;
    border-radius: 50%;
  }
}
</style>