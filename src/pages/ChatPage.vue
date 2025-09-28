<template>
  <q-page class="chat-page">
    <div class="chat-container">
      <!-- Chat Header -->
      <div class="chat-header q-pa-md bg-secondary text-white">
        <div class="row items-center">
          <div class="col">
            <div class="text-h6">AI Assistant</div>
            <div class="text-caption">
              {{ conversationTitle || "New Conversation" }}
            </div>
          </div>
          <div class="col-auto">
            <q-btn
              flat
              round
              icon="settings"
              @click="showSettings = true"
              class="q-mr-sm"
            />
            <q-btn
              flat
              round
              icon="add"
              @click="startNewConversation"
              title="Start New Conversation"
            />
          </div>
        </div>
      </div>

      <!-- Messages Area -->
      <div class="messages-container" ref="messagesContainer">
        <div class="messages-content q-pa-md">
          <!-- Welcome Message -->
          <div v-if="messages.length === 0" class="text-center q-py-xl">
            <q-icon name="chat" size="64px" color="grey-5" class="q-mb-md" />
            <div class="text-h6 text-grey-7 q-mb-sm">Welcome to Jarvis</div>
            <div class="text-body2 text-grey-5">
              Your personal AI assistant is ready to help. Ask me anything!
            </div>
          </div>

          <!-- Message List -->
          <div
            v-for="(message, index) in messages"
            :key="index"
            class="message-wrapper q-mb-md"
          >
            <div
              class="message"
              :class="{
                'message-user': message.role === 'user',
                'message-assistant': message.role === 'assistant',
                'message-error': message.isError,
                'message-command': message.isCommand,
                'message-welcome': message.isWelcome,
              }"
            >
              <div class="message-avatar">
                <q-avatar
                  size="32px"
                  :color="message.role === 'user' ? 'accent' : 'primary'"
                >
                  <q-icon :name="getMessageIcon(message)" />
                </q-avatar>
              </div>
              <div class="message-content">
                <div
                  class="message-text"
                  v-html="formatMessageContent(message.content)"
                ></div>

                <!-- Visual Elements for Commands -->
                <div
                  v-if="
                    message.visualElements && message.visualElements.length > 0
                  "
                  class="message-visual-elements q-mt-sm"
                >
                  <div
                    v-for="element in message.visualElements"
                    :key="element.id"
                    class="q-mb-sm"
                  >
                    <ChatTaskCard
                      v-if="element.type === 'task_card'"
                      :task="element"
                    />
                  </div>
                </div>

                <!-- Action Cards for Confirmation -->
                <div
                  v-if="message.actions && message.actions.length > 0"
                  class="message-actions q-mt-sm"
                >
                  <div class="text-caption text-grey-6 q-mb-sm">
                    Please review and confirm the following actions:
                  </div>

                  <ActionCard
                    v-for="(action, index) in message.actions"
                    :key="`action-${index}`"
                    :action="action"
                    @accept="acceptAction(action, message)"
                    @reject="rejectAction(action, message)"
                  />
                  <div v-if="message.actions.length > 1" class="q-mt-sm">
                    <q-btn
                      color="positive"
                      label="Accept All"
                      size="sm"
                      @click="acceptAllActions(message)"
                    />
                    <q-btn
                      color="negative"
                      label="Reject All"
                      size="sm"
                      class="q-ml-sm"
                      @click="rejectAllActions(message)"
                    />
                  </div>
                </div>

                <div class="message-meta text-caption text-grey-6">
                  {{ formatTime(message.timestamp) }}
                  <span v-if="message.model" class="q-ml-sm"
                    >• {{ message.model }}</span
                  >
                  <span v-if="message.isCommand" class="q-ml-sm"
                    >• Command</span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Typing Indicator -->
          <div v-if="isTyping" class="message-wrapper q-mb-md">
            <div class="message message-assistant">
              <div class="message-avatar">
                <q-avatar size="32px" color="primary">
                  <q-icon name="smart_toy" />
                </q-avatar>
              </div>
              <div class="message-content">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-container bg-grey-1">
        <div class="chat-input-wrapper q-pa-md">
          <q-input
            v-model="inputMessage"
            placeholder="Type your message... (Shift+Enter for new line)"
            outlined
            type="textarea"
            :rows="Math.min(inputMessage.split('\n').length || 1, 4)"
            autogrow
            :disable="isTyping"
            @keydown="handleKeyDown"
            class="chat-input"
          >
            <template v-slot:append>
              <q-btn
                round
                dense
                flat
                icon="send"
                :disable="!inputMessage.trim() || isTyping"
                @click="sendMessage"
                color="primary"
              />
            </template>
          </q-input>
        </div>

        <!-- AI Configuration Status -->
        <div
          v-if="!aiConfigured"
          class="text-caption text-warning q-pa-md q-pt-none"
        >
          <q-icon name="warning" class="q-mr-xs" />
          AI service not configured. Please add your API key to use the
          assistant.
        </div>
      </div>
    </div>

    <!-- Settings Dialog -->
    <q-dialog v-model="showSettings">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">AI Settings</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="apiKey"
            label="Gemini API Key"
            type="password"
            outlined
            hint="Enter your Google Gemini API key"
            class="q-mb-md"
          />

          <q-select
            v-model="selectedModel"
            :options="modelOptions"
            label="Model"
            outlined
            emit-value
            map-options
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="showSettings = false" />
          <q-btn flat label="Save" color="primary" @click="saveSettings" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from "vue";
