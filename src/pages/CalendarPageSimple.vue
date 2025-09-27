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

    <!-- Simple Calendar View -->
    <div class="calendar-container">
      <q-card>
        <q-card-section>
          <div class="text-h6">Calendar View</div>
          <div class="text-body2">Vue-cal calendar component will be displayed here</div>
          
          <!-- Events List -->
          <div class="q-mt-md">
            <div class="text-subtitle1">Your Events:</div>
            <q-list v-if="events.length > 0">
              <q-item v-for="event in events" :key="event.id" clickable @click="viewEvent(event)">
                <q-item-section avatar>
                  <q-icon name="event" :color="getEventColor(event)" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ event.title }}</q-item-label>
                  <q-item-label caption>{{ event.getDateRangeString() }}</q-item-label>
                  <q-item-label caption v-if="event.location">{{ event.location }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn icon="edit" flat round @click.stop="editEvent(event)" />
                  <q-btn icon="delete" flat round color="negative" @click.stop="deleteEvent(event)" />
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-center q-pa-md text-grey-6">
              No events found. Create your first event!
            </div>
          </div>
        </q-card-section>
      </q-card>
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
import EventFormDialog from 'src/components/EventFormDialog.vue'
import EventDetailDialog from 'src/components/EventDetailDialog.vue'
import { eventService } from 'src/services/EventService'
import { Event } from 'src/models'

const $q = useQuasar()

// Reactive data
const loading = ref(false)
const events = ref([])
const selectedEvent = ref(null)
const showEventForm = ref(false)
const showEventDetail = ref(false)
const isEditing = ref(false)

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

const viewEvent = (event) => {
  selectedEvent.value = event
  showEventDetail.value = true
}

const editEvent = (event) => {
  selectedEvent.value = event
  isEditing.value = true
  showEventForm.value = true
}

const deleteEvent = (event) => {
  $q.dialog({
    title: 'Delete Event',
    message: `Are you sure you want to delete "${event.title}"?`,
    cancel: true,
    persistent: true,
    ok: {
      label: 'Delete',
      color: 'negative'
    }
  }).onOk(async () => {
    const result = await eventService.delete(event.id)
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

const getEventColor = (event) => {
  switch (event.status) {
    case 'confirmed':
      return 'primary'
    case 'tentative':
      return 'warning'
    case 'cancelled':
      return 'negative'
    default:
      return 'grey'
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
  .q-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}
</style>