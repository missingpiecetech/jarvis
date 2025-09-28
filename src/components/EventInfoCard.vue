<template>
  <q-card 
    class="event-info-card cursor-pointer"
    @click="navigateToEvent"
    flat
    bordered
  >
    <q-card-section class="q-pa-sm">
      <div class="row items-center no-wrap">
        <q-icon 
          name="event" 
          color="purple" 
          size="18px" 
          class="q-mr-sm"
        />
        <div class="col text-subtitle2 ellipsis">
          {{ event.title }}
        </div>
        <q-icon 
          name="open_in_new" 
          color="grey-6" 
          size="14px" 
          class="q-ml-sm"
        />
      </div>
      
      <div class="row items-center q-mt-xs text-caption text-grey-6">
        <span v-if="event.startDate">
          <q-icon name="schedule" size="12px" class="q-mr-xs"/>
          {{ formatDateTime(event.startDate) }}
        </span>
        <span v-if="event.location" class="q-ml-sm">
          <q-icon name="place" size="12px" class="q-mr-xs"/>
          {{ event.location }}
        </span>
        <span v-if="event.status" class="q-ml-sm">
          <q-icon :name="statusIcon" size="12px" class="q-mr-xs"/>
          {{ event.status }}
        </span>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  event: {
    type: Object,
    required: true
  }
})

const router = useRouter()

const statusIcon = computed(() => {
  switch (props.event.status) {
    case 'confirmed': return 'check_circle'
    case 'tentative': return 'help'
    case 'cancelled': return 'cancel'
    default: return 'help'
  }
})

const formatDateTime = (dateTime) => {
  if (!dateTime) return ''
  const date = new Date(dateTime)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  let dateStr = ''
  if (date.toDateString() === today.toDateString()) {
    dateStr = 'Today'
  } else if (date.toDateString() === tomorrow.toDateString()) {
    dateStr = 'Tomorrow'
  } else {
    dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    })
  }
  
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  
  return `${dateStr} at ${timeStr}`
}

const navigateToEvent = () => {
  router.push(`/events/${props.event.id}`)
}
</script>

<style scoped>
.event-info-card {
  transition: all 0.2s;
  max-width: 300px;
  border-left: 3px solid #9c27b0;
}

.event-info-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
</style>