import { useQuasar } from "quasar";
import { conversationService, aiService } from "src/services";
import { Message } from "src/models";
import { useAuthStore } from "src/stores/auth";
import ChatTaskCard from "src/components/ChatTaskCard.vue";
import ActionCard from "src/components/ActionCard.vue";

const $q = useQuasar();
const authStore = useAuthStore();

// Reactive data
const messages = ref([]);
const inputMessage = ref("");
const isTyping = ref(false);
const currentConversationId = ref(null);
const conversationTitle = ref("");
const showSettings = ref(false);
const messagesContainer = ref(null);
const testActions = ref([
  {
    type: "CREATE_TASK",
    params: {
      title: "Water the ficus",
    },
  },
]);

// AI Configuration
const apiKey = ref("");
const selectedModel = ref("gemini-2.0-flash-lite");
const modelOptions = [
  { label: "Gemini 2.0 Flash Lite (Fast)", value: "gemini-2.0-flash-lite" },
  { label: "Gemini 2.5 Pro (Advanced)", value: "gemini-2.5-pro" },
];

// Computed properties
const aiConfigured = computed(() => aiService.isConfigured() || !!apiKey.value);

// Initialize chat
onMounted(async () => {
  await loadActiveConversation();
  loadSettings();
});

// Watch for message changes to scroll to bottom
watch(
  messages,
  () => {
    nextTick(() => {
      scrollToBottom();
    });
  },
  { deep: true }
);

/**
 * Load active conversation or create new one
 */
async function loadActiveConversation() {
  try {
    const activeConversation =
      await conversationService.getActiveConversation();

    if (activeConversation.success && activeConversation.data) {
      currentConversationId.value = activeConversation.data.id;
      conversationTitle.value = activeConversation.data.title;
      messages.value = activeConversation.data.messages.map(
        (msg) => new Message(msg)
      );

      // If conversation exists but has no messages, add welcome message
      if (messages.value.length === 0) {
        await addWelcomeMessage();
      }
    } else {
      // Start new conversation with welcome message
      await startNewConversation();
    }
  } catch (error) {
    console.error("Error loading active conversation:", error);
    await startNewConversation();
  }
}

/**
 * Start a new conversation
 */
async function startNewConversation() {
  try {
    const result = await conversationService.startNewSession();

    if (result.success) {
      currentConversationId.value = result.data.id;
      conversationTitle.value = result.data.title || "New Conversation";
      messages.value = [];

      // Add welcome message when starting a new conversation
      await addWelcomeMessage();
    } else {
      $q.notify({
        type: "negative",
        message: "Failed to start new conversation",
      });
    }
  } catch (error) {
    console.error("Error starting new conversation:", error);
  }
}

/**
 * Add welcome message to new conversations
 */
async function addWelcomeMessage() {
  const welcomeMessage = new Message({
    role: "assistant",
    content: `👋 Welcome to Jarvis, ${
      authStore.user?.name || "there"
    }! I'm your personal AI assistant.

I can help you with:
• **Task Management**: "Create a task to call John tomorrow" or "List my high priority tasks"
• **Event Scheduling**: "Schedule a meeting with the team at 3pm Friday"
• **Multiple Tasks**: "I need to buy groceries, call mom, and finish the report by Friday"
• **General Questions**: Ask me anything you need help with!

What would you like to do today?`,
    timestamp: new Date(),
    isWelcome: true,
  });

  messages.value.push(welcomeMessage);

  // Save welcome message to conversation
  if (currentConversationId.value) {
    await conversationService.addMessage(
      currentConversationId.value,
      welcomeMessage
    );
  }
}

/**
 * Send message to AI
 */
