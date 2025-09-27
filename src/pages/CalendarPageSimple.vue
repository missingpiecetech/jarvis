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

    <!-- AI Event Suggestions -->
    <div class="q-mt-lg">
      <ProposedEventsSection
        :proposed-events="proposedEvents"
        :loading="searchingEvents"
        :loading-more="loadingMoreEvents"
        :has-more="hasMoreProposedEvents"
        @search="showEventSearch = true"
        @accept="acceptProposedEvent"
        @decline="declineProposedEvent"
        @load-more="loadMoreProposedEvents"
      />
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

    <!-- Event Search Dialog -->
    <EventSearchDialog
      v-model="showEventSearch"
      @search="searchForEvents"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import EventFormDialog from 'src/components/EventFormDialog.vue'
import EventDetailDialog from 'src/components/EventDetailDialog.vue'
import ProposedEventsSection from 'src/components/ProposedEventsSection.vue'
import EventSearchDialog from 'src/components/EventSearchDialog.vue'
import { eventService } from 'src/services/EventService'
import { aiEventSearchService } from 'src/services/AIEventSearchService'
import { Event } from 'src/models'

const $q = useQuasar()

// Reactive data
const loading = ref(false)
const events = ref([])
const selectedEvent = ref(null)
const showEventForm = ref(false)
const showEventDetail = ref(false)
const isEditing = ref(false)

// Proposed events data
const proposedEvents = ref([])
const searchingEvents = ref(false)
const loadingMoreEvents = ref(false)
const hasMoreProposedEvents = ref(false)
const showEventSearch = ref(false)

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

// Proposed Events Methods
const loadProposedEvents = async () => {
  try {
    const result = await aiEventSearchService.getAll({ status: 'pending' })
    if (result.success) {
      proposedEvents.value = result.data
    }
  } catch (error) {
    console.error('Error loading proposed events:', error)
  }
}

const searchForEvents = async (criteria) => {
  searchingEvents.value = true
  try {
    const result = await aiEventSearchService.searchEvents(criteria)
    
    if (result.success) {
      await loadProposedEvents() // Refresh the list
      $q.notify({
        type: 'positive',
        message: `Found ${result.total} event suggestions${result.filtered > 0 ? ` (${result.filtered} duplicates filtered)` : ''}`,
        position: 'top'
      })
      showEventSearch.value = false
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to search events: ' + result.error,
        position: 'top'
      })
    }
  } catch (error) {
    console.error('Error searching events:', error)
    $q.notify({
      type: 'negative',
      message: 'Error searching for events',
      position: 'top'
    })
  } finally {
    searchingEvents.value = false
  }
}

const acceptProposedEvent = async (proposedEvent, addRecurring = true) => {
  try {
    const result = await aiEventSearchService.acceptEvent(proposedEvent.id, addRecurring)
    
    if (result.success) {
      // Add the event to the regular calendar
      const saveResult = await eventService.create(result.data)
      
      if (saveResult.success) {
        await Promise.all([
          loadEvents(),
          loadProposedEvents()
        ])
        
        const message = result.isRecurring && addRecurring 
          ? 'Recurring event added to your calendar'
          : 'Event added to your calendar'
          
        $q.notify({
          type: 'positive',
          message,
          position: 'top'
        })
      } else {
        $q.notify({
          type: 'negative',
          message: 'Failed to add event to calendar: ' + saveResult.error,
          position: 'top'
        })
      }
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to accept event: ' + result.error,
        position: 'top'
      })
    }
  } catch (error) {
    console.error('Error accepting proposed event:', error)
    $q.notify({
      type: 'negative',
      message: 'Error accepting event',
      position: 'top'
    })
  }
}

const declineProposedEvent = async (proposedEvent) => {
  try {
    const result = await aiEventSearchService.declineEvent(proposedEvent.id)
    
    if (result.success) {
      await loadProposedEvents()
      $q.notify({
        type: 'info',
        message: 'Event declined and archived',
        position: 'top'
      })
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to decline event: ' + result.error,
        position: 'top'
      })
    }
  } catch (error) {
    console.error('Error declining proposed event:', error)
    $q.notify({
      type: 'negative',
      message: 'Error declining event',
      position: 'top'
    })
  }
}

const loadMoreProposedEvents = async () => {
  // For now, this is a placeholder
  // In a real implementation, you would load more events with pagination
  $q.notify({
    type: 'info',
    message: 'Load more functionality would be implemented here',
    position: 'top'
  })
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
  loadProposedEvents()
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