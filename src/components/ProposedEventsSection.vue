<template>
  <q-card class="proposed-events-section">
    <q-card-section>
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-h6">🤖 AI Event Suggestions</div>
          <div class="text-body2 text-grey-6">
            Personalized event recommendations based on your interests
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            color="secondary"
            icon="search"
            label="Find Events"
            @click="$emit('search')"
            unelevated
            :loading="loading"
          />
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center q-pa-lg">
        <q-spinner-dots size="40px" color="secondary" />
        <div class="text-body2 q-mt-md">Searching for events...</div>
      </div>

      <!-- No Events State -->
      <div v-else-if="proposedEvents.length === 0" class="text-center q-pa-lg">
        <q-icon name="event_available" size="64px" color="grey-4" />
        <div class="text-h6 q-mt-md text-grey-6">No event suggestions yet</div>
        <div class="text-body2 text-grey-6 q-mb-md">
          Click "Find Events" to discover events tailored to your interests
        </div>
      </div>

      <!-- Proposed Events List -->
      <div v-else>
        <q-list>
          <q-item
            v-for="event in proposedEvents"
            :key="event.id"
            class="proposed-event-item"
            clickable
            @click="viewEventDetails(event)"
          >
            <q-item-section avatar>
              <q-avatar 
                :color="getEventCategoryColor(event.category)"
                text-color="white"
                :icon="getEventCategoryIcon(event.category)"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label class="text-weight-medium">{{ event.title }}</q-item-label>
              <q-item-label caption>{{ event.getDateRangeString() }}</q-item-label>
              <q-item-label caption v-if="event.location">
                <q-icon name="place" size="12px" /> {{ event.location }}
                <span v-if="event.getDistanceString()" class="q-ml-sm">
                  ({{ event.getDistanceString() }})
                </span>
              </q-item-label>
              <q-item-label caption class="row items-center q-mt-xs">
                <q-chip
                  :color="event.isOnline ? 'blue-grey' : 'green'"
                  text-color="white"
                  size="sm"
                  :label="event.isOnline ? 'Online' : 'In-person'"
                  class="q-mr-xs"
                />
                <q-chip
                  color="amber"
                  text-color="black"
                  size="sm"
                  :label="event.getCostString()"
                  class="q-mr-xs"
                />
                <q-chip
                  v-if="event.isRecurring"
                  color="purple"
                  text-color="white"
                  size="sm"
                  label="Recurring"
                  class="q-mr-xs"
                />
                <q-chip
                  color="grey-6"
                  text-color="white"
                  size="sm"
                  :label="event.category"
                />
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn
                  icon="close"
                  size="sm"
                  flat
                  round
                  color="negative"
                  @click.stop="declineEvent(event)"
                  :loading="declining === event.id"
                >
                  <q-tooltip>Decline</q-tooltip>
                </q-btn>
                <q-btn
                  icon="add_circle"
                  size="sm"
                  flat
                  round
                  color="positive"
                  @click.stop="acceptEvent(event)"
                  :loading="accepting === event.id"
                >
                  <q-tooltip>Add to Calendar</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Show More Button -->
        <div v-if="hasMore" class="text-center q-pt-md">
          <q-btn
            label="Show More Suggestions"
            color="secondary"
            flat
            @click="$emit('load-more')"
            :loading="loadingMore"
          />
        </div>
      </div>
    </q-card-section>

    <!-- Event Details Dialog -->
    <q-dialog v-model="showEventDetails" persistent>
      <q-card style="min-width: 400px; max-width: 600px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Event Details</div>
          <q-space />
          <q-btn icon="close" flat round dense @click="showEventDetails = false" />
        </q-card-section>

        <q-card-section v-if="selectedEvent">
          <div class="text-h5 q-mb-md">{{ selectedEvent.title }}</div>
          
          <div class="row q-gutter-md q-mb-md">
            <div class="col-12">
              <q-item class="q-pa-none">
                <q-item-section avatar>
                  <q-icon name="schedule" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ selectedEvent.getDateRangeString() }}</q-item-label>
                  <q-item-label caption v-if="selectedEvent.isRecurring">
                    Recurring event
                  </q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </div>

          <div v-if="selectedEvent.location" class="row q-gutter-md q-mb-md">
            <div class="col-12">
              <q-item class="q-pa-none">
                <q-item-section avatar>
                  <q-icon name="place" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ selectedEvent.location }}</q-item-label>
                  <q-item-label caption v-if="selectedEvent.getDistanceString()">
                    {{ selectedEvent.getDistanceString() }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </div>

          <div v-if="selectedEvent.description" class="row q-gutter-md q-mb-md">
            <div class="col-12">
              <q-item class="q-pa-none">
                <q-item-section avatar>
                  <q-icon name="description" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-body1">{{ selectedEvent.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </div>

          <div class="row q-gutter-md q-mb-md">
            <div class="col-12">
              <q-item class="q-pa-none">
                <q-item-section avatar>
                  <q-icon name="attach_money" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ selectedEvent.getCostString() }}</q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </div>

          <div v-if="selectedEvent.organizer" class="row q-gutter-md q-mb-md">
            <div class="col-12">
              <q-item class="q-pa-none">
                <q-item-section avatar>
                  <q-icon name="group" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ selectedEvent.organizer }}</q-item-label>
                  <q-item-label caption>Organizer</q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </div>

          <div v-if="selectedEvent.url" class="row q-gutter-md q-mb-md">
            <div class="col-12">
              <q-item class="q-pa-none">
                <q-item-section avatar>
                  <q-icon name="link" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    <a :href="selectedEvent.url" target="_blank" class="text-primary">
                      View Event Details
                    </a>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            label="Decline"
            color="negative"
            flat
            @click="declineEventFromDialog"
            :loading="declining === selectedEvent?.id"
          />
          <q-btn
            v-if="selectedEvent?.isRecurring"
            label="Add Once"
            color="positive"
            @click="acceptSingleEventFromDialog"
            :loading="accepting === selectedEvent?.id"
          />
          <q-btn
            :label="selectedEvent?.isRecurring ? 'Add Recurring' : 'Add to Calendar'"
            color="positive"
            @click="acceptEventFromDialog"
            :loading="accepting === selectedEvent?.id"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  proposedEvents: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  loadingMore: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['search', 'accept', 'decline', 'load-more'])