async function sendMessage() {
  if (!inputMessage.value.trim()) return;

  const userMessage = inputMessage.value.trim();
  inputMessage.value = "";

  // Add user message
  const userMessageObj = new Message({
    role: "user",
    content: userMessage,
    timestamp: new Date(),
  });

  messages.value.push(userMessageObj);

  // Save user message to conversation
  if (currentConversationId.value) {
    await conversationService.addMessage(
      currentConversationId.value,
      userMessageObj
    );
  }

  // Show typing indicator
  isTyping.value = true;

  try {
    // Use the new unified conversation processing flow
    const conversationResult = await aiService.processConversation(
      userMessage,
      authStore.user?.id,
      currentConversationId.value
    );

    let assistantContent = "";
    let assistantMessage;
    let isError = false;

    if (conversationResult.success) {
      assistantContent = conversationResult.response;

      console.log("Conversation result:", conversationResult);
      console.log("Actions to display:", conversationResult.actions);
      console.log("Actions array length:", conversationResult.actions?.length);
      console.log(
        "Actions array content:",
        JSON.stringify(conversationResult.actions, null, 2)
      );

      assistantMessage = new Message({
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        isCommand: conversationResult.actions?.length > 0,
        actions: conversationResult.actions || [],
        needsConfirmation: conversationResult.needsConfirmation || false,
        metadata: conversationResult.metadata,
      });
    } else {
      assistantContent =
        conversationResult.response ||
        "I apologize, but I encountered an error processing your request. Please try again.";
      isError = true;

      assistantMessage = new Message({
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        isError,
      });
    }

    messages.value.push(assistantMessage);

    // Save assistant message to conversation
    if (currentConversationId.value) {
      await conversationService.addMessage(
        currentConversationId.value,
        assistantMessage
      );

      // Update conversation title if this is the first exchange
      if (messages.value.length <= 2 && !conversationTitle.value) {
        const titleResult = await conversationService.update(
          currentConversationId.value,
          {
            title:
              userMessage.substring(0, 50) +
              (userMessage.length > 50 ? "..." : ""),
          }
        );
        if (titleResult.success) {
          conversationTitle.value = titleResult.data.title;
        }
      }
    }

    // Scroll to bottom
    nextTick(() => scrollToBottom());
  } catch (error) {
    console.error("Error sending message:", error);

    // Add error message
    const errorMessage = new Message({
      role: "assistant",
      content:
        "I apologize, but I encountered an error processing your request. Please try again.",
      timestamp: new Date(),
      isError: true,
    });

    messages.value.push(errorMessage);

    $q.notify({
      type: "negative",
      message: "Failed to process your request",
    });
  } finally {
    isTyping.value = false;
  }
}

/**
 * Handle keyboard input in textarea
 */
function handleKeyDown(event) {
  if (event.key === "Enter") {
    if (event.shiftKey) {
      // Shift+Enter: allow new line (default behavior)
      return;
    } else {
      // Enter alone: send message
      event.preventDefault();
      sendMessage();
    }
  }
}

/**
 * Get appropriate icon for message
 */
