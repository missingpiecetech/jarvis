<template>
  <q-page class="chat-page">
    <div class="chat-container">
      <!-- Chat Header -->
      <div class="chat-header q-pa-md bg-primary text-white">
        <div class="row items-center">
          <div class="col">
            <div class="text-h6">AI Assistant</div>
            <div class="text-caption">{{ conversationTitle || 'New Conversation' }}</div>
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
          <div v-for="(message, index) in messages" :key="index" class="message-wrapper q-mb-md">
            <div 
              class="message"
              :class="{
                'message-user': message.role === 'user',
                'message-assistant': message.role === 'assistant',
                'message-error': message.isError,
                'message-command': message.isCommand,
                'message-welcome': message.isWelcome
              }"
            >
              <div class="message-avatar">
                <q-avatar size="32px" :color="message.role === 'user' ? 'accent' : 'primary'">
                  <q-icon :name="getMessageIcon(message)" />
                </q-avatar>
              </div>
              <div class="message-content">
                <div class="message-text" v-html="formatMessageContent(message.content)"></div>
                <div class="message-meta text-caption text-grey-6">
                  {{ formatTime(message.timestamp) }}
                  <span v-if="message.model" class="q-ml-sm">• {{ message.model }}</span>
                  <span v-if="message.isCommand" class="q-ml-sm">• Command</span>
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
      <div class="chat-input-container bg-grey-1 q-pa-md">
        <div class="chat-input-wrapper">
          <q-input
            v-model="inputMessage"
            placeholder="Type your message..."
            outlined
            dense
            autogrow
            :disable="isTyping"
            @keydown.enter.prevent="handleEnterKey"
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
        <div v-if="!aiConfigured" class="text-caption text-warning q-mt-sm">
          <q-icon name="warning" class="q-mr-xs" />
          AI service not configured. Please add your API key to use the assistant.
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
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { conversationService, aiService, chatCommandService } from 'src/services'
import { Message } from 'src/models'
import { useAuthStore } from 'src/stores/auth'

const $q = useQuasar()
const authStore = useAuthStore()

// Reactive data
const messages = ref([])
const inputMessage = ref('')
const isTyping = ref(false)
const currentConversationId = ref(null)
const conversationTitle = ref('')
const showSettings = ref(false)
const messagesContainer = ref(null)

// AI Configuration
const apiKey = ref('')
const selectedModel = ref('gemini-2.0-flash-lite')
const modelOptions = [
  { label: 'Gemini 2.0 Flash Lite (Fast)', value: 'gemini-2.0-flash-lite' },
  { label: 'Gemini 2.5 Pro (Advanced)', value: 'gemini-2.5-pro' }
]

// Computed properties
const aiConfigured = computed(() => aiService.isConfigured() || !!apiKey.value)

// Initialize chat
onMounted(async () => {
  await loadActiveConversation()
  loadSettings()
})

// Watch for message changes to scroll to bottom
watch(messages, () => {
  nextTick(() => {
    scrollToBottom()
  })
}, { deep: true })

/**
 * Load active conversation or create new one
 */
async function loadActiveConversation() {
  try {
    const activeConversation = await conversationService.getActiveConversation()
    
    if (activeConversation.success && activeConversation.data) {
      currentConversationId.value = activeConversation.data.id
      conversationTitle.value = activeConversation.data.title
      messages.value = activeConversation.data.messages.map(msg => new Message(msg))
      
      // If conversation exists but has no messages, add welcome message
      if (messages.value.length === 0) {
        await addWelcomeMessage()
      }
    } else {
      // Start new conversation with welcome message
      await startNewConversation()
    }
  } catch (error) {
    console.error('Error loading active conversation:', error)
    await startNewConversation()
  }
}

/**
 * Start a new conversation
 */
async function startNewConversation() {
  try {
    const result = await conversationService.startNewSession()
    
    if (result.success) {
      currentConversationId.value = result.data.id
      conversationTitle.value = result.data.title || 'New Conversation'
      messages.value = []
      
      // Add welcome message when starting a new conversation
      await addWelcomeMessage()
    } else {
      $q.notify({
        type: 'negative',
        message: 'Failed to start new conversation'
      })
    }
  } catch (error) {
    console.error('Error starting new conversation:', error)
  }
}

/**
 * Add welcome message to new conversations
 */
async function addWelcomeMessage() {
  const welcomeMessage = new Message({
    role: 'assistant',
    content: `👋 Welcome to Jarvis, ${authStore.user?.name || 'there'}! I'm your personal AI assistant.

I can help you with:
• **Task Management**: "Create a task to call John tomorrow" or "List my high priority tasks"
• **Event Scheduling**: "Schedule a meeting with the team at 3pm Friday"
• **Multiple Tasks**: "I need to buy groceries, call mom, and finish the report by Friday"
• **General Questions**: Ask me anything you need help with!

What would you like to do today?`,
    timestamp: new Date(),
    isWelcome: true
  })
  
  messages.value.push(welcomeMessage)
  
  // Save welcome message to conversation
  if (currentConversationId.value) {
    await conversationService.addMessage(currentConversationId.value, welcomeMessage)
  }
}