const $q = useQuasar()

// Reactive data
const showEventDetails = ref(false)
const selectedEvent = ref(null)
const accepting = ref(null)
const declining = ref(null)

// Methods
const viewEventDetails = (event) => {
  selectedEvent.value = event
  showEventDetails.value = true
}

const acceptEvent = async (event, addRecurring = true) => {
  accepting.value = event.id
  try {
    await emit('accept', event, addRecurring)
  } finally {
    accepting.value = null
  }
}

const acceptEventFromDialog = async () => {
  if (selectedEvent.value) {
    await acceptEvent(selectedEvent.value, true)
    showEventDetails.value = false
  }
}

const acceptSingleEventFromDialog = async () => {
  if (selectedEvent.value) {
    await acceptEvent(selectedEvent.value, false)
    showEventDetails.value = false
  }
}

const declineEvent = async (event) => {
  declining.value = event.id
  try {
    await emit('decline', event)
  } finally {
    declining.value = null
  }
}

const declineEventFromDialog = async () => {
  if (selectedEvent.value) {
    await declineEvent(selectedEvent.value)
    showEventDetails.value = false
  }
}

const getEventCategoryColor = (category) => {
  const colors = {
    'Technology': 'blue',
    'Arts & Culture': 'purple',
    'Business & Professional': 'indigo',
    'Sports & Fitness': 'green',
    'Music & Entertainment': 'pink',
    'Education & Learning': 'teal',
    'Food & Drink': 'orange',
    'Health & Wellness': 'light-green',
    'Travel & Adventure': 'cyan',
    'Family & Kids': 'yellow',
    'Community & Social': 'deep-purple',
    'Science & Environment': 'lime'
  }
  return colors[category] || 'grey'
}

const getEventCategoryIcon = (category) => {
  const icons = {
    'Technology': 'computer',
    'Arts & Culture': 'palette',
    'Business & Professional': 'business',
    'Sports & Fitness': 'fitness_center',
    'Music & Entertainment': 'music_note',
    'Education & Learning': 'school',
    'Food & Drink': 'restaurant',
    'Health & Wellness': 'favorite',
    'Travel & Adventure': 'flight',
    'Family & Kids': 'family_restroom',
    'Community & Social': 'groups',
    'Science & Environment': 'science'
  }
  return icons[category] || 'event'
}
</script>

<style lang="scss" scoped>
.proposed-events-section {
  border-radius: 8px;
  border: 2px dashed #e0e0e0;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.proposed-event-item {
  border-radius: 8px;
  margin-bottom: 8px;
  background: white;
  border: 1px solid #e0e0e0;
  
  &:hover {
    background: #f5f5f5;
    border-color: #1976d2;
  }
}
</style>