function getMessageIcon(message) {
  if (message.role === "user") {
    return "person";
  } else if (message.isWelcome) {
    return "waving_hand";
  } else if (message.isCommand) {
    return "terminal";
  } else {
    return "smart_toy";
  }
}
function formatMessageContent(content) {
  // Basic markdown-like formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Scroll to bottom of messages
 */
function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

/**
 * Load settings from local storage
 */
function loadSettings() {
  const savedApiKey = localStorage.getItem("jarvis_ai_api_key");
  const savedModel = localStorage.getItem("jarvis_ai_model");

  if (savedApiKey) {
    apiKey.value = savedApiKey;
  }
  if (savedModel) {
    selectedModel.value = savedModel;
  }
}

/**
 * Save settings to local storage
 */
function saveSettings() {
  if (apiKey.value) {
    localStorage.setItem("jarvis_ai_api_key", apiKey.value);
    // Update AI service with new API key
    aiService.apiKey = apiKey.value;
  }

  localStorage.setItem("jarvis_ai_model", selectedModel.value);

  showSettings.value = false;

  $q.notify({
    type: "positive",
    message: "Settings saved successfully",
  });
}

/**
 * Accept an individual action
 */
async function acceptAction(action, message) {
  try {
    isTyping.value = true;

    // Execute the action
    const results = await aiService.executeActions(
      [action],
      authStore.user?.id
    );

    // Update the message to show action was accepted
    const actionIndex = message.actions.findIndex((a) => a === action);
    if (actionIndex !== -1) {
      message.actions[actionIndex].status = "accepted";
    }

    // Add result message
    const result = results[0];
    let content = "";

    if (result.success) {
      if (action.type === "CREATE_TASK") {
        content = `✅ Task created successfully: "${
          action.params?.title || "New Task"
        }"`;
      } else if (action.type === "CREATE_EVENT") {
        content = `✅ Event created successfully: "${
          action.params?.title || "New Event"
        }"`;
      } else {
        content = `✅ Action completed successfully`;
      }
    } else {
      content = `❌ Action failed: ${result.error || "Unknown error"}`;
    }

    const resultMessage = new Message({
      role: "assistant",
      content,
      timestamp: new Date(),
      isCommand: true,
    });

    messages.value.push(resultMessage);

    if (result.success) {
      $q.notify({
        type: "positive",
        message: "Action completed successfully",
      });
    }

    nextTick(() => scrollToBottom());
  } catch (error) {
    console.error("Error executing action:", error);
    $q.notify({
      type: "negative",
      message: "Failed to execute action",
    });
  } finally {
    isTyping.value = false;
  }
}

/**
 * Reject an individual action
 */
async function rejectAction(action, message) {
  // Update the message to show action was rejected
  const actionIndex = message.actions.findIndex((a) => a === action);
  if (actionIndex !== -1) {
    message.actions[actionIndex].status = "rejected";
  }

  $q.notify({
    type: "info",
    message: "Action rejected",
  });
}

/**
 * Accept all actions in a message
 */
async function acceptAllActions(message) {
  try {
    isTyping.value = true;

    // Filter out already processed actions
    const pendingActions = message.actions.filter((a) => !a.status);

    if (pendingActions.length === 0) return;

    // Execute all actions
    const results = await aiService.executeActions(
      pendingActions,
      authStore.user?.id
    );

    // Update action statuses
    pendingActions.forEach((action) => {
      const actionIndex = message.actions.findIndex((a) => a === action);
      if (actionIndex !== -1) {
        message.actions[actionIndex].status = "accepted";
      }
    });

    // Add result message
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    const resultMessage = new Message({
      role: "assistant",
      content: `✅ Completed ${successCount} of ${totalCount} actions`,
      timestamp: new Date(),
      isCommand: true,
    });

    messages.value.push(resultMessage);

    $q.notify({
      type: "positive",
      message: `Completed ${successCount} of ${totalCount} actions`,
    });

    nextTick(() => scrollToBottom());
  } catch (error) {
    console.error("Error executing actions:", error);
    $q.notify({
      type: "negative",
      message: "Failed to execute actions",
    });
  } finally {
    isTyping.value = false;
  }
}

/**
 * Reject all actions in a message
 */
async function rejectAllActions(message) {
  // Update all action statuses
  message.actions.forEach((action) => {
    if (!action.status) {
      action.status = "rejected";
    }
  });

  $q.notify({
    type: "info",
    message: "All actions rejected",
  });
}
</script>

<style lang="scss" scoped>
.chat-page {
  height: calc(100vh - 56px); // Adjust for header height
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0; // Allow flexing
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  background: #fafafa;
  min-height: 0; // Allow container to shrink
}

.chat-input-container {
  flex-shrink: 0; // Don't allow input to shrink
  border-top: 1px solid #e0e0e0;
}

.chat-input {
  .q-field__control {
    min-height: 48px;
  }
}

.message-wrapper {
  display: flex;
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.message {
  display: flex;
  align-items: flex-start;
  max-width: 80%;

  &.message-user {
    margin-left: auto;
    flex-direction: row-reverse;

    .message-content {
      margin-right: 12px;
      background: var(--q-accent);
      color: white;
    }
  }

  &.message-assistant {
    .message-content {
      margin-left: 12px;
      background: white;
      border: 1px solid #e0e0e0;
    }
  }

  &.message-error {
    .message-content {
      background: #ffebee;
      border-color: #f44336;
    }
  }

  &.message-command {
    .message-content {
      background: #f3e5f5;
      border-color: #9c27b0;
    }
  }

  &.message-welcome {
    .message-content {
      background: #e8f5e8;
      border-color: #4caf50;
    }
  }
}

.message-content {
  padding: 12px 16px;
  border-radius: 16px;
  min-width: 80px;
}

.message-text {
  line-height: 1.4;
  word-wrap: break-word;
}

.message-meta {
  margin-top: 4px;
  opacity: 0.7;
}

.chat-input-container {
  border-top: 1px solid #e0e0e0;
}

.chat-input-wrapper {
  max-width: 800px;
  margin: 0 auto;
}

.typing-indicator {
  display: flex;
  align-items: center;
  padding: 8px 0;

  span {
    height: 8px;
    width: 8px;
    background: #ccc;
    border-radius: 50%;
    display: inline-block;
    margin-right: 4px;
    animation: typing 1.4s infinite ease-in-out;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
      margin-right: 0;
    }
  }
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

// Mobile responsive
@media (max-width: 768px) {
  .message {
    max-width: 95%;
  }

  .message-content {
    padding: 10px 14px;
    font-size: 14px;
  }
}
</style>
