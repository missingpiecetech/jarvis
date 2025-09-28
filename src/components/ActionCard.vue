<template>
  <q-card class="action-card q-mb-sm" :class="actionTypeClass">
    <q-card-section class="row items-center">
      <q-icon
        :name="actionIcon"
        :color="actionColor"
        size="24px"
        class="q-mr-sm"
      />
      <div class="col">
        <div class="text-subtitle2">{{ actionDescription }}</div>
        <div v-if="action.itemCount > 0" class="text-caption text-grey-6">
          Affects {{ action.itemCount }} item(s)
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          flat
          dense
          icon="check"
          color="positive"
          @click="$emit('accept', action)"
          title="Accept this action"
        />
        <q-btn
          flat
          dense
          icon="close"
          color="negative"
          @click="$emit('reject', action)"
          title="Reject this action"
        />
      </div>
    </q-card-section>

    <!-- Show matching items for UPDATE/DELETE operations -->
    <q-card-section
      v-if="action.matchingItems && action.matchingItems.length > 0"
      class="q-pt-none"
    >
      <q-expansion-item
        :label="`View ${action.matchingItems.length} matching item(s)`"
        icon="visibility"
        dense
      >
        <div class="q-pa-sm">
          <div
            v-for="item in action.matchingItems.slice(0, 5)"
            :key="item.id"
            class="text-caption q-mb-xs"
          >
            <q-chip
              dense
              size="sm"
              :color="getPriorityColor(item.priority)"
              text-color="white"
            >
              {{ item.priority }}
            </q-chip>
            {{ item.title }}
            <span v-if="item.dueDate" class="text-grey-6">
              - Due: {{ formatDate(item.dueDate) }}</span
            >
          </div>
          <div
            v-if="action.matchingItems.length > 5"
            class="text-caption text-grey-6"
          >
            ...and {{ action.matchingItems.length - 5 }} more
          </div>
        </div>
      </q-expansion-item>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  action: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["accept", "reject"]);

const actionTypeClass = computed(() => {
  const actionType = props.action.type || props.action.action;
  const verb = actionType?.split("_")[0]; // Extract CREATE from CREATE_TASK
  switch (verb) {
    case "CREATE":
      return "action-create";
    case "UPDATE":
      return "action-update";
    case "DELETE":
      return "action-delete";
    case "READ":
      return "action-read";
    default:
      return "";
  }
});

const actionIcon = computed(() => {
  const actionType = props.action.type || props.action.action;
  const verb = actionType?.split("_")[0];
  switch (verb) {
    case "CREATE":
      return "add_circle";
    case "UPDATE":
      return "edit";
    case "DELETE":
      return "delete";
    case "READ":
      return "visibility";
    default:
      return "help";
  }
});

const actionColor = computed(() => {
  const actionType = props.action.type || props.action.action;
  const verb = actionType?.split("_")[0];
  switch (verb) {
    case "CREATE":
      return "positive";
    case "UPDATE":
      return "primary";
    case "DELETE":
      return "negative";
    case "READ":
      return "info";
    default:
      return "grey";
  }
});

const actionDescription = computed(() => {
  if (props.action.description) {
    return props.action.description;
  }

  const actionType = props.action.type || props.action.action;
  const params = props.action.params || {};

  switch (actionType) {
    case "CREATE_TASK":
      return `Create task: "${params.title || "New Task"}"`;
    case "UPDATE_TASK":
      return `Update task(s) matching criteria`;
    case "DELETE_TASK":
      return `Delete task(s) matching criteria`;
    case "READ_TASKS":
      return `Show tasks`;
    case "CREATE_EVENT":
      return `Create event: "${params.title || "New Event"}"`;
    case "UPDATE_EVENT":
      return `Update event(s) matching criteria`;
    case "DELETE_EVENT":
      return `Delete event(s) matching criteria`;
    case "READ_EVENTS":
      return `Show events`;
    case "STORE_FACT":
      return `Remember: ${params.key || "New information"}`;
    default:
      return actionType || "Unknown action";
  }
});

function getPriorityColor(priority) {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "red";
    case "high":
      return "orange";
    case "medium":
      return "blue";
    case "low":
      return "green";
    default:
      return "grey";
  }
}

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString();
}
</script>

<style lang="scss" scoped>
.action-card {
  border-left: 4px solid;

  &.action-create {
    border-left-color: $positive;
  }

  &.action-update {
    border-left-color: $primary;
  }

  &.action-delete {
    border-left-color: $negative;
  }

  &.action-read {
    border-left-color: $info;
  }
}
</style>
