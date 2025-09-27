<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    persistent
  >
    <q-card style="min-width: 400px; max-width: 600px">
      <!-- Header -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Event Details</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="close" />
      </q-card-section>

      <q-card-section v-if="event">
        <!-- Event Title -->
        <div class="text-h5 q-mb-md">{{ event.title }}</div>

        <!-- Event Status Badge -->
        <q-badge
          :color="getStatusColor(event.status)"
          :label="event.status"
          class="q-mb-md text-capitalize"
        />

        <!-- Date and Time -->
        <div class="row q-gutter-md q-mb-md">
          <div class="col-12">
            <q-item class="q-pa-none">
              <q-item-section avatar>
                <q-icon name="schedule" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ event.getDateRangeString() }}</q-item-label>
                <q-item-label caption v-if="event.isAllDay">All-day event</q-item-label>
                <q-item-label caption v-else>{{ getDurationText() }}</q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </div>

        <!-- Location -->
        <div v-if="event.location" class="row q-gutter-md q-mb-md">
          <div class="col-12">
            <q-item class="q-pa-none">
              <q-item-section avatar>
                <q-icon name="place" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ event.location }}</q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </div>

        <!-- Description -->
        <div v-if="event.description" class="row q-gutter-md q-mb-md">
          <div class="col-12">
            <q-item class="q-pa-none">
              <q-item-section avatar>
                <q-icon name="description" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-body1">{{ event.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </div>

        <!-- Provider Info -->
        <div v-if="event.provider" class="row q-gutter-md q-mb-md">
          <div class="col-12">
            <q-item class="q-pa-none">
              <q-item-section avatar>
                <q-icon :name="getProviderIcon(event.provider)" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ getProviderLabel(event.provider) }}</q-item-label>
                <q-item-label caption>External calendar event</q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </div>

        <!-- Reminders -->
        <div v-if="event.reminders && event.reminders.length > 0" class="row q-gutter-md q-mb-md">
          <div class="col-12">
            <q-item class="q-pa-none">
              <q-item-section avatar>
                <q-icon name="notifications" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Reminders</q-item-label>
                <q-item-label caption>
                  <div v-for="reminder in event.reminders" :key="reminder.minutes">
                    {{ getReminderText(reminder.minutes) }}
                  </div>
                </q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </div>

        <!-- Event Color -->
        <div class="row q-gutter-md q-mb-md">
          <div class="col-12">
            <q-item class="q-pa-none">
              <q-item-section avatar>
                <q-icon name="palette" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Color</q-item-label>
                <q-item-label caption class="row items-center">
                  <div
                    class="color-preview"
                    :style="{ backgroundColor: event.color }"
                  ></div>
                  <span class="q-ml-sm">{{ event.color }}</span>
                </q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </div>

        <!-- Visibility -->
        <div class="row q-gutter-md q-mb-md">
          <div class="col-12">
            <q-item class="q-pa-none">
              <q-item-section avatar>
                <q-icon :name="event.visibility === 'private' ? 'lock' : 'public'" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ event.visibility === 'private' ? 'Private' : 'Public' }}</q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </div>

        <!-- Timestamps -->
        <q-separator class="q-my-md" />
        <div class="text-caption text-grey-6">
          <div>Created: {{ formatDate(event.createdAt) }}</div>
          <div v-if="event.updatedAt && event.updatedAt.getTime() !== event.createdAt.getTime()">
            Updated: {{ formatDate(event.updatedAt) }}
          </div>
        </div>
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right">
        <q-btn
          label="Delete"
          color="negative"
          flat
          @click="confirmDelete"
          :disable="!!event?.provider"
        />
        <q-btn
          label="Edit"
          color="primary"
          flat
          @click="editEvent"
          :disable="!!event?.provider"
        />
        <q-btn
          label="Close"
          color="grey"
          flat
          @click="close"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useQuasar } from 'quasar'

const props = defineProps({
  modelValue: Boolean,
  event: Object
})

const emit = defineEmits(['update:modelValue', 'edit', 'delete'])

const $q = useQuasar()

// Methods
const close = () => {
  emit('update:modelValue', false)
}

const editEvent = () => {
  emit('edit')
}

const confirmDelete = () => {
  $q.dialog({
    title: 'Delete Event',
    message: `Are you sure you want to delete "${props.event.title}"?`,
    cancel: true,
    persistent: true,
    ok: {
      label: 'Delete',
      color: 'negative'
    }
  }).onOk(() => {
    emit('delete')
  })
}

const getStatusColor = (status) => {
  switch (status) {
    case 'confirmed':
      return 'positive'
    case 'tentative':
      return 'warning'
    case 'cancelled':
      return 'negative'
    default:
      return 'grey'
  }
}

const getProviderIcon = (provider) => {
  switch (provider) {
    case 'google':
      return 'event'
    case 'outlook':
      return 'mail'
    case 'apple':
      return 'event'
    default:
      return 'cloud'
  }
}

const getProviderLabel = (provider) => {
  switch (provider) {
    case 'google':
      return 'Google Calendar'
    case 'outlook':
      return 'Outlook Calendar'
    case 'apple':
      return 'Apple Calendar'
    default:
      return 'External Calendar'
  }
}

const getDurationText = () => {
  if (!props.event) return ''
  
  const duration = props.event.getDuration()
  if (duration < 60) {
    return `${duration} minutes`
  } else if (duration < 1440) {
    const hours = Math.floor(duration / 60)
    const minutes = duration % 60
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hour${hours > 1 ? 's' : ''}`
  } else {
    const days = Math.floor(duration / 1440)
    return `${days} day${days > 1 ? 's' : ''}`
  }
}

const getReminderText = (minutes) => {
  if (minutes < 60) {
    return `${minutes} minutes before`
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    return `${hours} hour${hours > 1 ? 's' : ''} before`
  } else {
    const days = Math.floor(minutes / 1440)
    return `${days} day${days > 1 ? 's' : ''} before`
  }
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString()
}
</script>

<style lang="scss" scoped>
.color-preview {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid #ccc;
  display: inline-block;
}
</style>