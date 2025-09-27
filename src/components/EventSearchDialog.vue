<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    persistent
    maximized
  >
    <q-card class="column full-height">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none bg-secondary text-white">
        <div class="text-h6">Search for Events</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <!-- Search Form -->
      <q-card-section class="col scroll">
        <q-form @submit="searchEvents" class="q-gutter-md">
          <div class="row q-gutter-md">
            <!-- Topic/Interest -->
            <div class="col-md-6 col-sm-12">
              <q-input
                v-model="searchCriteria.topic"
                label="Topic or Interest"
                outlined
                placeholder="e.g., JavaScript, Art, Fitness, Music"
                hint="What kind of events are you looking for?"
              />
            </div>

            <!-- Location -->
            <div class="col-md-6 col-sm-12">
              <q-input
                v-model="searchCriteria.location"
                label="Location"
                outlined
                placeholder="e.g., San Francisco, 94102, Online"
                hint="City, zipcode, or 'Online' for virtual events"
              />
            </div>
          </div>

          <div class="row q-gutter-md">
            <!-- Distance -->
            <div class="col-md-6 col-sm-12">
              <q-input
                v-model.number="searchCriteria.distance"
                label="Maximum Distance (km)"
                outlined
                type="number"
                min="0"
                placeholder="25"
                hint="How far are you willing to travel?"
              />
            </div>

            <!-- Cost -->
            <div class="col-md-6 col-sm-12">
              <q-select
                v-model="searchCriteria.costRange"
                label="Cost Preference"
                outlined
                :options="costOptions"
                map-options
                emit-value
                clearable
              />
            </div>
          </div>

          <div class="row q-gutter-md">
            <!-- Event Format -->
            <div class="col-md-6 col-sm-12">
              <q-select
                v-model="searchCriteria.format"
                label="Event Format"
                outlined
                :options="formatOptions"
                map-options
                emit-value
                clearable
              />
            </div>

            <!-- Category -->
            <div class="col-md-6 col-sm-12">
              <q-select
                v-model="searchCriteria.category"
                label="Category"
                outlined
                :options="categoryOptions"
                clearable
              />
            </div>
          </div>

          <!-- Date Range -->
          <div class="text-subtitle1 q-mt-md q-mb-sm">Date Range</div>
          <div class="row q-gutter-md">
            <div class="col-md-6 col-sm-12">
              <q-input
                v-model="searchCriteria.startDate"
                label="From Date"
                outlined
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="searchCriteria.startDate" mask="YYYY-MM-DD">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <div class="col-md-6 col-sm-12">
              <q-input
                v-model="searchCriteria.endDate"
                label="To Date"
                outlined
              >
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="searchCriteria.endDate" mask="YYYY-MM-DD">
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="Close" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>

          <!-- Event Type -->
          <div class="row q-gutter-md">
            <div class="col-12">
              <q-select
                v-model="searchCriteria.eventType"
                label="Event Type"
                outlined
                :options="eventTypeOptions"
                map-options
                emit-value
                clearable
              />
            </div>
          </div>
        </q-form>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="q-pa-md">
        <q-btn
          label="Cancel" 
          color="grey"
          flat
          @click="close"
        />
        <q-btn
          label="Search Events"
          color="secondary"
          icon="search"
          @click="searchEvents"
          :loading="searching"
          :disable="!canSearch"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue', 'search'])

const $q = useQuasar()

// Reactive data
const searching = ref(false)
const searchCriteria = ref({
  topic: '',
  location: '',
  distance: null,
  costRange: null,
  format: null,
  category: '',
  startDate: '',
  endDate: '',
  eventType: null
})

// Options
const costOptions = [
  { label: 'Free events only', value: 'free' },
  { label: 'Up to $25', value: 25 },
  { label: 'Up to $50', value: 50 },
  { label: 'Up to $100', value: 100 },
  { label: 'Any cost', value: null }
]

const formatOptions = [
  { label: 'In-person only', value: 'in-person' },
  { label: 'Online only', value: 'online' },
  { label: 'Both formats', value: null }
]

const categoryOptions = [
  'Technology',
  'Arts & Culture',
  'Business & Professional',
  'Sports & Fitness',
  'Music & Entertainment',
  'Education & Learning',
  'Food & Drink',
  'Health & Wellness',
  'Travel & Adventure',
  'Family & Kids',
  'Community & Social',
  'Science & Environment'
]

const eventTypeOptions = [
  { label: 'Single events only', value: 'single' },
  { label: 'Recurring events only', value: 'recurring' },
  { label: 'Both types', value: null }
]

// Computed
const canSearch = computed(() => {
  return searchCriteria.value.topic.trim() || 
         searchCriteria.value.category ||
         searchCriteria.value.location.trim()
})

// Methods
const searchEvents = async () => {
  if (!canSearch.value) {
    $q.notify({
      type: 'warning',
      message: 'Please provide at least a topic, category, or location to search',
      position: 'top'
    })
    return
  }

  searching.value = true
  try {
    // Convert form data to search criteria
    const criteria = {
      topic: searchCriteria.value.topic.trim(),
      location: searchCriteria.value.location.trim(),
      distance: searchCriteria.value.distance,
      cost: searchCriteria.value.costRange === 'free' ? 0 : searchCriteria.value.costRange,
      isOnline: searchCriteria.value.format === 'online' ? true : 
                searchCriteria.value.format === 'in-person' ? false : null,
      category: searchCriteria.value.category,
      dateRange: {
        start: searchCriteria.value.startDate,
        end: searchCriteria.value.endDate
      },
      isRecurring: searchCriteria.value.eventType === 'recurring' ? true :
                   searchCriteria.value.eventType === 'single' ? false : null
    }

    emit('search', criteria)
  } catch (error) {
    console.error('Error preparing search criteria:', error)
    $q.notify({
      type: 'negative',
      message: 'Error preparing search criteria',
      position: 'top'
    })
  } finally {
    searching.value = false
  }
}

const close = () => {
  emit('update:modelValue', false)
}

const resetForm = () => {
  const today = new Date().toISOString().split('T')[0]
  searchCriteria.value = {
    topic: '',
    location: '',
    distance: null,
    costRange: null,
    format: null,
    category: '',
    startDate: today,
    endDate: '',
    eventType: null
  }
}

// Initialize form with today's date
resetForm()
</script>

<style lang="scss" scoped>
.q-card {
  border-radius: 8px;
}
</style>