/**
 * Send message to AI
 */
async function sendMessage() {
  if (!inputMessage.value.trim()) return
  
  const userMessage = inputMessage.value.trim()
  inputMessage.value = ''
  
  // Add user message
  const userMessageObj = new Message({
    role: 'user',
    content: userMessage,
    timestamp: new Date()
  })
  
  messages.value.push(userMessageObj)
  
  // Save user message to conversation
  if (currentConversationId.value) {
    await conversationService.addMessage(currentConversationId.value, userMessageObj)
  }
  
  // Show typing indicator
  isTyping.value = true
  
  try {
    // First, check if this is a task/event command
    const commandResult = await chatCommandService.processMessage(
      userMessage, 
      authStore.user?.id, 
      currentConversationId.value
    )
    
    let assistantContent = ''
    let isError = false
    
    if (commandResult && commandResult.isCommand) {
      // This was a recognized command
      assistantContent = commandResult.message
      isError = !commandResult.success
      
      if (commandResult.success) {
        // Add success notification
        $q.notify({
          type: 'positive',
          message: 'Command executed successfully',
          position: 'top'
        })
      }
    } else {
      // Not a command, proceed with normal AI processing
      // Get conversation context with enhanced task/event context
      let contextMessages = await aiService.getConversationContext(
        messages.value, 
        10, 
        authStore.user?.id
      )
      
      // Add enhanced context about tasks and events
      const enhancedContext = await chatCommandService.getEnhancedContext(authStore.user?.id)
      if (enhancedContext && contextMessages.length > 0) {
        contextMessages[0].content += enhancedContext
      }
      
      // Add enhanced system prompt
      const enhancedSystemPrompt = chatCommandService.getEnhancedSystemPrompt()
      if (contextMessages.length > 0) {
        contextMessages[0].content = enhancedSystemPrompt + '\n\n' + contextMessages[0].content
      }
      
      // Send to AI with context extraction enabled
      const aiResponse = await aiService.sendMessage(contextMessages, {
        model: selectedModel.value,
        userId: authStore.user?.id,
        conversationId: currentConversationId.value,
        extractContext: true
      })
      
      assistantContent = aiResponse.content
      isError = !aiResponse.success
    }
    
    // Create assistant message
    const assistantMessage = new Message({
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date(),
      isError: isError,
      model: selectedModel.value,
      isCommand: commandResult?.isCommand || false
    })
    
    messages.value.push(assistantMessage)
    
    // Save assistant message to conversation
    if (currentConversationId.value) {
      await conversationService.addMessage(currentConversationId.value, assistantMessage)
      
      // Update conversation title if this is the first exchange
      if (messages.value.length <= 2 && !conversationTitle.value) {
        const titleResult = await conversationService.update(currentConversationId.value, {
          title: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '')
        })
        if (titleResult.success) {
          conversationTitle.value = titleResult.data.title
        }
      }
    }
    
    if (isError) {
      $q.notify({
        type: 'negative',
        message: commandResult?.isCommand ? 'Command failed' : 'AI response failed'
      })
    }
    
  } catch (error) {
    console.error('Error sending message:', error)
    
    // Add error message
    const errorMessage = new Message({
      role: 'assistant',
      content: 'I apologize, but I encountered an error processing your request. Please try again.',
      timestamp: new Date(),
      isError: true
    })
    
    messages.value.push(errorMessage)
    
    $q.notify({
      type: 'negative',
      message: 'Failed to process your request'
    })
  } finally {
    isTyping.value = false
  }
}

/**
 * Handle Enter key in input
 */
function handleEnterKey(event) {
  if (!event.shiftKey) {
    sendMessage()
  }
}

/**
 * Get appropriate icon for message
 */
function getMessageIcon(message) {
  if (message.role === 'user') {
    return 'person'
  } else if (message.isWelcome) {
    return 'waving_hand'
  } else if (message.isCommand) {
    return 'terminal'
  } else {
    return 'smart_toy'
  }
}
function formatMessageContent(content) {
  // Basic markdown-like formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

/**
 * Scroll to bottom of messages
 */
function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

/**
 * Load settings from local storage
 */
function loadSettings() {
  const savedApiKey = localStorage.getItem('jarvis_ai_api_key')
  const savedModel = localStorage.getItem('jarvis_ai_model')
  
  if (savedApiKey) {
    apiKey.value = savedApiKey
  }
  if (savedModel) {
    selectedModel.value = savedModel
  }
}

/**
 * Save settings to local storage
 */
function saveSettings() {
  if (apiKey.value) {
    localStorage.setItem('jarvis_ai_api_key', apiKey.value)
    // Update AI service with new API key
    aiService.apiKey = apiKey.value
  }
  
  localStorage.setItem('jarvis_ai_model', selectedModel.value)
  
  showSettings.value = false
  
  $q.notify({
    type: 'positive',
    message: 'Settings saved successfully'
  })
}
</script>

<style lang="scss" scoped>
.chat-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  background: #fafafa;
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
  0%, 60%, 100% {
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